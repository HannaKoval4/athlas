import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import { drawQuestions, shuffle } from './draw';
import { bestResult, QuizzesService } from './quizzes.service';

/** A deterministic "random": returns the given values in a loop. */
function sequence(...values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length] ?? 0;
}

describe('drawQuestions (BR-09)', () => {
  const pool = Array.from({ length: 16 }, (_, i) => `q${i}`);

  it('draws the requested number of distinct questions', () => {
    const drawn = drawQuestions(pool, 10, sequence(0.42, 0.13, 0.99, 0.5));

    expect(drawn).toHaveLength(10);
    expect(new Set(drawn).size).toBe(10);
    expect(drawn.every((id) => pool.includes(id))).toBe(true);
  });

  it('takes the whole pool when it is smaller than an attempt', () => {
    expect(drawQuestions(['a', 'b', 'c'], 10).sort()).toEqual(['a', 'b', 'c']);
  });

  it('depends on the random numbers', () => {
    expect(drawQuestions(pool, 3, sequence(0))).not.toEqual(drawQuestions(pool, 3, sequence(0.99)));
  });

  it('shuffles without losing or changing items', () => {
    const items = ['a', 'b', 'c', 'd'];
    const shuffled = shuffle(items, sequence(0.7, 0.1, 0.4));

    expect([...shuffled].sort()).toEqual(items);
    expect(items).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('bestResult (BR-12)', () => {
  it('is the attempt with the maximum score', () => {
    expect(
      bestResult([
        { score: 6, total: 10, passed: false },
        { score: 9, total: 10, passed: true },
        { score: 7, total: 10, passed: true },
      ]),
    ).toEqual({ score: 9, total: 10, passed: true });
  });

  it('is null without finished attempts', () => {
    expect(bestResult([])).toBeNull();
    expect(bestResult([{ score: null, total: 10, passed: null }])).toBeNull();
  });
});

describe('QuizzesService.submit (BR-10, BR-11)', () => {
  const question = (id: string, multiple: boolean, correct: string[], wrong: string[]) => ({
    id,
    multiple,
    options: [
      ...correct.map((o) => ({ id: o, isCorrect: true })),
      ...wrong.map((o) => ({ id: o, isCorrect: false })),
    ],
  });

  const prisma = {
    quizAttempt: { findFirst: jest.fn<Promise<unknown>, [unknown]>() },
    question: { findMany: jest.fn<Promise<unknown[]>, [unknown]>() },
    $transaction: jest.fn<Promise<unknown>, [unknown]>(),
  };
  const service = new QuizzesService(prisma as unknown as PrismaService);
  const submit = (answers: { questionId: string; optionIds: string[] }[]) =>
    service.submit('attempt-1', 'user-1', { answers }, false);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.quizAttempt.findFirst.mockResolvedValue({
      quizId: 'quiz-1',
      questionIds: ['q1', 'q2'],
      finishedAt: null,
      quiz: { passPercent: 70 },
    });
    prisma.question.findMany.mockResolvedValue([
      question('q1', false, ['a'], ['b']),
      question('q2', true, ['c', 'd'], ['e']),
    ]);
  });

  it('answers 404 for an attempt of another user', async () => {
    prisma.quizAttempt.findFirst.mockResolvedValue(null);

    await expect(submit([])).rejects.toThrow(NotFoundException);
    expect(prisma.quizAttempt.findFirst.mock.calls[0]?.[0]).toMatchObject({
      where: { id: 'attempt-1', userId: 'user-1' },
    });
  });

  it('answers 409 for a finished attempt', async () => {
    prisma.quizAttempt.findFirst.mockResolvedValue({
      quizId: 'quiz-1',
      questionIds: ['q1'],
      finishedAt: new Date(),
      quiz: { passPercent: 70 },
    });

    await expect(submit([])).rejects.toThrow(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each([
    ['a question outside the attempt', [{ questionId: 'q9', optionIds: [] }]],
    ['an option of another question', [{ questionId: 'q1', optionIds: ['c'] }]],
    ['two options for a single-choice question', [{ questionId: 'q1', optionIds: ['a', 'b'] }]],
    [
      'the same question twice',
      [
        { questionId: 'q1', optionIds: ['a'] },
        { questionId: 'q1', optionIds: ['b'] },
      ],
    ],
  ])('answers 400 for %s', async (_name, answers) => {
    await expect(submit(answers)).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
