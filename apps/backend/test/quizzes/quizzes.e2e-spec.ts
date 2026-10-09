import type {
  Achievement,
  AttemptResult,
  QuizSummary,
  StartedAttempt,
  SubmittedAnswer,
} from '@atlas/shared';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import type { App } from 'supertest/types';
import type { PrismaClient } from '../../src/generated/prisma/client';
import { createCard, createCulture, createEra } from '../factories';
import { createTestApp, json } from '../utils/app';
import { createTestPrisma, truncateAll } from '../utils/db';

const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

describe('Quizzes and achievements (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let reader: TestAgent;
  let other: TestAgent;
  let cultureId = '';
  let mainQuizId = ''; // 12 single-choice questions, 10 per attempt, 70 % to pass
  let smallQuizId = ''; // 2 single-choice + 1 multiple-choice question
  let emptyQuizId = '';

  const server = () => app.getHttpServer();

  async function signIn(email: string): Promise<TestAgent> {
    const agent = request.agent(server());
    await agent
      .post('/api/auth/register')
      .send({ email, password: 'Secret123', name: 'Reader', consent: true })
      .expect(201);
    return agent;
  }

  async function createQuiz(
    eraSlug: string,
    questions: { correct: string[]; wrong: string[]; cardId?: string }[],
  ) {
    const era = await createEra(prisma, { slug: eraSlug, startYear: -800, endYear: -1 });
    return prisma.quiz.create({
      data: {
        eraId: era.id,
        cultureId,
        title: `Quiz ${eraSlug}`,
        questions: {
          create: questions.map((q, i) => ({
            text: `Question ${i + 1}`,
            explanation: `Because ${i + 1}`,
            multiple: q.correct.length > 1,
            cardId: q.cardId,
            options: {
              create: [
                ...q.correct.map((text) => ({ text, isCorrect: true })),
                ...q.wrong.map((text) => ({ text, isCorrect: false })),
              ],
            },
          })),
        },
      },
    });
  }

  async function start(agent: TestAgent, quizId: string) {
    return json<StartedAttempt>(await agent.post(`/api/quizzes/${quizId}/attempts`).expect(201));
  }

  /** Answers the first `right` questions correctly and the rest with a wrong option. */
  async function answers(attempt: StartedAttempt, right: number): Promise<SubmittedAnswer[]> {
    const options = await prisma.answerOption.findMany({
      where: { questionId: { in: attempt.questions.map((q) => q.id) } },
    });
    return attempt.questions.map((question, index) => {
      const own = options.filter((o) => o.questionId === question.id);
      const pick =
        index < right ? own.filter((o) => o.isCorrect) : [own.find((o) => !o.isCorrect)!];
      return { questionId: question.id, optionIds: pick.map((o) => o.id) };
    });
  }

  async function submit(agent: TestAgent, attemptId: string, body: SubmittedAnswer[]) {
    return json<AttemptResult>(
      await agent
        .post(`/api/quizzes/attempts/${attemptId}/submit`)
        .send({ answers: body })
        .expect(200),
    );
  }

  beforeAll(async () => {
    prisma = createTestPrisma();
    await truncateAll(prisma);
    app = await createTestApp();

    cultureId = (await createCulture(prisma, { startYear: -800, endYear: -1 })).id;
    const published = await createCard(prisma, cultureId, { title: 'Парфенон' });
    const draft = await createCard(prisma, cultureId, { title: 'Черновик', published: false });

    const single = (cardId?: string) => ({ correct: ['Верно'], wrong: ['Неверно'], cardId });
    mainQuizId = (
      await createQuiz('main', [
        ...Array.from({ length: 11 }, () => single(published.id)),
        single(draft.id),
      ])
    ).id;
    smallQuizId = (
      await createQuiz('small', [single(), single(), { correct: ['А', 'Б'], wrong: ['В'] }])
    ).id;
    emptyQuizId = (await createQuiz('empty', [])).id;

    reader = await signIn('reader@example.com');
    other = await signIn('other@example.com');
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it.each([
    ['GET', '/api/quizzes'],
    ['GET', `/api/quizzes/${UNKNOWN_ID}`],
    ['POST', `/api/quizzes/${UNKNOWN_ID}/attempts`],
    ['POST', `/api/quizzes/attempts/${UNKNOWN_ID}/submit`],
    ['GET', `/api/quizzes/attempts/${UNKNOWN_ID}`],
    ['GET', '/api/users/me/achievements'],
  ])('%s %s requires authentication', async (method, url) => {
    const agent = request(server());
    await (method === 'GET' ? agent.get(url) : agent.post(url)).expect(401);
  });

  describe('GET /quizzes', () => {
    it('lists the quizzes of a culture with the pool size and no progress yet', async () => {
      const quizzes = json<QuizSummary[]>(
        await reader.get('/api/quizzes').query({ cultureId }).expect(200),
      );
      const main = quizzes.find((quiz) => quiz.id === mainQuizId);

      expect(quizzes).toHaveLength(3);
      expect(main).toMatchObject({
        questionsPerAttempt: 10,
        passPercent: 70,
        poolSize: 12,
        best: null,
        attempts: 0,
      });
    });

    it.each([
      [`/api/quizzes/${UNKNOWN_ID}`, 404],
      ['/api/quizzes/not-a-uuid', 400],
      ['/api/quizzes?cultureId=greece', 400],
    ])('GET %s answers %d', async (url, status) => {
      await reader.get(url).expect(status);
    });
  });

  describe('POST /quizzes/:id/attempts (BR-09)', () => {
    it('draws 10 distinct questions of the pool without revealing the answers', async () => {
      const attempt = await start(reader, mainQuizId);

      expect(attempt.questions).toHaveLength(10);
      expect(new Set(attempt.questions.map((q) => q.id)).size).toBe(10);
      for (const question of attempt.questions) {
        expect(question.options).toHaveLength(2);
        for (const option of question.options) expect(option).not.toHaveProperty('isCorrect');
      }
    });

    it('takes the whole pool when it is smaller than an attempt', async () => {
      const attempt = await start(reader, smallQuizId);

      expect(attempt.questions).toHaveLength(3);
      expect(attempt.questions.filter((q) => q.multiple)).toHaveLength(1);
    });

    it('answers 404 for an unknown quiz and 409 for a quiz without questions', async () => {
      await reader.post(`/api/quizzes/${UNKNOWN_ID}/attempts`).expect(404);
      await reader.post(`/api/quizzes/${emptyQuizId}/attempts`).expect(409);
    });
  });

  describe('POST /quizzes/attempts/:id/submit (BR-10 … BR-14)', () => {
    it.each([
      [7, true], // exactly 70 %
      [6, false],
    ])('%d of 10 correct: passed = %s (BR-11)', async (right, passed) => {
      const agent = await signIn(`pass-mark-${right}@example.com`);
      const attempt = await start(agent, mainQuizId);

      const result = await submit(agent, attempt.id, await answers(attempt, right));

      expect(result).toMatchObject({ score: right, total: 10, passed });
    });

    it('awards "Эпоха изучена" once, on the first pass (BR-13)', async () => {
      const agent = await signIn('achiever@example.com');
      const failed = await start(agent, mainQuizId);
      expect((await submit(agent, failed.id, await answers(failed, 0))).newAchievement).toBeNull();

      const first = await start(agent, mainQuizId);
      const passed = await submit(agent, first.id, await answers(first, 10));
      expect(passed.newAchievement).toMatchObject({
        titleKey: 'achievements.eraStudied',
        quiz: { id: mainQuizId },
      });

      const second = await start(agent, mainQuizId);
      const again = await submit(agent, second.id, await answers(second, 10));
      expect(again.passed).toBe(true);
      expect(again.newAchievement).toBeNull();

      const achievements = json<Achievement[]>(
        await agent.get('/api/users/me/achievements').expect(200),
      );
      expect(achievements).toHaveLength(1);
    });

    it('keeps the best score and counts finished attempts (BR-12)', async () => {
      const agent = await signIn('best@example.com');
      const good = await start(agent, mainQuizId);
      await submit(agent, good.id, await answers(good, 9));
      const bad = await start(agent, mainQuizId);
      await submit(agent, bad.id, await answers(bad, 3));
      await start(agent, mainQuizId); // unfinished: not counted

      const quiz = json<QuizSummary>(await agent.get(`/api/quizzes/${mainQuizId}`).expect(200));

      expect(quiz.best).toEqual({ score: 9, total: 10, passed: true });
      expect(quiz.attempts).toBe(2);
    });

    it('requires the exact set for a multiple-choice question (BR-10)', async () => {
      const attempt = await start(reader, smallQuizId);
      const multiple = attempt.questions.find((q) => q.multiple)!;
      const correct = await prisma.answerOption.findMany({
        where: { questionId: multiple.id, isCorrect: true },
      });

      const result = await submit(reader, attempt.id, [
        { questionId: multiple.id, optionIds: [correct[0].id] },
      ]);

      const review = result.review.find((q) => q.id === multiple.id)!;
      expect(review.isCorrect).toBe(false);
      // The two skipped questions count as wrong as well.
      expect(result).toMatchObject({ score: 0, total: 3, passed: false });

      const exact = await start(reader, smallQuizId);
      const exactResult = await submit(reader, exact.id, await answers(exact, 3));
      expect(exactResult.review.every((q) => q.isCorrect)).toBe(true);
    });

    it('reviews mistakes: correct options, explanation and the card (BR-14)', async () => {
      const attempt = await start(reader, mainQuizId);
      const result = await submit(reader, attempt.id, await answers(attempt, 0));

      for (const question of result.review) {
        expect(question.isCorrect).toBe(false);
        expect(question.options.filter((o) => o.isCorrect).map((o) => o.text)).toEqual(['Верно']);
        expect(question.explanation).toMatch(/^Because/);
        expect(question.selectedOptionIds).toHaveLength(1);
      }
      // The card of a question is linked only while it is published (BR-06).
      const cards = new Set(result.review.map((q) => q.card?.title ?? null));
      expect([...cards].every((title) => title === 'Парфенон' || title === null)).toBe(true);
      expect(cards.has('Черновик')).toBe(false);
    });

    it('answers 409 when the attempt is submitted again (BR-11)', async () => {
      const attempt = await start(reader, smallQuizId);
      const body = await answers(attempt, 3);
      await submit(reader, attempt.id, body);

      await reader
        .post(`/api/quizzes/attempts/${attempt.id}/submit`)
        .send({ answers: body })
        .expect(409);
    });

    it("hides another user's attempt (404)", async () => {
      const attempt = await start(reader, smallQuizId);

      await other
        .post(`/api/quizzes/attempts/${attempt.id}/submit`)
        .send({ answers: [] })
        .expect(404);
      await other.get(`/api/quizzes/attempts/${attempt.id}`).expect(404);
    });

    it('rejects answers that do not belong to the attempt (400)', async () => {
      const attempt = await start(reader, smallQuizId);
      const otherAttempt = await start(reader, mainQuizId);
      const [single] = attempt.questions.filter((q) => !q.multiple);
      const foreign = otherAttempt.questions[0];
      const url = `/api/quizzes/attempts/${attempt.id}/submit`;

      for (const body of [
        [{ questionId: foreign.id, optionIds: [] }],
        [{ questionId: single.id, optionIds: [foreign.options[0].id] }],
        [{ questionId: single.id, optionIds: single.options.map((o) => o.id) }],
        [{ questionId: single.id, optionIds: ['not-a-uuid'] }],
      ]) {
        await reader.post(url).send({ answers: body }).expect(400);
      }
      // A rejected submit leaves the attempt open.
      await submit(reader, attempt.id, await answers(attempt, 3));
    });
  });

  describe('GET /quizzes/attempts/:id', () => {
    it('returns the result of a finished attempt', async () => {
      const attempt = await start(reader, smallQuizId);
      const submitted = await submit(reader, attempt.id, await answers(attempt, 3));

      const result = json<AttemptResult>(
        await reader.get(`/api/quizzes/attempts/${attempt.id}`).expect(200),
      );

      expect(result).toMatchObject({ id: attempt.id, score: 3, total: 3, passed: true });
      expect(result.review).toEqual(submitted.review);
    });

    it('answers 409 for an unfinished attempt', async () => {
      const attempt = await start(reader, smallQuizId);

      await reader.get(`/api/quizzes/attempts/${attempt.id}`).expect(409);
    });
  });
});
