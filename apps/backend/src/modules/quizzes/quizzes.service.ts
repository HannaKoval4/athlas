import {
  ERA_STUDIED_TITLE_KEY,
  eraStudiedCode,
  isExactMatch,
  isPassed,
  type QuizBest,
} from '@atlas/shared';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { cultureRefSelect } from '../cards/cards.service';
import { drawQuestions, shuffle } from './draw';
import type {
  AchievementDto,
  AttemptResultDto,
  QuizSummaryDto,
  QuizzesQueryDto,
  StartedAttemptDto,
  SubmitAttemptDto,
} from './dto/quiz.dto';

const quizSelect = {
  id: true,
  title: true,
  questionsPerAttempt: true,
  passPercent: true,
  era: { select: { id: true, slug: true, name: true } },
  culture: { select: cultureRefSelect },
  _count: { select: { questions: true } },
} satisfies Prisma.QuizSelect;

type QuizRow = Prisma.QuizGetPayload<{ select: typeof quizSelect }>;

const achievementSelect = {
  earnedAt: true,
  achievement: {
    select: {
      code: true,
      titleKey: true,
      quiz: {
        select: {
          id: true,
          title: true,
          era: { select: { id: true, slug: true, name: true } },
          culture: { select: cultureRefSelect },
        },
      },
    },
  },
} satisfies Prisma.UserAchievementSelect;

type UserAchievementRow = Prisma.UserAchievementGetPayload<{ select: typeof achievementSelect }>;

interface Progress {
  best: QuizBest | null;
  attempts: number;
}

/** BR-12: the best result is the maximum score among finished attempts. */
export function bestResult(
  attempts: readonly { score: number | null; total: number; passed: boolean | null }[],
): QuizBest | null {
  let best: QuizBest | null = null;
  for (const attempt of attempts) {
    if (attempt.score === null) continue;
    if (!best || attempt.score > best.score) {
      best = { score: attempt.score, total: attempt.total, passed: attempt.passed ?? false };
    }
  }
  return best;
}

function toAchievement(row: UserAchievementRow): AchievementDto {
  return {
    code: row.achievement.code,
    titleKey: row.achievement.titleKey,
    quiz: row.achievement.quiz,
    earnedAt: row.earnedAt.toISOString(),
  };
}

@Injectable()
export class QuizzesService {
  constructor(private readonly prisma: PrismaService) {}

  /** F-15: quizzes of an era and/or a culture with the user's best result and attempts. */
  async findMany(query: QuizzesQueryDto, userId: string): Promise<QuizSummaryDto[]> {
    const quizzes = await this.prisma.quiz.findMany({
      where: { eraId: query.eraId, cultureId: query.cultureId },
      select: quizSelect,
      orderBy: [{ era: { sortOrder: 'asc' } }, { culture: { name: 'asc' } }],
    });
    const progress = await this.progress(
      userId,
      quizzes.map((quiz) => quiz.id),
    );
    return quizzes.map((quiz) => this.toSummary(quiz, progress.get(quiz.id)));
  }

  async findOne(quizId: string, userId: string): Promise<QuizSummaryDto> {
    const quiz = await this.prisma.quiz.findUnique({ where: { id: quizId }, select: quizSelect });
    if (!quiz) throw new NotFoundException(`Quiz ${quizId} not found`);
    const progress = await this.progress(userId, [quizId]);
    return this.toSummary(quiz, progress.get(quizId));
  }

