import {
  EMAIL_MAX_LENGTH,
  NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_PATTERN,
  normalizeEmail,
} from '@atlas/shared';
import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

interface FieldOptions {
  /**
   * For partial updates (PATCH): the field may be omitted, but if present it is validated.
   * Unlike @IsOptional(), an explicit null is still validated (and rejected with 400).
   */
  optional?: boolean;
}

const optionalIf = (options: FieldOptions): PropertyDecorator[] =>
  options.optional ? [ValidateIf((_object, value) => value !== undefined)] : [];

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** BR-01: a valid e-mail, normalized to trimmed lower case before validation. */
export function IsAccountEmail(options: FieldOptions = {}): PropertyDecorator {
  return applyDecorators(
    ApiProperty({
      example: 'user@example.com',
      maxLength: EMAIL_MAX_LENGTH,
      required: !options.optional,
    }),
    ...optionalIf(options),
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? normalizeEmail(value) : value,
    ),
    IsEmail({}, { message: 'email must be a valid e-mail address' }),
    MaxLength(EMAIL_MAX_LENGTH),
  );
}

/** BR-02: the password policy for new passwords (register, change password). */
export function IsNewPassword(): PropertyDecorator {
  return applyDecorators(
    ApiProperty({
      example: 'Secret123',
      minLength: PASSWORD_MIN_LENGTH,
      maxLength: PASSWORD_MAX_LENGTH,
      description: 'At least 8 characters, at least one letter and one digit',
    }),
    IsString(),
    MinLength(PASSWORD_MIN_LENGTH),
    MaxLength(PASSWORD_MAX_LENGTH),
    Matches(PASSWORD_PATTERN, {
      message: 'password must contain at least one letter and one digit',
    }),
  );
}

/** An existing password: only presence and length are checked (the policy is not revealed). */
export function IsExistingPassword(): PropertyDecorator {
  return applyDecorators(
    ApiProperty({ example: 'Secret123' }),
    IsString(),
    IsNotEmpty(),
    MaxLength(PASSWORD_MAX_LENGTH),
  );
}

export function IsDisplayName(options: FieldOptions = {}): PropertyDecorator {
  return applyDecorators(
    ApiProperty({ example: 'Hanna', maxLength: NAME_MAX_LENGTH, required: !options.optional }),
    ...optionalIf(options),
    Transform(trim),
    IsString(),
    IsNotEmpty({ message: 'name must not be empty' }),
    MaxLength(NAME_MAX_LENGTH),
  );
}
