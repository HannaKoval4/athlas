import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  isValidPassword,
  normalizeEmail,
} from './auth.js';

describe('isValidPassword (BR-02)', () => {
  it.each([
    ['abcdefg1', 'exactly the minimum length'],
    ['пароль123', 'Cyrillic letters count as letters'],
    ['A1!@#$%^&*', 'special characters are allowed'],
    ['pass word 1', 'spaces are allowed'],
  ])('accepts %p (%s)', (password) => {
    expect(isValidPassword(password)).toBe(true);
  });

  it.each([
    ['abcdef1', 'one character shorter than the minimum'],
    ['abcdefgh', 'no digit'],
    ['12345678', 'no letter'],
    ['', 'empty'],
    ['!!!!!!!!', 'neither letter nor digit'],
  ])('rejects %p (%s)', (password) => {
    expect(isValidPassword(password)).toBe(false);
  });

  it('accepts a password of exactly the maximum length', () => {
    expect(isValidPassword('a1'.padEnd(PASSWORD_MAX_LENGTH, 'x'))).toBe(true);
  });

  it('rejects a password longer than the maximum length', () => {
    expect(isValidPassword('a1'.padEnd(PASSWORD_MAX_LENGTH + 1, 'x'))).toBe(false);
  });

  it('uses a minimum length of 8', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8);
  });
});

describe('normalizeEmail (BR-01)', () => {
  it('lower-cases and trims the address', () => {
    expect(normalizeEmail('  User.Name@Example.COM ')).toBe('user.name@example.com');
  });

  it('keeps an already normalized address unchanged', () => {
    expect(normalizeEmail('user@example.com')).toBe('user@example.com');
  });
});
