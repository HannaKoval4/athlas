import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

function prismaCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
  return typeof error.code === 'string' ? error.code : undefined;
}

export interface WriteErrorMessages {
  /** P2002: a unique field (usually the slug) is taken */
  conflict?: string;
  /** P2003 on create/update: a referenced record does not exist */
  missingReference?: string;
  /** P2003 on delete: other records still reference this one (ON DELETE RESTRICT) */
  inUse?: string;
  /** P2025: the record to update/delete does not exist */
  notFound?: string;
}

/**
 * Turns the Prisma errors an admin write can cause into HTTP errors with a clear message.
 * The database constraints are the source of truth, so a check cannot race with a write.
 */
export function toHttpError(error: unknown, messages: WriteErrorMessages): unknown {
  switch (prismaCode(error)) {
    case 'P2002':
      return new ConflictException(messages.conflict ?? 'A record with this slug already exists');
    case 'P2003':
      return messages.inUse
        ? new ConflictException(messages.inUse)
        : new BadRequestException(
            messages.missingReference ?? 'A referenced record does not exist',
          );
    case 'P2025':
      return new NotFoundException(messages.notFound ?? 'Record not found');
    default:
      return error;
  }
}

/** Runs a write and rethrows its Prisma errors as HTTP errors (see toHttpError). */
export async function adminWrite<T>(write: () => Promise<T>, messages: WriteErrorMessages = {}) {
  try {
    return await write();
  } catch (error) {
    throw toHttpError(error, messages);
  }
}

/** 400 for a failed cross-field rule from @atlas/shared (null = valid). */
export function assertNoIssue(issue: string | null, field: string): void {
  if (issue !== null) throw new BadRequestException(`${field}: ${issue}`);
}
