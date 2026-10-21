import { type AdminQuestion, type AdminQuiz, questionOptionsIssue } from '@atlas/shared';
import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { cultureRefSelect } from '../cards/cards.service';
import { adminWrite, assertNoIssue } from './admin-errors';
import type { QuestionInputDto, QuizInputDto } from './dto/quizzes.dto';

const quizSelect = {
  id: true,
  eraId: true,
  cultureId: true,
  title: true,
  questionsPerAttempt: true,
  passPercent: true,
  era: { select: { id: true, slug: true, name: true } },
  culture: { select: cultureRefSelect },
  _count: { select: { questions: true } },
} satisfies Prisma.QuizSelect;

type QuizRow = Prisma.QuizGetPayload<{ select: typeof quizSelect }>;

const questionSelect = {
  id: true,
  quizId: true,
  text: true,
  explanation: true,
  multiple: true,
  cardId: true,
  card: { select: { id: true, slug: true, title: true } },
  // Creation order is not stored, so options are listed by text (the attempt shuffles them).
  options: { select: { id: true, text: true, isCorrect: true }, orderBy: { text: 'asc' } },
} satisfies Prisma.QuestionSelect;

const QUIZ_CONFLICT = 'A quiz for this era and culture already exists';

/**
 * F-18: quizzes (one per era + culture, DM-08) and their question pools.
 * A question is saved together with its answer options. Existing options are updated in place
 * (matched by id), so finished attempts that refer to them keep a readable review (BR-14).
 */
@Injectable()
export class AdminQuizzesService {
  constructor(private readonly prisma: PrismaService) {}

  async findQuizzes(): Promise<AdminQuiz[]> {
    const rows = await this.prisma.quiz.findMany({
      select: quizSelect,
      orderBy: [{ era: { sortOrder: 'asc' } }, { culture: { name: 'asc' } }],
    });
    return rows.map(toAdminQuiz);
  }

  async createQuiz(dto: QuizInputDto): Promise<AdminQuiz> {
    const quiz = await adminWrite(
      () => this.prisma.quiz.create({ data: { ...dto }, select: quizSelect }),
      { conflict: QUIZ_CONFLICT, missingReference: 'Unknown era or culture' },
    );
    return toAdminQuiz(quiz);
  }

  async updateQuiz(id: string, dto: QuizInputDto): Promise<AdminQuiz> {
    const quiz = await adminWrite(
      () => this.prisma.quiz.update({ where: { id }, data: { ...dto }, select: quizSelect }),
      {
        notFound: 'Quiz not found',
        conflict: QUIZ_CONFLICT,
        missingReference: 'Unknown era or culture',
      },
    );
    return toAdminQuiz(quiz);
  }

  /** Questions, attempts and the quiz's achievement are deleted with it (ON DELETE CASCADE). */
  async removeQuiz(id: string): Promise<void> {
    await adminWrite(() => this.prisma.quiz.delete({ where: { id } }), {
      notFound: 'Quiz not found',
    });
  }

  findQuestions(quizId: string): Promise<AdminQuestion[]> {
    return this.prisma.question.findMany({
      where: { quizId },
      select: questionSelect,
      orderBy: { text: 'asc' },
    });
  }

  createQuestion(dto: QuestionInputDto): Promise<AdminQuestion> {
    assertNoIssue(questionOptionsIssue(dto.multiple, dto.options), 'options');
    if (dto.options.some((option) => option.id !== undefined)) {
      throw new BadRequestException('options: a new question cannot reuse option ids');
    }
    const { options, ...question } = dto;
    return adminWrite(
      () =>
        this.prisma.question.create({
          data: {
            ...question,
            options: { create: options.map(({ text, isCorrect }) => ({ text, isCorrect })) },
          },
          select: questionSelect,
        }),
      { missingReference: 'Unknown quiz or card' },
    );
  }

  /**
   * Replaces the option list: options with an id are updated, options without one are created,
   * the rest are deleted. An id of another question's option is rejected.
   */
  updateQuestion(id: string, dto: QuestionInputDto): Promise<AdminQuestion> {
    assertNoIssue(questionOptionsIssue(dto.multiple, dto.options), 'options');
    const { options, ...question } = dto;
    const keptIds = options.flatMap((option) => (option.id ? [option.id] : []));
    if (new Set(keptIds).size !== keptIds.length) {
      throw new BadRequestException('options: duplicate option id');
    }
    return adminWrite(
      () =>
        this.prisma.$transaction(async (tx) => {
          await tx.question.update({ where: { id }, data: question });
          const own = await tx.answerOption.findMany({
            where: { questionId: id },
            select: { id: true },
          });
          const ownIds = new Set(own.map((option) => option.id));
          if (keptIds.some((optionId) => !ownIds.has(optionId))) {
            throw new BadRequestException('options: an option id does not belong to this question');
          }
          await tx.answerOption.deleteMany({ where: { questionId: id, id: { notIn: keptIds } } });
          for (const option of options) {
            const data = { text: option.text, isCorrect: option.isCorrect };
            if (option.id) {
              await tx.answerOption.update({ where: { id: option.id }, data });
            } else {
              await tx.answerOption.create({ data: { ...data, questionId: id } });
            }
          }
          return tx.question.findUniqueOrThrow({ where: { id }, select: questionSelect });
        }),
      { notFound: 'Question not found', missingReference: 'Unknown quiz or card' },
    );
  }

  /**
   * Answers to the question in past attempts go with it; the attempt keeps its score,
   * and its review simply skips the deleted question.
   */
  async removeQuestion(id: string): Promise<void> {
    await adminWrite(() => this.prisma.question.delete({ where: { id } }), {
      notFound: 'Question not found',
    });
  }
}

function toAdminQuiz({ _count, ...quiz }: QuizRow): AdminQuiz {
  return { ...quiz, questionCount: _count.questions };
}
