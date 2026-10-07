import type { UserProfile } from '@atlas/shared';
import { ApiProperty } from '@nestjs/swagger';
import type { User } from '../../generated/prisma/client';
import { Locale, Role, ThemePreference } from '../../generated/prisma/enums';

/** Response shape of /auth/* and /users/me. Built by an explicit whitelist, never by spreading User. */
export class UserProfileDto implements UserProfile {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @ApiProperty({ example: 'Hanna' })
  name: string;

  @ApiProperty({ enum: Role })
  role: Role;

  @ApiProperty({ enum: ThemePreference })
  theme: ThemePreference;

  @ApiProperty({ enum: Locale })
  locale: Locale;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'When consent to personal data processing was given; null for seeded accounts',
  })
  consentAt: string | null;
}

export function toUserProfile(user: User): UserProfileDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    theme: user.theme,
    locale: user.locale,
    createdAt: user.createdAt.toISOString(),
    consentAt: user.consentAt?.toISOString() ?? null,
  };
}
