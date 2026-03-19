import { db } from '../../db/index.js';
import { users, courses, orders, enrollments } from '../../db/schema/index.js';
import { sql, eq, desc, and, gte } from 'drizzle-orm';

export const dashboardRepository = {
  // Aggregation for Dashboard Stats
  async getDashboardStats() {
    const [totalUsersRes] = await db
      .select({ count: sql<number>`cast(count(${users.id}) as integer)` })
      .from(users);

    const [totalCoursesRes] = await db
      .select({ count: sql<number>`cast(count(${courses.id}) as integer)` })
      .from(courses);

    const [monthlyRevenueRes] = await db
      .select({ revenue: sql<number>`cast(coalesce(sum(${orders.grandTotal}), 0) as float)` })
      .from(orders)
      .where(eq(orders.status, 'PAID'));

    // Sum of CPE credits for completed enrollments
    const [cpeCreditsRes] = await db
      .select({ 
        totalCpe: sql<number>`cast(coalesce(sum(${courses.cpeCredits}), 0) as integer)` 
      })
      .from(enrollments)
      .leftJoin(courses, eq(enrollments.courseId, courses.id))
      .where(
        and(
          eq(courses.hasCertificate, true),
          sql`${enrollments.progressPercent} >= 100 OR ${enrollments.isCompleted} = true`
        )
      );

    return {
      totalUsers: totalUsersRes?.count || 0,
      totalCourses: totalCoursesRes?.count || 0,
      monthlyRevenue: monthlyRevenueRes?.revenue || 0,
      cpeCreditsIssued: cpeCreditsRes?.totalCpe || 0,
      // Mock changes as they require complex previous month date comparison logic
      usersChange: 0,
      coursesChange: 0,
      revenueChange: 0,
      cpeCreditsChange: 0,
    };
  },

  async getRecentEnrollments(limit: number = 5) {
    const records = await db
      .select({
        id: enrollments.id,
        userName: users.fullName,
        userEmail: users.email,
        courseName: courses.title,
        enrolledAt: enrollments.enrolledAt,
      })
      .from(enrollments)
      .leftJoin(users, eq(enrollments.userId, users.id))
      .leftJoin(courses, eq(enrollments.courseId, courses.id))
      .orderBy(desc(enrollments.enrolledAt))
      .limit(limit);

    return records.map((record) => ({
      id: record.id.toString(),
      userName: record.userName || record.userEmail || 'Unknown User',
      courseName: record.courseName || 'Unknown Course',
      enrolledAt: record.enrolledAt,
    }));
  },

  async getTopCourses(limit: number = 5) {
    const records = await db
      .select({
        id: courses.id,
        title: courses.title,
        enrollmentCount: sql<number>`cast(count(${enrollments.id}) as integer)`,
      })
      .from(courses)
      .leftJoin(enrollments, eq(enrollments.courseId, courses.id))
      .groupBy(courses.id)
      .orderBy(desc(sql`count(${enrollments.id})`))
      .limit(limit);

    return records.map((record) => ({
      id: record.id.toString(),
      name: record.title || 'Course ' + record.id,
      title: record.title || 'Course ' + record.id,
      enrollments: record.enrollmentCount || 0,
      revenue: 0, // Mock revenue per course for performance
    }));
  },
};
