import { and, count, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { env } from '../../config/env.js';
import {
  certificates,
  courses,
  enrollments,
  orderItems,
  orders,
  users,
} from '../../db/schema/index.js';

type DashboardHealthStatus = 'healthy' | 'degraded';

type DashboardMetricSummary = {
  totalUsers: number;
  totalCourses: number;
  monthlyRevenue: number;
  cpeCreditsIssued: number;
  usersChange: number;
  coursesChange: number;
  revenueChange: number;
  cpeCreditsChange: number;
};

type WeeklyRevenuePoint = {
  date: string;
  label: string;
  amount: number;
};

type RecentEnrollmentItem = {
  id: string;
  userName: string;
  courseName: string;
  enrolledAt: string;
};

type TopCourseItem = {
  id: string;
  name: string;
  title: string;
  enrollments: number;
  revenue: number;
};

type SystemStatusItem = {
  status: DashboardHealthStatus;
  label: string;
  detail?: string;
};

export type DashboardData = {
  stats: DashboardMetricSummary;
  weeklyRevenue: WeeklyRevenuePoint[];
  recentEnrollments: RecentEnrollmentItem[];
  topCourses: TopCourseItem[];
  systemStatus: {
    api: SystemStatusItem;
    database: SystemStatusItem;
    videoProvider: SystemStatusItem;
  };
};

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toNumber(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function toIsoString(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  }

  return new Date().toISOString();
}

function toShortThaiDayLabel(date: Date) {
  const labels = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
  return labels[date.getDay()] ?? '';
}

function calculatePercentChange(currentValue: number, previousValue: number) {
  if (previousValue <= 0) {
    return currentValue > 0 ? 100 : 0;
  }

  return Number((((currentValue - previousValue) / previousValue) * 100).toFixed(1));
}

async function getDatabaseStatus(): Promise<SystemStatusItem> {
  try {
    await db.execute(sql`select 1`);
    return {
      status: 'healthy',
      label: 'ปกติ',
    };
  } catch {
    return {
      status: 'degraded',
      label: 'มีปัญหา',
      detail: 'เชื่อมต่อฐานข้อมูลไม่สำเร็จ',
    };
  }
}

export const dashboardService = {
  async getDashboardData(): Promise<DashboardData> {
    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const previousMonthStart = addMonths(now, -1);
    const nextMonthStart = addMonths(now, 1);
    const sevenDayStart = startOfDay(addDays(now, -6));
    const tomorrowStart = startOfDay(addDays(now, 1));

    const [
      totalUsersRow,
      previousUsersRow,
      totalCoursesRow,
      previousCoursesRow,
      currentRevenueRow,
      previousRevenueRow,
      currentCpeRow,
      previousCpeRow,
      recentEnrollmentsRows,
      topCourseEnrollmentRows,
      topCourseRevenueRows,
      weeklyRevenueRows,
      databaseStatus,
    ] = await Promise.all([
      db
        .select({ count: count(users.id) })
        .from(users)
        .where(inArray(users.role, ['member', 'pharmacist'])),
      db
        .select({ count: count(users.id) })
        .from(users)
        .where(and(inArray(users.role, ['member', 'pharmacist']), lt(users.createdAt, currentMonthStart))),
      db.select({ count: count(courses.id) }).from(courses),
      db
        .select({ count: count(courses.id) })
        .from(courses)
        .where(lt(courses.createdAt, currentMonthStart)),
      db
        .select({
          amount: sql<string>`coalesce(sum(${orders.grandTotal}), 0)`,
        })
        .from(orders)
        .where(and(eq(orders.status, 'PAID'), gte(orders.createdAt, currentMonthStart), lt(orders.createdAt, nextMonthStart))),
      db
        .select({
          amount: sql<string>`coalesce(sum(${orders.grandTotal}), 0)`,
        })
        .from(orders)
        .where(and(eq(orders.status, 'PAID'), gte(orders.createdAt, previousMonthStart), lt(orders.createdAt, currentMonthStart))),
      db
        .select({
          credits: sql<string>`coalesce(sum(${courses.cpeCredits}), 0)`,
        })
        .from(certificates)
        .innerJoin(courses, eq(certificates.courseId, courses.id))
        .where(and(gte(certificates.issuedAt, currentMonthStart), lt(certificates.issuedAt, nextMonthStart))),
      db
        .select({
          credits: sql<string>`coalesce(sum(${courses.cpeCredits}), 0)`,
        })
        .from(certificates)
        .innerJoin(courses, eq(certificates.courseId, courses.id))
        .where(and(gte(certificates.issuedAt, previousMonthStart), lt(certificates.issuedAt, currentMonthStart))),
      db
        .select({
          id: enrollments.id,
          userName: users.fullName,
          courseName: courses.title,
          enrolledAt: enrollments.enrolledAt,
        })
        .from(enrollments)
        .innerJoin(users, eq(enrollments.userId, users.id))
        .innerJoin(courses, eq(enrollments.courseId, courses.id))
        .orderBy(desc(enrollments.enrolledAt))
        .limit(5),
      db
        .select({
          courseId: courses.id,
          title: courses.title,
          enrollments: count(enrollments.id),
        })
        .from(enrollments)
        .innerJoin(courses, eq(enrollments.courseId, courses.id))
        .groupBy(courses.id, courses.title),
      db
        .select({
          courseId: courses.id,
          revenue: sql<string>`coalesce(sum(${orderItems.priceAtPurchase}), 0)`,
        })
        .from(orderItems)
        .innerJoin(courses, eq(orderItems.courseId, courses.id))
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .where(eq(orders.status, 'PAID'))
        .groupBy(courses.id),
      db
        .select({
          day: sql<string>`to_char(date_trunc('day', ${orders.createdAt}), 'YYYY-MM-DD')`,
          amount: sql<string>`coalesce(sum(${orders.grandTotal}), 0)`,
        })
        .from(orders)
        .where(and(eq(orders.status, 'PAID'), gte(orders.createdAt, sevenDayStart), lt(orders.createdAt, tomorrowStart)))
        .groupBy(sql`date_trunc('day', ${orders.createdAt})`),
      getDatabaseStatus(),
    ]);

    const totalUsers = Number(totalUsersRow[0]?.count ?? 0);
    const previousTotalUsers = Number(previousUsersRow[0]?.count ?? 0);
    const totalCourses = Number(totalCoursesRow[0]?.count ?? 0);
    const previousTotalCourses = Number(previousCoursesRow[0]?.count ?? 0);
    const monthlyRevenue = toNumber(currentRevenueRow[0]?.amount);
    const previousMonthlyRevenue = toNumber(previousRevenueRow[0]?.amount);
    const cpeCreditsIssued = toNumber(currentCpeRow[0]?.credits);
    const previousCpeCreditsIssued = toNumber(previousCpeRow[0]?.credits);

    const revenueByCourseId = new Map<number, number>(
      topCourseRevenueRows.map((row) => [Number(row.courseId), toNumber(row.revenue)])
    );

    const topCourses = topCourseEnrollmentRows
      .map((row) => ({
        id: String(row.courseId),
        name: row.title,
        title: row.title,
        enrollments: Number(row.enrollments ?? 0),
        revenue: revenueByCourseId.get(Number(row.courseId)) ?? 0,
      }))
      .sort((left, right) => {
        if (right.enrollments !== left.enrollments) {
          return right.enrollments - left.enrollments;
        }

        return right.revenue - left.revenue;
      })
      .slice(0, 4);

    const weeklyRevenueMap = new Map(
      weeklyRevenueRows.map((row) => [row.day, toNumber(row.amount)])
    );

    const weeklyRevenue: WeeklyRevenuePoint[] = Array.from({ length: 7 }, (_, index) => {
      const date = addDays(sevenDayStart, index);
      const dateKey = date.toISOString().slice(0, 10);
      return {
        date: date.toISOString(),
        label: toShortThaiDayLabel(date),
        amount: weeklyRevenueMap.get(dateKey) ?? 0,
      };
    });

    const recentEnrollments: RecentEnrollmentItem[] = recentEnrollmentsRows.map((row) => ({
      id: String(row.id),
      userName: row.userName?.trim() || 'ไม่ระบุชื่อ',
      courseName: row.courseName,
      enrolledAt: toIsoString(row.enrolledAt),
    }));

    const videoProviderStatus: SystemStatusItem = env.VIMEO_ACCESS_TOKEN
      ? {
          status: 'healthy',
          label: 'พร้อมใช้งาน',
          detail: 'พบการตั้งค่า Vimeo access token',
        }
      : {
          status: 'degraded',
          label: 'ยังไม่พร้อม',
          detail: 'ไม่พบการตั้งค่า VIMEO_ACCESS_TOKEN',
        };

    return {
      stats: {
        totalUsers,
        totalCourses,
        monthlyRevenue,
        cpeCreditsIssued,
        usersChange: calculatePercentChange(totalUsers, previousTotalUsers),
        coursesChange: calculatePercentChange(totalCourses, previousTotalCourses),
        revenueChange: calculatePercentChange(monthlyRevenue, previousMonthlyRevenue),
        cpeCreditsChange: calculatePercentChange(cpeCreditsIssued, previousCpeCreditsIssued),
      },
      weeklyRevenue,
      recentEnrollments,
      topCourses,
      systemStatus: {
        api: {
          status: 'healthy',
          label: 'ปกติ',
          detail: 'Dashboard API ตอบสนองได้',
        },
        database: databaseStatus,
        videoProvider: videoProviderStatus,
      },
    };
  },
};