  /**
   * BR-09: a new attempt with `questionsPerAttempt` random questions of the pool (the whole
   * pool if it is smaller) and options in random order. The drawn questions are stored in
   * the attempt, so only they can be answered; isCorrect is never sent before the submit.
   */
  async start(
    quizId: string,
    userId: string,
    random: () => number = Math.random,
  ): Promise<StartedAttemptDto> {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      select: { questionsPerAttempt: true, questions: { select: { id: true } } },
    });
    if (!quiz) throw new NotFoundException(`Quiz ${quizId} not found`);
    if (quiz.questions.length === 0) throw new ConflictException('The quiz has no questions yet');

    const questionIds = drawQuestions(
      quiz.questions.map((question) => question.id),
      quiz.questionsPerAttempt,
      random,
    );
    const attempt = await this.prisma.quizAttempt.create({
      data: { userId, quizId, questionIds, total: questionIds.length },
      select: { id: true },
    });
    const questions = await this.prisma.question.findMany({
      where: { id: { in: questionIds } },
      select: {
        id: true,
        text: true,
        multiple: true,
        options: { select: { id: true, text: true } },
      },
    });
    const byId = new Map(questions.map((question) => [question.id, question]));

    return {
      id: attempt.id,
      quiz: await this.findOne(quizId, userId),
      questions: questionIds.flatMap((id) => {
        const question = byId.get(id);
        return question ? [{ ...question, options: shuffle(question.options, random) }] : [];
      }),
    };
  }

  /**
   * BR-10…BR-13: checks the answers on the server and finishes the attempt.
   * - Someone else's attempt is 404 (it is private, like notes).
   * - A finished attempt cannot be submitted again: 409 (BR-11). The check and the update are
   *   one conditional UPDATE, so two parallel submits cannot both succeed.
   * - Answers may only refer to the questions of this attempt and to their own options.
   *   A skipped question counts as wrong.
   * - The first passed attempt earns "Эпоха изучена" (BR-13); later passes earn nothing new.
   */
  async submit(
    attemptId: string,
    userId: string,
    dto: SubmitAttemptDto,
    includeDrafts: boolean,
  ): Promise<AttemptResultDto> {
    const attempt = await this.prisma.quizAttempt.findFirst({
      where: { id: attemptId, userId },
      select: {
        quizId: true,
        questionIds: true,
        finishedAt: true,
        quiz: { select: { passPercent: true } },
      },
    });
    if (!attempt) throw new NotFoundException(`Attempt ${attemptId} not found`);
    if (attempt.finishedAt) throw new ConflictException('The attempt is already finished');

    const questions = await this.prisma.question.findMany({
      where: { id: { in: attempt.questionIds } },
      select: { id: true, multiple: true, options: { select: { id: true, isCorrect: true } } },
    });
    const byId = new Map(questions.map((question) => [question.id, question]));

    const selected = new Map<string, string[]>();
    for (const answer of dto.answers) {
      const question = byId.get(answer.questionId);
      if (!question) {
        throw new BadRequestException(`Question ${answer.questionId} is not in this attempt`);
      }
      if (selected.has(answer.questionId)) {
        throw new BadRequestException(`Question ${answer.questionId} is answered twice`);
      }
      const optionIds = [...new Set(answer.optionIds)];
      const own = new Set(question.options.map((option) => option.id));
      if (optionIds.some((id) => !own.has(id))) {
        throw new BadRequestException(`An option does not belong to question ${question.id}`);
      }
      if (!question.multiple && optionIds.length > 1) {
        throw new BadRequestException(`Question ${question.id} has a single correct option`);
      }
      selected.set(question.id, optionIds);
    }

    // Questions deleted by an admin since the start are not counted.
    const graded = attempt.questionIds.flatMap((id) => {
      const question = byId.get(id);
      if (!question) return [];
      const optionIds = selected.get(id) ?? [];
      const correct = question.options.filter((o) => o.isCorrect).map((o) => o.id);
      return [
        {
          questionId: id,
          selectedOptionIds: optionIds,
          isCorrect: isExactMatch(optionIds, correct),
        },
      ];
    });
    const score = graded.filter((answer) => answer.isCorrect).length;
    const total = graded.length;
    const passed = isPassed(score, total, attempt.quiz.passPercent);

    const newAchievement = await this.prisma.$transaction(async (tx) => {
      const finished = await tx.quizAttempt.updateMany({
        where: { id: attemptId, finishedAt: null },
        data: { finishedAt: new Date(), score, total, passed },
      });
      if (finished.count === 0) throw new ConflictException('The attempt is already finished');
      await tx.attemptAnswer.createMany({
        data: graded.map((answer) => ({ attemptId, ...answer })),
      });
      if (!passed) return null;

      const code = eraStudiedCode(attempt.quizId);
      const achievement = await tx.achievement.upsert({
        where: { code },
        update: {},
        create: {
          code,
          titleKey: ERA_STUDIED_TITLE_KEY,
          descriptionKey: `${ERA_STUDIED_TITLE_KEY}Description`,
          quizId: attempt.quizId,
        },
        select: { id: true },
      });
      const earned = await tx.userAchievement.createMany({
        data: [{ userId, achievementId: achievement.id }],
        skipDuplicates: true,
      });
      if (earned.count === 0) return null;
      return tx.userAchievement.findUniqueOrThrow({
        where: { userId_achievementId: { userId, achievementId: achievement.id } },
        select: achievementSelect,
      });
    });

    const result = await this.result(attemptId, userId, includeDrafts);
    return { ...result, newAchievement: newAchievement && toAchievement(newAchievement) };
  }

  /** BR-14: the result and the review of a finished attempt of this user. */
  async result(
    attemptId: string,
    userId: string,
    includeDrafts: boolean,
  ): Promise<AttemptResultDto> {
    const attempt = await this.prisma.quizAttempt.findFirst({
      where: { id: attemptId, userId },
      select: {
        quizId: true,
        questionIds: true,
        finishedAt: true,
        score: true,
        total: true,
        passed: true,
        answers: { select: { questionId: true, selectedOptionIds: true, isCorrect: true } },
      },
    });
    if (!attempt) throw new NotFoundException(`Attempt ${attemptId} not found`);
    if (!attempt.finishedAt) throw new ConflictException('The attempt is not finished yet');

    const questions = await this.prisma.question.findMany({
      where: { id: { in: attempt.questionIds } },
      select: {
        id: true,
        text: true,
        multiple: true,
        explanation: true,
        options: { select: { id: true, text: true, isCorrect: true }, orderBy: { text: 'asc' } },
        card: { select: { slug: true, title: true, published: true } },
      },
    });
    const questionsById = new Map(questions.map((question) => [question.id, question]));
    const answers = new Map(attempt.answers.map((answer) => [answer.questionId, answer]));

    return {
      id: attemptId,
      quiz: await this.findOne(attempt.quizId, userId),
      score: attempt.score ?? 0,
      total: attempt.total,
      passed: attempt.passed ?? false,
      finishedAt: attempt.finishedAt.toISOString(),
      review: attempt.questionIds.flatMap((id) => {
        const question = questionsById.get(id);
        const answer = answers.get(id);
        if (!question || !answer) return [];
        const { card, ...rest } = question;
        return [
          {
            ...rest,
            selectedOptionIds: answer.selectedOptionIds,
            isCorrect: answer.isCorrect,
            card:
              card && (includeDrafts || card.published)
                ? { slug: card.slug, title: card.title }
                : null,
          },
        ];
      }),
      newAchievement: null,
    };
  }

  /** F-16: the user's achievements, newest first. */
  async achievements(userId: string): Promise<AchievementDto[]> {
    const rows = await this.prisma.userAchievement.findMany({
      where: { userId },
      select: achievementSelect,
      orderBy: { earnedAt: 'desc' },
    });
    return rows.map(toAchievement);
  }

  private async progress(userId: string, quizIds: string[]): Promise<Map<string, Progress>> {
    const attempts = await this.prisma.quizAttempt.findMany({
      where: { userId, quizId: { in: quizIds }, finishedAt: { not: null } },
      select: { quizId: true, score: true, total: true, passed: true },
    });
    const byQuiz = new Map<string, typeof attempts>();
    for (const attempt of attempts) {
      byQuiz.set(attempt.quizId, [...(byQuiz.get(attempt.quizId) ?? []), attempt]);
    }
    return new Map(
      [...byQuiz].map(([quizId, rows]) => [
        quizId,
        { best: bestResult(rows), attempts: rows.length },
      ]),
    );
  }

  private toSummary(quiz: QuizRow, progress?: Progress): QuizSummaryDto {
    const { _count, ...rest } = quiz;
    return {
      ...rest,
      poolSize: _count.questions,
      best: progress?.best ?? null,
      attempts: progress?.attempts ?? 0,
    };
  }
}
