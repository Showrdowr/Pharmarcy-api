import { describe, expect, it } from 'vitest';
import {
  assertLessonAccessibleForLearner,
  assertAllowedWatchedProgressAdvance,
  buildLockedLessonLearningPayload,
  calculateMonotonicWatchedSeconds,
  DEFAULT_ALLOWED_PROGRESS_ADVANCE_SECONDS,
  getLessonAccessState,
} from './learning-access.js';

function createAppError(message: string, statusCode = 400, code?: string) {
  return Object.assign(new Error(message), {
    statusCode,
    code,
  });
}

describe('learning-access', () => {
  it('builds a sanitized payload for locked lessons', () => {
    expect(buildLockedLessonLearningPayload({
      id: 2,
      title: 'บทเรียนที่ล็อก',
      sequenceOrder: 2,
    })).toEqual({
      id: 2,
      title: 'บทเรียนที่ล็อก',
      sequenceOrder: 2,
      status: 'locked',
      video: null,
      documents: [],
      interactiveQuestions: [],
      lessonQuiz: null,
      progress: {
        lastWatchedSeconds: 0,
        isCompleted: false,
      },
    });
  });

  it('returns access state for an unlocked lesson', () => {
    const accessState = getLessonAccessState(
      [
        { id: 1, title: 'บทที่ 1', sequenceOrder: 1 },
        { id: 2, title: 'บทที่ 2', sequenceOrder: 2 },
      ],
      [1],
      2,
      createAppError,
    );

    expect(accessState.lesson.id).toBe(2);
    expect(accessState.isUnlocked).toBe(true);
  });

  it('throws LESSON_LOCKED when trying to access a locked lesson', () => {
    try {
      assertLessonAccessibleForLearner(
        [
          { id: 1, title: 'บทที่ 1', sequenceOrder: 1 },
          { id: 2, title: 'บทที่ 2', sequenceOrder: 2 },
        ],
        [],
        2,
        createAppError,
      );
      throw new Error('Expected LESSON_LOCKED error');
    } catch (error) {
      expect(error).toMatchObject({
        message: 'กรุณาเรียนบทก่อนหน้าให้เสร็จก่อน',
        statusCode: 409,
        code: 'LESSON_LOCKED',
      });
    }
  });

  it('throws 404 when the lesson id is missing from the snapshot', () => {
    try {
      getLessonAccessState(
        [{ id: 1, title: 'บทที่ 1', sequenceOrder: 1 }],
        [],
        99,
        createAppError,
      );
      throw new Error('Expected 404 lesson error');
    } catch (error) {
      expect(error).toMatchObject({
        message: 'Lesson not found',
        statusCode: 404,
      });
    }
  });

  it('keeps watched seconds monotonic and clamps to duration', () => {
    expect(calculateMonotonicWatchedSeconds(135, 130, 600)).toBe(135);
    expect(calculateMonotonicWatchedSeconds(135, 999, 600)).toBe(600);
    expect(calculateMonotonicWatchedSeconds(0, 45, null)).toBe(45);
  });

  it('allows watched progress to advance within the accepted contiguous window', () => {
    expect(assertAllowedWatchedProgressAdvance(120, 145, 600, createAppError)).toBe(145);
    expect(assertAllowedWatchedProgressAdvance(120, 999, 130, createAppError)).toBe(130);
  });

  it('throws VIDEO_SKIP_NOT_ALLOWED when watched progress jumps too far ahead', () => {
    try {
      assertAllowedWatchedProgressAdvance(
        120,
        120 + DEFAULT_ALLOWED_PROGRESS_ADVANCE_SECONDS + 5,
        600,
        createAppError,
      );
      throw new Error('Expected VIDEO_SKIP_NOT_ALLOWED error');
    } catch (error) {
      expect(error).toMatchObject({
        message: 'ไม่สามารถข้ามวิดีโอไปข้างหน้าได้ กรุณาเรียนตามลำดับเวลา',
        statusCode: 409,
        code: 'VIDEO_SKIP_NOT_ALLOWED',
      });
    }
  });
});
