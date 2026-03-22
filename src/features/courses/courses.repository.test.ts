import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMocks = vi.hoisted(() => {
  const returning = vi.fn();
  const values = vi.fn(() => ({ returning }));
  const insert = vi.fn(() => ({ values }));
  const where = vi.fn();
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  const execute = vi.fn();
  const transaction = vi.fn(async (callback: (tx: {
    insert: typeof insert;
    select: typeof select;
    execute: typeof execute;
  }) => Promise<unknown>) => callback({ insert, select, execute }));

  return {
    transaction,
    insert,
    select,
    from,
    where,
    execute,
    values,
    returning,
  };
});

vi.mock('../../db/index.js', () => ({
  db: {
    transaction: dbMocks.transaction,
  },
}));

import { coursesRepository } from './courses.repository.js';

describe('coursesRepository.createVideoQuestionsBulk', () => {
  beforeEach(() => {
    dbMocks.transaction.mockClear();
    dbMocks.insert.mockClear();
    dbMocks.select.mockClear();
    dbMocks.from.mockClear();
    dbMocks.where.mockReset();
    dbMocks.execute.mockReset();
    dbMocks.values.mockClear();
    dbMocks.returning.mockReset();
    dbMocks.where.mockResolvedValue([{ maxSortOrder: -1 }]);
    dbMocks.execute.mockResolvedValue(undefined);
  });

  it('returns early when the payload is empty', async () => {
    expect(await coursesRepository.createVideoQuestionsBulk(55, [])).toEqual([]);
    expect(dbMocks.transaction).not.toHaveBeenCalled();
  });

  it('wraps the insert in a transaction and returns inserted rows', async () => {
    dbMocks.returning.mockResolvedValue([
      {
        id: 1,
        lessonId: 55,
        questionText: 'คำถามข้อ 1',
      },
    ]);

    const result = await coursesRepository.createVideoQuestionsBulk(55, [
      {
        questionText: 'คำถามข้อ 1',
        displayAtSeconds: 120,
        sortOrder: 0,
        questionType: 'MULTIPLE_CHOICE',
        options: [
          { id: 'a', text: 'A' },
          { id: 'b', text: 'B' },
        ],
      },
    ]);

    expect(dbMocks.transaction).toHaveBeenCalledTimes(1);
    expect(dbMocks.execute).toHaveBeenCalledTimes(1);
    expect(dbMocks.select).toHaveBeenCalledTimes(1);
    expect(dbMocks.insert).toHaveBeenCalledTimes(1);
    expect(dbMocks.values).toHaveBeenCalledTimes(1);
    expect(result).toEqual([
      {
        id: 1,
        lessonId: 55,
        questionText: 'คำถามข้อ 1',
      },
    ]);
  });
});
