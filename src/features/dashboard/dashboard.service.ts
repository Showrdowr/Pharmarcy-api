import { dashboardRepository } from './dashboard.repository.js';

export const dashboardService = {
  async getDashboardData() {
    // Run all aggregate queries in parallel
    const [stats, recentEnrollments, topCourses] = await Promise.all([
      dashboardRepository.getDashboardStats(),
      dashboardRepository.getRecentEnrollments(5),
      dashboardRepository.getTopCourses(5),
    ]);

    return {
      stats,
      recentEnrollments,
      topCourses,
    };
  },
};
