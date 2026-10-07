import { ApiProperty } from '@nestjs/swagger';
import { Equals } from 'class-validator';
import { IsAccountEmail, IsDisplayName, IsNewPassword } from './validators';

export const CONSENT_REQUIRED = 'Consent to personal data processing is required';

export class RegisterDto {
  @IsAccountEmail()
  email: string;

  @IsNewPassword()
  password: string;

  @IsDisplayName()
  name: string;

  /** The "I agree to the processing of my personal data" checkbox; only `true` is accepted. */
  @ApiProperty({ example: true, description: 'Consent to personal data processing; must be true' })
  @Equals(true, { message: CONSENT_REQUIRED })
  consent: boolean;
}
