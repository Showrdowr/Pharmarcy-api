import { eq, sql, and, isNull, desc } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { userExamAttempts, userExamAnswers, exams, examQuestions } from '../../db/schema/exams.js';
import { users } from '../../db/schema/users.js';
import { courses } from '../../db/schema/courses.js';

export const gradingRepository = {
  /**
   * Get pending exam attempts (status = SUBMITTED) with user and exam info
   */
  async getPendingAttempts(params: {
    courseId?: number;
    examId?: number;
    page: number;
    limit: number;
  }) {
    const conditions = [eq(userExamAttempts.status, 'SUBMITTED')];
    if (params.examId) {
      conditions.push(eq(userExamAttempts.examId, params.examId));
    }

    // Build base query with joins
    const baseQuery = db
      .select({
        id: userExamAttempts.id,
        userId: userExamAttempts.userId,
        examId: userExamAttempts.examId,
        submittedAt: userExamAttempts.finishedAt,
        userFullName: users.fullName,
        userEmail: users.email,
        userLicense: users.professionalLicenseNumber,
        examTitle: exams.title,
        courseId: exams.courseId,
        courseTitle: courses.title,
      })
      .from(userExamAttempts)
      .innerJoin(users, eq(userExamAttempts.userId, users.id))
      .innerJoin(exams, eq(userExamAttempts.examId, exams.id))
      .innerJoin(courses, eq(exams.courseId, courses.id))
      .where(and(...conditions));

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(userExamAttempts)
      .innerJoin(exams, eq(userExamAttempts.examId, exams.id))
      .where(and(...conditions));
    const total = Number(countResult[0]?.count || 0);

    // Get paginated results
    const offset = (params.page - 1) * params.limit;
    const rows = await baseQuery
      .orderBy(desc(userExamAttempts.finishedAt))
      .limit(params.limit)
      .offset(offset);

    // For each attempt, count free-text questions
    const attempts = await Promise.all(
      rows.map(async (row) => {
        const freeTextCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(userExamAnswers)
          .innerJoin(examQuestions, eq(userExamAnswers.examQuestionId, examQuestions.id))
          .where(
            and(
              eq(userExamAnswers.attemptId, row.id),
              eq(examQuestions.questionType, 'SHORT_ANSWER')
            )
          );

        return {
          id: row.id,
          user: {
            id: row.userId,
            fullName: row.userFullName,
            email: row.userEmail,
            licenseNumber: row.userLicense || undefined,
          },
          exam: {
            id: row.examId,
            title: row.examTitle,
            courseTitle: row.courseTitle,
          },
          submittedAt: row.submittedAt?.toISOString() || null,
          freeTextQuestionsCount: Number(freeTextCount[0]?.count || 0),
        };
      })
    );

    return {
      attempts,
      total,
      page: params.page,
      totalPages: Math.ceil(total / params.limit),
    };
  },

  /**
   * Get grading detail for a specific attempt
   */
  async getGradingDetail(attemptId: number) {
    // Get attempt with user + exam info
    const attemptRows = await db
      .select({
        attemptId: userExamAttempts.id,
        attemptStatus: userExamAttempts.status,
        startedAt: userExamAttempts.startedAt,
        finishedAt: userExamAttempts.finishedAt,
        userId: users.id,
        userFullName: users.fullName,
        userEmail: users.email,
        userLicense: users.professionalLicenseNumber,
        examTitle: exams.title,
        passingScorePercent: exams.passingScorePercent,
      })
      .from(userExamAttempts)
      .innerJoin(users, eq(userExamAttempts.userId, users.id))
      .innerJoin(exams, eq(userExamAttempts.examId, exams.id))
      .where(eq(userExamAttempts.id, attemptId))
      .limit(1);

    if (attemptRows.length === 0) return null;
    const row = attemptRows[0];

    // Get answers with question details
    const answerRows = await db
      .select({
        answerId: userExamAnswers.id,
        answerText: userExamAnswers.answerText,
        isCorrect: userExamAnswers.isCorrect,
        pointsEarned: userExamAnswers.pointsEarned,
        feedback: userExamAnswers.feedback,
        questionId: examQuestions.id,
        questionText: examQuestions.questionText,
        questionType: examQuestions.questionType,
        scoreWeight: examQuestions.scoreWeight,
        correctAnswer: examQuestions.correctAnswer,
        options: examQuestions.options,
      })
      .from(userExamAnswers)
      .innerJoin(examQuestions, eq(userExamAnswers.examQuestionId, examQuestions.id))
      .where(eq(userExamAnswers.attemptId, attemptId));

    return {
      attempt: {
        id: row.attemptId,
        status: row.attemptStatus,
        startedAt: row.startedAt?.toISOString() || null,
        finishedAt: row.finishedAt?.toISOString() || null,
      },
      user: {
        fullName: row.userFullName,
        email: row.userEmail,
        licenseNumber: row.userLicense || undefined,
      },
      exam: {
        title: row.examTitle,
        passingScorePercent: row.passingScorePercent,
      },
      answers: answerRows.map((a) => ({
        id: a.answerId,
        question: {
          id: a.questionId,
          questionText: a.questionText,
          questionType: a.questionType,
          scoreWeight: a.scoreWeight,
          correctAnswer: a.correctAnswer,
          options: a.options as { id: string; text: string }[] | null,
        },
        answerText: a.answerText || '',
        pointsEarned: a.pointsEarned ? Number(a.pointsEarned) : undefined,
        feedback: a.feedback || undefined,
        isGraded: a.pointsEarned !== null,
      })),
    };
  },

  /**
   * Submit grades for an attempt
   */
  async submitGrades(
    attemptId: number,
    gradedAnswers: { answerId: number; pointsEarned: number; feedback?: string }[]
  ) {
    // Update each answer
    for (const ga of gradedAnswers) {
      await db
        .update(userExamAnswers)
        .set({
          pointsEarned: String(ga.pointsEarned),
          feedback: ga.feedback || null,
        })
        .where(
          and(
            eq(userExamAnswers.id, ga.answerId),
            eq(userExamAnswers.attemptId, attemptId)
          )
        );
    }

    // Calculate total score
    const scores = await db
      .select({
        totalEarned: sql<string>`coalesce(sum(${userExamAnswers.pointsEarned}), 0)`,
      })
      .from(userExamAnswers)
      .where(eq(userExamAnswers.attemptId, attemptId));

    const totalQuestionWeights = await db
      .select({
        totalWeight: sql<string>`coalesce(sum(${examQuestions.scoreWeight}), 0)`,
      })
      .from(userExamAnswers)
      .innerJoin(examQuestions, eq(userExamAnswers.examQuestionId, examQuestions.id))
      .where(eq(userExamAnswers.attemptId, attemptId));

    const scoreObtained = Number(scores[0]?.totalEarned || 0);
    const totalScore = Number(totalQuestionWeights[0]?.totalWeight || 0);

    // Get passing score percent from exam
    const attemptRow = await db
      .select({
        examId: userExamAttempts.examId,
      })
      .from(userExamAttempts)
      .where(eq(userExamAttempts.id, attemptId))
      .limit(1);

    let isPassed = false;
    if (attemptRow.length > 0) {
      const examRow = await db
        .select({ passingScorePercent: exams.passingScorePercent })
        .from(exams)
        .where(eq(exams.id, attemptRow[0].examId))
        .limit(1);

      const passingPercent = examRow[0]?.passingScorePercent || 0;
      const scorePercent = totalScore > 0 ? (scoreObtained / totalScore) * 100 : 0;
      isPassed = scorePercent >= passingPercent;
    }

    // Update attempt status and scores
    await db
      .update(userExamAttempts)
      .set({
        status: 'GRADED',
        scoreObtained: String(scoreObtained),
        totalScore: String(totalScore),
        isPassed,
      })
      .where(eq(userExamAttempts.id, attemptId));

    return { scoreObtained, totalScore, isPassed };
  },
};
