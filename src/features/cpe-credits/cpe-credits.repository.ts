import { eq, sql, and, like, or, desc } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { certificates } from '../../db/schema/progress.js';
import { courses } from '../../db/schema/courses.js';
import { users } from '../../db/schema/users.js';

export const cpeCreditsRepository = {
  /**
   * Get CPE credit records (certificates with course CPE info)
   * CPE credits come from: user completes course → gets certificate → earns cpeCredits from course
   */
  async getRecords(params: { page: number; limit: number; search?: string }) {
    const baseConditions = [sql`${courses.cpeCredits} > 0`];

    // Build search conditions if provided
    if (params.search) {
      const searchTerm = `%${params.search}%`;
      baseConditions.push(
        or(
          like(users.fullName, searchTerm),
          like(users.email, searchTerm),
          like(courses.title, searchTerm)
        )!
      );
    }

    // Count total
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(certificates)
      .innerJoin(users, eq(certificates.userId, users.id))
      .innerJoin(courses, eq(certificates.courseId, courses.id))
      .where(and(...baseConditions));
    const total = Number(countResult[0]?.count || 0);

    // Get records
    const offset = (params.page - 1) * params.limit;
    const rows = await db
      .select({
        certificateId: certificates.id,
        certificateCode: certificates.certificateCode,
        issuedAt: certificates.issuedAt,
        userId: users.id,
        userFullName: users.fullName,
        userEmail: users.email,
        userLicense: users.professionalLicenseNumber,
        courseId: courses.id,
        courseTitle: courses.title,
        cpeCredits: courses.cpeCredits,
      })
      .from(certificates)
      .innerJoin(users, eq(certificates.userId, users.id))
      .innerJoin(courses, eq(certificates.courseId, courses.id))
      .where(and(...baseConditions))
      .orderBy(desc(certificates.issuedAt))
      .limit(params.limit)
      .offset(offset);

    const records = rows.map((r) => ({
      id: String(r.certificateId),
      pharmacistId: String(r.userId),
      pharmacistName: r.userFullName || '',
      licenseNumber: r.userLicense || '',
      courseId: String(r.courseId),
      courseName: r.courseTitle || '',
      credits: r.cpeCredits || 0,
      completedAt: r.issuedAt?.toISOString() || '',
      certificateCode: r.certificateCode,
    }));

    return {
      records,
      total,
      page: params.page,
      totalPages: Math.ceil(total / params.limit),
    };
  },

  /**
   * Get CPE stats summary
   */
  async getStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // Total credits this month
    const monthlyResult = await db
      .select({
        totalCredits: sql<number>`coalesce(sum(${courses.cpeCredits}), 0)`,
        pharmacistsCount: sql<number>`count(distinct ${certificates.userId})`,
      })
      .from(certificates)
      .innerJoin(courses, eq(certificates.courseId, courses.id))
      .where(
        and(
          sql`${courses.cpeCredits} > 0`,
          sql`${certificates.issuedAt} >= ${startOfMonth.toISOString()}`
        )
      );

    // Total credits this year
    const yearlyResult = await db
      .select({
        totalCredits: sql<number>`coalesce(sum(${courses.cpeCredits}), 0)`,
      })
      .from(certificates)
      .innerJoin(courses, eq(certificates.courseId, courses.id))
      .where(
        and(
          sql`${courses.cpeCredits} > 0`,
          sql`${certificates.issuedAt} >= ${startOfYear.toISOString()}`
        )
      );

    // Courses with CPE
    const coursesWithCpe = await db
      .select({ count: sql<number>`count(*)` })
      .from(courses)
      .where(sql`${courses.cpeCredits} > 0`);

    return {
      totalCreditsThisMonth: Number(monthlyResult[0]?.totalCredits || 0),
      pharmacistsReceived: Number(monthlyResult[0]?.pharmacistsCount || 0),
      coursesWithCpe: Number(coursesWithCpe[0]?.count || 0),
      totalCreditsThisYear: Number(yearlyResult[0]?.totalCredits || 0),
    };
  },
};
