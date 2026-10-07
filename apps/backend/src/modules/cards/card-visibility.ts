import type { Prisma } from '../../generated/prisma/client';
import { Role } from '../../generated/prisma/enums';
import type { AuthUser } from '../auth/auth.types';

/** BR-06: users see only published cards; admins also see drafts. */
export function canSeeDrafts(user: AuthUser): boolean {
  return user.role === Role.ADMIN;
}

export function visibleCards(includeDrafts: boolean): Prisma.CardWhereInput {
  return includeDrafts ? {} : { published: true };
}

/** DM-03: the card's period contains the year. */
export function cardsInYear(year: number): Prisma.CardWhereInput {
  return { startYear: { lte: year }, endYear: { gte: year } };
}

/** DM-03: the card's period overlaps [startYear, endYear] (e.g. an era). */
export function cardsOverlapping(startYear: number, endYear: number): Prisma.CardWhereInput {
  return { startYear: { lte: endYear }, endYear: { gte: startYear } };
}
