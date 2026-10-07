import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ChangePasswordDto } from '../../users/dto/change-password.dto';
import { UpdateProfileDto } from '../../users/dto/update-profile.dto';
import { LoginDto } from './login.dto';
import { RegisterDto } from './register.dto';

/** Mirrors the global ValidationPipe: transform first, then validate. Returns failed property names. */
function errorsOf<T extends object>(cls: new () => T, body: object): { dto: T; failed: string[] } {
  const dto = plainToInstance(cls, body);
  const failed = validateSync(dto, { whitelist: true, forbidNonWhitelisted: true }).map(
    (error) => error.property,
  );
  return { dto, failed };
}

describe('Auth DTO validation', () => {
  const validRegister = {
    email: 'user@example.com',
    password: 'Secret123',
    name: 'User',
    consent: true,
  };

  describe('RegisterDto', () => {
    it.each([false, undefined, 'true', 1])('requires consent === true (got %p)', (consent) => {
      expect(errorsOf(RegisterDto, { ...validRegister, consent }).failed).toEqual(['consent']);
    });

    it('accepts valid input', () => {
      expect(errorsOf(RegisterDto, validRegister).failed).toEqual([]);
    });

    it('normalizes the e-mail to trimmed lower case (BR-01)', () => {
      const { dto } = errorsOf(RegisterDto, { ...validRegister, email: '  User@Example.COM ' });

      expect(dto.email).toBe('user@example.com');
    });

    it('trims the name and rejects a whitespace-only name', () => {
      expect(errorsOf(RegisterDto, { ...validRegister, name: '  Ann  ' }).dto.name).toBe('Ann');
      expect(errorsOf(RegisterDto, { ...validRegister, name: '   ' }).failed).toEqual(['name']);
    });

    it.each([
      ['Secret1', 'too short (7)'],
      ['SecretPassword', 'no digit'],
      ['12345678', 'no letter'],
    ])('rejects password %p: %s (BR-02)', (password) => {
      expect(errorsOf(RegisterDto, { ...validRegister, password }).failed).toEqual(['password']);
    });

    it.each(['not-an-email', 'user@', '@example.com', ''])('rejects e-mail %p', (email) => {
      expect(errorsOf(RegisterDto, { ...validRegister, email }).failed).toEqual(['email']);
    });

    it('rejects unknown fields such as role (no privilege escalation on sign-up)', () => {
      expect(errorsOf(RegisterDto, { ...validRegister, role: 'ADMIN' }).failed).toEqual(['role']);
    });
  });

  describe('LoginDto', () => {
    it('does not apply the password policy to an existing password', () => {
      expect(errorsOf(LoginDto, { email: 'user@example.com', password: 'old' }).failed).toEqual([]);
    });

    it('requires a non-empty password', () => {
      expect(errorsOf(LoginDto, { email: 'user@example.com', password: '' }).failed).toEqual([
        'password',
      ]);
    });
  });

  describe('UpdateProfileDto', () => {
    it('accepts an empty body and partial updates', () => {
      expect(errorsOf(UpdateProfileDto, {}).failed).toEqual([]);
      expect(errorsOf(UpdateProfileDto, { theme: 'DARK', locale: 'EN' }).failed).toEqual([]);
    });

    it('rejects explicit null for a non-nullable field', () => {
      expect(errorsOf(UpdateProfileDto, { name: null }).failed).toEqual(['name']);
      expect(errorsOf(UpdateProfileDto, { email: null }).failed).toEqual(['email']);
    });

    it('rejects values outside the enums', () => {
      expect(errorsOf(UpdateProfileDto, { theme: 'PINK', locale: 'DE' }).failed).toEqual([
        'theme',
        'locale',
      ]);
    });

    it('rejects changing the role through the profile', () => {
      expect(errorsOf(UpdateProfileDto, { role: 'ADMIN' }).failed).toEqual(['role']);
    });
  });

  describe('ChangePasswordDto', () => {
    it('applies the password policy only to the new password', () => {
      expect(
        errorsOf(ChangePasswordDto, { currentPassword: 'old', newPassword: 'weakpass' }).failed,
      ).toEqual(['newPassword']);
    });
  });
});
