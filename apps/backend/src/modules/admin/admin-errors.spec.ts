import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { adminWrite, assertNoIssue, toHttpError } from './admin-errors';

const prismaError = (code: string) => Object.assign(new Error(code), { code });

describe('toHttpError', () => {
  it('maps a unique violation (P2002) to 409', () => {
    const error = toHttpError(prismaError('P2002'), { conflict: 'Slug taken' });
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).message).toBe('Slug taken');
  });

  it('maps P2003 to 409 when the record is in use (BR-17), otherwise to 400', () => {
    expect(toHttpError(prismaError('P2003'), { inUse: 'Has cards' })).toBeInstanceOf(
      ConflictException,
    );
    expect(toHttpError(prismaError('P2003'), {})).toBeInstanceOf(BadRequestException);
  });

  it('maps a missing record (P2025) to 404', () => {
    expect(toHttpError(prismaError('P2025'), { notFound: 'Era not found' })).toBeInstanceOf(
      NotFoundException,
    );
  });

  it('passes other errors through unchanged', () => {
    const http = new BadRequestException('options: foreign id');
    expect(toHttpError(http, {})).toBe(http);
    const unknown = prismaError('P1001');
    expect(toHttpError(unknown, {})).toBe(unknown);
  });
});

describe('adminWrite', () => {
  it('returns the result of a successful write', async () => {
    await expect(adminWrite(() => Promise.resolve(42))).resolves.toBe(42);
  });

  it('rethrows a Prisma error as an HTTP error', async () => {
    await expect(
      adminWrite(() => Promise.reject(prismaError('P2025')), { notFound: 'Card not found' }),
    ).rejects.toThrow(new NotFoundException('Card not found'));
  });
});

describe('assertNoIssue', () => {
  it('throws 400 naming the field and the issue', () => {
    expect(() => assertNoIssue(null, 'period')).not.toThrow();
    expect(() => assertNoIssue('endBeforeStart', 'period')).toThrow(
      new BadRequestException('period: endBeforeStart'),
    );
  });
});
