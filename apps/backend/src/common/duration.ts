const UNIT_MS = {
  ms: 1,
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
} as const;

const DURATION_PATTERN = /^(\d+)(ms|s|m|h|d)$/;

/**
 * Parses a duration such as "15m" or "7d" (the format of JWT_*_TTL in .env) into milliseconds.
 * One parser feeds both the JWT "exp" claim and the cookie Max-Age, so they cannot disagree.
 */
export function parseDuration(value: string): number {
  const match = DURATION_PATTERN.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid duration "${value}": expected <number><ms|s|m|h|d>, e.g. "15m"`);
  }
  const amount = Number(match[1]);
  if (amount <= 0) {
    throw new Error(`Invalid duration "${value}": must be greater than zero`);
  }
  return amount * UNIT_MS[match[2] as keyof typeof UNIT_MS];
}
