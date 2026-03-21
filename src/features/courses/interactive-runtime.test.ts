import { describe, expect, it } from 'vitest';
import { isInteractiveQuestionAnswered, sortInteractiveQuestions } from './interactive-runtime.js';

describe('interactive-runtime', () => {
  it('sorts questions by display time, sort order, and id', () => {
    const questions = sortInteractiveQuestions([
      { id: 9, displayAtSeconds: 180, sortOrder: 1 },
      { id: 2, displayAtSeconds: 120, sortOrder: 2 },
      { id: 1, displayAtSeconds: 120, sortOrder: 1 },
    ]);

    expect(questions.map((question) => question.id)).toEqual([1, 2, 9]);
  });

  it('treats an older answer as stale after the question is updated', () => {
    const answered = isInteractiveQuestionAnswered(
      {
        id: 1,
        displayAtSeconds: 120,
        sortOrder: 1,
        updatedAt: '2026-03-21T12:00:00.000Z',
      },
      {
        updatedAt: '2026-03-21T11:00:00.000Z',
      }
    );

    expect(answered).toBe(false);
  });

  it('treats an answer updated after the question timestamp as valid', () => {
    const answered = isInteractiveQuestionAnswered(
      {
        id: 1,
        displayAtSeconds: 120,
        sortOrder: 1,
        updatedAt: '2026-03-21T11:00:00.000Z',
      },
      {
        updatedAt: '2026-03-21T12:00:00.000Z',
      }
    );

    expect(answered).toBe(true);
  });
});
