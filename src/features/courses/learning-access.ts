export type LearningAccessLesson = {
  id: number | string;
  title?: string | null;
  sequenceOrder?: number | null;
};

type LockedLessonPayload = {
  id: number;
  title: string | null | undefined;
  sequenceOrder: number | null | undefined;
  status: 'locked';
  video: null;
  documents: [];
  interactiveQuestions: [];
  lessonQuiz: null;
  progress: {
    lastWatchedSeconds: 0;
    isCompleted: false;
  };
};

type AppErrorFactory = (message: string, statusCode?: number, code?: string) => Error;
export const DEFAULT_ALLOWED_PROGRESS_ADVANCE_SECONDS = 30;

function normalizeLessonId(value: number | string) {
  return Number(value);
}

export function getCompletedLessonSet(completedLessonIds: Array<number | string>) {
  return new Set<number>(
    completedLessonIds
      .map((lessonId) => normalizeLessonId(lessonId))
      .filter((lessonId) => Number.isInteger(lessonId) && lessonId > 0)
  );
}

export function isLessonUnlocked(
  lessons: Array<Pick<LearningAccessLesson, 'id'>>,
  lessonIndex: number,
  completedLessonSet: Set<number>,
) {
  return lessonIndex === 0
    || lessons
      .slice(0, lessonIndex)
      .every((previousLesson) => completedLessonSet.has(normalizeLessonId(previousLesson.id)));
}

export function getLessonAccessState(
  lessons: LearningAccessLesson[],
  completedLessonIds: Array<number | string>,
  lessonId: number,
  createError: AppErrorFactory,
) {
  const lessonIndex = lessons.findIndex((lesson) => normalizeLessonId(lesson.id) === lessonId);
  if (lessonIndex === -1) {
    throw createError('Lesson not found', 404);
  }

  const completedLessonSet = getCompletedLessonSet(completedLessonIds);

  return {
    lessonIndex,
    lesson: lessons[lessonIndex],
    completedLessonSet,
    isUnlocked: isLessonUnlocked(lessons, lessonIndex, completedLessonSet),
  };
}

export function assertLessonAccessibleForLearner(
  lessons: LearningAccessLesson[],
  completedLessonIds: Array<number | string>,
  lessonId: number,
  createError: AppErrorFactory,
) {
  const accessState = getLessonAccessState(lessons, completedLessonIds, lessonId, createError);
  if (!accessState.isUnlocked) {
    throw createError('กรุณาเรียนบทก่อนหน้าให้เสร็จก่อน', 409, 'LESSON_LOCKED');
  }

  return accessState;
}

export function getTypedLessonAccessState<TLesson extends LearningAccessLesson>(
  lessons: TLesson[],
  completedLessonIds: Array<number | string>,
  lessonId: number,
  createError: AppErrorFactory,
): {
  lessonIndex: number;
  lesson: TLesson;
  completedLessonSet: Set<number>;
  isUnlocked: boolean;
} {
  const accessState = getLessonAccessState(lessons, completedLessonIds, lessonId, createError);

  return {
    ...accessState,
    lesson: lessons[accessState.lessonIndex],
  };
}

export function assertTypedLessonAccessibleForLearner<TLesson extends LearningAccessLesson>(
  lessons: TLesson[],
  completedLessonIds: Array<number | string>,
  lessonId: number,
  createError: AppErrorFactory,
): {
  lessonIndex: number;
  lesson: TLesson;
  completedLessonSet: Set<number>;
  isUnlocked: boolean;
} {
  const accessState = getTypedLessonAccessState(lessons, completedLessonIds, lessonId, createError);
  if (!accessState.isUnlocked) {
    throw createError('กรุณาเรียนบทก่อนหน้าให้เสร็จก่อน', 409, 'LESSON_LOCKED');
  }

  return accessState;
}

export function buildLockedLessonLearningPayload(lesson: LearningAccessLesson): LockedLessonPayload {
  return {
    id: normalizeLessonId(lesson.id),
    title: lesson.title,
    sequenceOrder: lesson.sequenceOrder,
    status: 'locked',
    video: null,
    documents: [],
    interactiveQuestions: [],
    lessonQuiz: null,
    progress: {
      lastWatchedSeconds: 0,
      isCompleted: false,
    },
  };
}

export function calculateMonotonicWatchedSeconds(
  currentSavedSeconds: number,
  incomingSeconds: number,
  duration?: number | null,
) {
  const normalizedCurrentSeconds = Math.max(0, Number(currentSavedSeconds ?? 0));
  const normalizedIncomingSeconds = Math.max(0, Number(incomingSeconds ?? 0));
  const nextWatchedSeconds = Math.max(normalizedCurrentSeconds, normalizedIncomingSeconds);
  const normalizedDuration = Number(duration ?? 0);

  if (normalizedDuration > 0) {
    return Math.min(normalizedDuration, nextWatchedSeconds);
  }

  return nextWatchedSeconds;
}

export function assertAllowedWatchedProgressAdvance(
  currentSavedSeconds: number,
  incomingSeconds: number,
  duration: number | null | undefined,
  createError: AppErrorFactory,
  allowedAdvanceSeconds = DEFAULT_ALLOWED_PROGRESS_ADVANCE_SECONDS,
) {
  const normalizedCurrentSeconds = Math.max(0, Number(currentSavedSeconds ?? 0));
  const normalizedIncomingSeconds = Math.max(0, Number(incomingSeconds ?? 0));
  const normalizedDuration = Math.max(0, Number(duration ?? 0));
  const clampedIncomingSeconds = normalizedDuration > 0
    ? Math.min(normalizedDuration, normalizedIncomingSeconds)
    : normalizedIncomingSeconds;
  const maxAllowedSeconds = normalizedCurrentSeconds + Math.max(1, allowedAdvanceSeconds);

  if (clampedIncomingSeconds > maxAllowedSeconds) {
    throw createError(
      'ไม่สามารถข้ามวิดีโอไปข้างหน้าได้ กรุณาเรียนตามลำดับเวลา',
      409,
      'VIDEO_SKIP_NOT_ALLOWED',
    );
  }

  return clampedIncomingSeconds;
}
