import * as shared from '@atlas/shared';
import * as prisma from '../generated/prisma/enums';

// The frontend uses enums from @atlas/shared; the backend and DB use the Prisma ones.
// This test fails as soon as the two definitions drift apart.
describe('shared enums mirror Prisma enums', () => {
  it.each([
    ['CardType', shared.CardType, prisma.CardType],
    ['RelationType', shared.RelationType, prisma.RelationType],
    ['HolidayDateType', shared.HolidayDateType, prisma.HolidayDateType],
    ['Season', shared.Season, prisma.Season],
    ['SourceType', shared.SourceType, prisma.SourceType],
    ['Role', shared.Role, prisma.Role],
    ['ThemePreference', shared.ThemePreference, prisma.ThemePreference],
    ['Locale', shared.Locale, prisma.Locale],
  ])('%s', (_name, sharedEnum, prismaEnum) => {
    expect(sharedEnum).toEqual(prismaEnum);
  });
});
