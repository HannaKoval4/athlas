/**
 * True for Prisma's "Unique constraint failed" error (P2002).
 * Duck-typed on `code` so it works regardless of which copy of the client class threw it.
 */
export function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}
