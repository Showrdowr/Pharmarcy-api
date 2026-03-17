import { db } from '../../db/index.js';
import { users } from '../../db/schema/users.js';
import { courses } from '../../db/schema/courses.js';
import { enrollments } from '../../db/schema/progress.js';
import { orders, orderItems } from '../../db/schema/orders.js';
import { eq, desc, sql, count, and, gte } from 'drizzle-orm';

export const dashboardRepository = {
  async getTotalUsers() {
    const result = await db.select({ count: count() }).from(users);
    return result[0]?.count ?? 0;
  },

  async getTotalCourses() {
    const result = await db.select({ count: count() }).from(courses);
    return result[0]?.count ?? 0;
  },

  async getMonthlyRevenue() {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const result = await db
      .select({ total: sql<string>`COALESCE(SUM(${orders.grandTotal}), 0)` })
      .from(orders)
      .where(
        and(
          eq(orders.status, 'PAID'),
          gte(orders.createdAt, startOfMonth)
        )
      );
    return parseFloat(result[0]?.total ?? '0');
  },

  async getPreviousMonthRevenue() {
    const startOfPrevMonth = new Date();
    startOfPrevMonth.setMonth(startOfPrevMonth.getMonth() - 1);
    startOfPrevMonth.setDate(1);
    startOfPrevMonth.setHours(0, 0, 0, 0);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const result = await db
      .select({ total: sql<string>`COALESCE(SUM(${orders.grandTotal}), 0)` })
      .from(orders)
      .where(
        and(
          eq(orders.status, 'PAID'),
          gte(orders.createdAt, startOfPrevMonth),
          sql`${orders.createdAt} < ${startOfMonth}`
        )
      );
    return parseFloat(result[0]?.total ?? '0');
  },

  async getTotalCpeCredits() {
    const result = await db
      .select({ total: sql<string>`COALESCE(SUM(${courses.cpeCredits}), 0)` })
      .from(courses)
      .where(eq(courses.status, 'PUBLISHED'));
    return parseInt(result[0]?.total ?? '0', 10);
  },

  async getUsersCountSince(since: Date) {
    const result = await db
      .select({ count: count() })
      .from(users)
      .where(gte(users.createdAt, since));
    return result[0]?.count ?? 0;
  },

  async getCoursesCountSince(since: Date) {
    const result = await db
      .select({ count: count() })
      .from(courses)
      .where(gte(courses.createdAt, since));
    return result[0]?.count ?? 0;
  },

  async getRecentEnrollments(limit: number = 5) {
    return await db
      .select({
        id: enrollments.id,
        userId: enrollments.userId,
        courseId: enrollments.courseId,
        enrolledAt: enrollments.enrolledAt,
        userName: users.fullName,
        courseName: courses.title,
      })
      .from(enrollments)
      .innerJoin(users, eq(enrollments.userId, users.id))
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .orderBy(desc(enrollments.enrolledAt))
      .limit(limit);
  },

  async getTopCourses(limit: number = 5) {
    const result = await db
      .select({
        courseId: enrollments.courseId,
        enrollmentCount: count(),
      })
      .from(enrollments)
      .groupBy(enrollments.courseId)
      .orderBy(desc(count()))
      .limit(limit);

    if (result.length === 0) return [];

    const topCourses = await Promise.all(
      result.map(async (r) => {
        const course = await db.query.courses.findFirst({
          where: eq(courses.id, r.courseId),
        });

        // Calculate revenue for this course from paid orders
        const revenueResult = await db
          .select({ total: sql<string>`COALESCE(SUM(${orderItems.priceAtPurchase}), 0)` })
          .from(orderItems)
          .innerJoin(orders, eq(orderItems.orderId, orders.id))
          .where(
            and(
              eq(orderItems.courseId, r.courseId),
              eq(orders.status, 'PAID')
            )
          );

        return {
          id: String(r.courseId),
          name: course?.title ?? 'Unknown',
          title: course?.title ?? 'Unknown',
          enrollments: r.enrollmentCount,
          revenue: parseFloat(revenueResult[0]?.total ?? '0'),
        };
      })
    );

    return topCourses;
  },
};
