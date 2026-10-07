import { IsExistingPassword, IsNewPassword } from '../../auth/dto/validators';

export class ChangePasswordDto {
  @IsExistingPassword()
  currentPassword: string;

  @IsNewPassword()
  newPassword: string;
}
