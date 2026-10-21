import { MAX_YEAR, MIN_YEAR, SLUG_MAX_LENGTH, SLUG_PATTERN } from '@atlas/shared';
import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Field decorators of the admin write DTOs. Writes are full objects (PUT), so a missing
 * nullable field means null: those properties are declared with `= null` defaults.
 */

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** A blank optional string is stored as null. */
const trimToNull = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() || null : value;

export const SHORT_TEXT_MAX = 200;
export const LONG_TEXT_MAX = 20_000;

export function SlugField(): PropertyDecorator {
  return applyDecorators(
    ApiProperty({ example: 'parthenon', pattern: SLUG_PATTERN.source, maxLength: SLUG_MAX_LENGTH }),
    Transform(trim),
    IsString(),
    MaxLength(SLUG_MAX_LENGTH),
    Matches(SLUG_PATTERN, { message: '$property must be lowercase latin words joined by "-"' }),
  );
}

export function TextField(maxLength = SHORT_TEXT_MAX): PropertyDecorator {
  return applyDecorators(
    ApiProperty({ maxLength }),
    Transform(trim),
    IsString(),
    IsNotEmpty(),
    MaxLength(maxLength),
  );
}

export function NullableTextField(maxLength = SHORT_TEXT_MAX): PropertyDecorator {
  return applyDecorators(
    ApiPropertyOptional({ type: String, nullable: true, maxLength }),
    Transform(trimToNull),
    IsOptional(),
    IsString(),
    MaxLength(maxLength),
  );
}

/** A historical year; year 0 and start > end are checked with periodIssue (DM-01, DM-02). */
export function YearField(): PropertyDecorator {
  return applyDecorators(
    ApiProperty({ minimum: MIN_YEAR, maximum: MAX_YEAR, example: -450 }),
    IsInt(),
    Min(MIN_YEAR),
    Max(MAX_YEAR),
  );
}

export function IntField(min: number, max: number): PropertyDecorator {
  return applyDecorators(ApiProperty({ minimum: min, maximum: max }), IsInt(), Min(min), Max(max));
}

export function NullableIntField(min: number, max: number): PropertyDecorator {
  return applyDecorators(
    ApiPropertyOptional({ type: Number, nullable: true, minimum: min, maximum: max }),
    IsOptional(),
    IsInt(),
    Min(min),
    Max(max),
  );
}

export function BooleanField(): PropertyDecorator {
  return applyDecorators(ApiProperty(), IsBoolean());
}

export function UuidField(): PropertyDecorator {
  return applyDecorators(ApiProperty({ format: 'uuid' }), IsUUID());
}

export function NullableUuidField(): PropertyDecorator {
  return applyDecorators(
    ApiPropertyOptional({ type: String, format: 'uuid', nullable: true }),
    IsOptional(),
    IsUUID(),
  );
}
