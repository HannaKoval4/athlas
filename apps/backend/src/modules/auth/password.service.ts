import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/** BR-02: password hashing with argon2id (memory-hard, the OWASP-recommended default). */
@Injectable()
export class PasswordService {
  private dummyHash?: Promise<string>;

  hash(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  /** Returns false (never throws) for a wrong password or a malformed hash. */
  async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  /**
   * Spends the same time as a real check when the e-mail is unknown, so response time
   * does not reveal whether an account exists. Always resolves to false.
   */
  async verifyAgainstDummy(password: string): Promise<false> {
    this.dummyHash ??= this.hash('dummy-password-0');
    await this.verify(await this.dummyHash, password);
    return false;
  }
}
