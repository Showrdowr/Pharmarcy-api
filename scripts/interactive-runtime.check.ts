import assert from 'node:assert/strict';
import {
  isInteractiveQuestionAnswered,
  sortInteractiveQuestions,
} from '../src/features/courses/interactive-runtime.ts';

const sorted = sortInteractiveQuestions([
  { id: 3, displayAtSeconds: 45, sortOrder: 2 },
  { id: 1, displayAtSeconds: 30, sortOrder: 1 },
  { id: 2, displayAtSeconds: 45, sortOrder: 1 },
  { id: 4, displayAtSeconds: 45, sortOrder: 1 },
]);

assert.deepEqual(sorted.map((question) => question.id), [1, 2, 4, 3]);

const question = {
  id: 10,
  updatedAt: '2026-03-20T10:00:00.000Z',
  createdAt: '2026-03-20T09:00:00.000Z',
};

assert.equal(
  isInteractiveQuestionAnswered(question, {
    updatedAt: '2026-03-20T10:00:00.000Z',
    createdAt: '2026-03-20T09:30:00.000Z',
  }),
  true,
);

assert.equal(
  isInteractiveQuestionAnswered(question, {
    updatedAt: '2026-03-20T09:59:59.000Z',
    createdAt: '2026-03-20T09:30:00.000Z',
  }),
  false,
);

assert.equal(isInteractiveQuestionAnswered(question, null), false);

console.log('interactive-runtime.check: ok');
