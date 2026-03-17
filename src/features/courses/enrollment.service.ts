import { enrollmentRepository } from './enrollment.repository.js';
import { coursesRepository } from './courses.repository.js';

export const enrollmentService = {
  async enrollCourse(userId: number, courseId: number) {
    // Check if course exists
    const course = await coursesRepository.getCourseById(courseId);
    if (!course) {
      return { error: 'ไม่พบคอร์สที่ต้องการ', status: 404 };
    }

    // Check if already enrolled
    const existing = await enrollmentRepository.findByUserAndCourse(userId, courseId);
    if (existing) {
      return { error: 'คุณลงทะเบียนคอร์สนี้แล้ว', status: 409 };
    }

    const enrollment = await enrollmentRepository.enroll(userId, courseId);
    return { data: enrollment };
  },

  async getEnrolledCourses(userId: number) {
    const enrolledList = await enrollmentRepository.getEnrolledCourses(userId);

    return enrolledList.map(e => ({
      id: e.course.id,
      title: e.course.title,
      description: e.course.description,
      thumbnail: e.course.thumbnail,
      category: e.course.category?.name || null,
      lessonsCount: e.course.lessons?.length || 0,
      progressPercent: parseFloat(e.progressPercent || '0'),
      isCompleted: e.isCompleted,
      enrolledAt: e.enrolledAt,
      lastAccessedAt: e.lastAccessedAt,
    }));
  },

  async getCourseProgress(userId: number, courseId: number) {
    const enrollment = await enrollmentRepository.findByUserAndCourse(userId, courseId);
    if (!enrollment) {
      return { error: 'คุณยังไม่ได้ลงทะเบียนคอร์สนี้', status: 404 };
    }

    const totalLessons = await enrollmentRepository.getTotalLessonsCount(courseId);
    const completedLessons = await enrollmentRepository.getCompletedLessonsCount(userId, courseId);
    const lessonProgress = await enrollmentRepository.getUserLessonProgressForCourse(userId, courseId);

    const progressPercent = totalLessons > 0
      ? Math.round((completedLessons / totalLessons) * 100)
      : 0;

    return {
      data: {
        courseId,
        totalLessons,
        completedLessons,
        progressPercent,
        isCompleted: enrollment.isCompleted,
        lessons: lessonProgress,
      },
    };
  },

  async markLessonComplete(userId: number, courseId: number, lessonId: number) {
    // Verify enrollment
    const enrollment = await enrollmentRepository.findByUserAndCourse(userId, courseId);
    if (!enrollment) {
      return { error: 'คุณยังไม่ได้ลงทะเบียนคอร์สนี้', status: 404 };
    }

    // Mark lesson complete
    await enrollmentRepository.markLessonComplete(userId, lessonId);

    // Recalculate course progress
    const totalLessons = await enrollmentRepository.getTotalLessonsCount(courseId);
    const completedLessons = await enrollmentRepository.getCompletedLessonsCount(userId, courseId);

    const progressPercent = totalLessons > 0
      ? ((completedLessons / totalLessons) * 100).toFixed(2)
      : '0.00';
    const isCompleted = totalLessons > 0 && completedLessons >= totalLessons;

    // Update enrollment progress
    await enrollmentRepository.updateProgress(userId, courseId, progressPercent, isCompleted);

    return {
      data: {
        lessonId,
        courseId,
        completedLessons,
        totalLessons,
        progressPercent: parseFloat(progressPercent),
        isCompleted,
      },
    };
  },

  async getFeaturedCourses(limit: number = 6) {
    const courses = await enrollmentRepository.getFeaturedCourses(limit);
    return courses.map(c => ({
      id: c.id,
      title: c.title,
      description: c.description,
      thumbnail: c.thumbnail,
      price: c.price ? parseFloat(c.price) : 0,
      category: c.category?.name || null,
      lessonsCount: c.lessons?.length || 0,
      cpeCredits: c.cpeCredits || 0,
      status: c.status,
    }));
  },

  async getPopularCourses(limit: number = 8) {
    const courses = await enrollmentRepository.getPopularCourses(limit);
    return courses.map((c: any) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      thumbnail: c.thumbnail,
      price: c.price ? parseFloat(c.price) : 0,
      category: c.category?.name || null,
      lessonsCount: c.lessons?.length || 0,
      cpeCredits: c.cpeCredits || 0,
      status: c.status,
    }));
  },
};
