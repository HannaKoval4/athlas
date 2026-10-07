import type { RandomTopic } from '@atlas/shared';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { pickTopic, type TopicCandidate } from './pick-topic';

@Injectable()
export class RandomTopicService {
  constructor(private readonly prisma: PrismaService) {}

  async pick(userId: string, random: () => number = Math.random): Promise<RandomTopic> {
    const topic = pickTopic(await this.findCandidates(userId), random);
    if (!topic) throw new NotFoundException('The atlas has no published cards yet');
    return topic;
  }

  /**
   * BR-08: era + culture pairs with at least one published card in the intersection of the
   * era and culture periods (DM-03 overlap with [GREATEST(starts), LEAST(ends)]). For each
   * pair: the number of such cards, whether a quiz exists and whether this user passed it.
   * Ordered, so that the choice depends only on the random number.
   */
  findCandidates(userId: string): Promise<TopicCandidate[]> {
    return this.prisma.$queryRaw<TopicCandidate[]>`
      SELECT json_build_object('id', e.id, 'slug', e.slug, 'name', e.name) AS era,
             json_build_object('id', c.id, 'slug', c.slug, 'name', c.name, 'color', c.color)
               AS culture,
             GREATEST(e."startYear", c."startYear") AS "fromYear",
             LEAST(e."endYear", c."endYear") AS "toYear",
             COUNT(card.id)::int AS "cardsCount",
             (q.id IS NOT NULL) AS "hasQuiz",
             EXISTS (
               SELECT 1 FROM "QuizAttempt" a
               WHERE a."quizId" = q.id AND a."userId" = ${userId} AND a.passed
             ) AS "quizPassed"
      FROM "Era" e
      JOIN "Culture" c
        ON c."startYear" <= e."endYear" AND c."endYear" >= e."startYear"
      JOIN "Card" card
        ON card."cultureId" = c.id
       AND card.published
       AND card."startYear" <= LEAST(e."endYear", c."endYear")
       AND card."endYear" >= GREATEST(e."startYear", c."startYear")
      LEFT JOIN "Quiz" q ON q."eraId" = e.id AND q."cultureId" = c.id
      GROUP BY e.id, c.id, q.id
      ORDER BY e."sortOrder", e."startYear", c.name`;
  }
}
