import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, ValidateIf } from 'class-validator';
import { Locale, ThemePreference } from '../../../generated/prisma/enums';
import { IsAccountEmail, IsDisplayName } from '../../auth/dto/validators';

/** PATCH semantics: only the fields present in the body are changed. */
export class UpdateProfileDto {
  @IsDisplayName({ optional: true })
  name?: string;

  @IsAccountEmail({ optional: true })
  email?: string;

  @ApiProperty({ enum: ThemePreference, required: false })
  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(ThemePreference)
  theme?: ThemePreference;

  @ApiProperty({ enum: Locale, required: false })
  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(Locale)
  locale?: Locale;
}
