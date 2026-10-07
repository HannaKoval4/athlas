import { IsAccountEmail, IsDisplayName, IsNewPassword } from './validators';

export class RegisterDto {
  @IsAccountEmail()
  email: string;

  @IsNewPassword()
  password: string;

  @IsDisplayName()
  name: string;
}
