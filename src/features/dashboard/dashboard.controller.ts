import { FastifyRequest, FastifyReply } from 'fastify';
import { dashboardRepository } from './dashboard.repository.js';

export const dashboardController = {
  async getDashboard(request: FastifyRequest, reply: FastifyReply) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [
      totalUsers,
      totalCourses,
      monthlyRevenue,
      previousMonthRevenue,
      cpeCreditsIssued,
      newUsersThisMonth,
      newUsersPrevMonth,
      newCoursesThisMonth,
      newCoursesPrevMonth,
      recentEnrollments,
      topCourses,
    ] = await Promise.all([
      dashboardRepository.getTotalUsers(),
      dashboardRepository.getTotalCourses(),
      dashboardRepository.getMonthlyRevenue(),
      dashboardRepository.getPreviousMonthRevenue(),
      dashboardRepository.getTotalCpeCredits(),
      dashboardRepository.getUsersCountSince(startOfMonth),
      dashboardRepository.getUsersCountSince(startOfPrevMonth),
      dashboardRepository.getCoursesCountSince(startOfMonth),
      dashboardRepository.getCoursesCountSince(startOfPrevMonth),
      dashboardRepository.getRecentEnrollments(5),
      dashboardRepository.getTopCourses(5),
    ]);

    // Calculate percentage changes
    const usersChange = newUsersPrevMonth > 0
      ? ((newUsersThisMonth - newUsersPrevMonth) / newUsersPrevMonth) * 100
      : 0;
    const coursesChange = newCoursesPrevMonth > 0
      ? ((newCoursesThisMonth - newCoursesPrevMonth) / newCoursesPrevMonth) * 100
      : 0;
    const revenueChange = previousMonthRevenue > 0
      ? ((monthlyRevenue - previousMonthRevenue) / previousMonthRevenue) * 100
      : 0;

    return reply.send({
      data: {
        stats: {
          totalUsers,
          totalCourses,
          monthlyRevenue,
          cpeCreditsIssued,
          usersChange: Math.round(usersChange * 10) / 10,
          coursesChange: Math.round(coursesChange * 10) / 10,
          revenueChange: Math.round(revenueChange * 10) / 10,
          cpeCreditsChange: 0,
        },
        recentEnrollments: recentEnrollments.map(e => ({
          id: String(e.id),
          userName: e.userName || 'Unknown',
          courseName: e.courseName || 'Unknown',
          enrolledAt: e.enrolledAt,
        })),
        topCourses,
      },
    });
  },
};
