import type { UserProfile } from '@atlas/shared';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import type { App } from 'supertest/types';
import type { PrismaClient } from '../../src/generated/prisma/client';
import { ACCESS_COOKIE, REFRESH_COOKIE } from '../../src/modules/auth/auth.constants';
import { createTestApp, cookieValue, json, type ErrorBody } from '../utils/app';
import { createTestPrisma, truncateAll } from '../utils/db';

const PASSWORD = 'Secret123';

describe('Users API: profile and password (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let counter = 0;

  const server = () => app.getHttpServer();
  const uniqueEmail = () => `profile${++counter}@example.com`;

  /** A logged-in browser-like client (cookie jar) for a fresh user. */
  async function signedInAgent(email = uniqueEmail()): Promise<TestAgent> {
    const agent = request.agent(server());
    await agent
      .post('/api/auth/register')
      .send({ email, password: PASSWORD, name: 'Old' })
      .expect(201);
    return agent;
  }

  beforeAll(async () => {
    prisma = createTestPrisma();
    await truncateAll(prisma);
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('PATCH /api/users/me', () => {
    it('updates name, theme and locale and returns the profile', async () => {
      const agent = await signedInAgent();

      const res = await agent
        .patch('/api/users/me')
        .send({ name: '  New name ', theme: 'DARK', locale: 'EN' })
        .expect(200);

      expect(res.body).toMatchObject({ name: 'New name', theme: 'DARK', locale: 'EN' });
      await agent
        .get('/api/auth/me')
        .expect(200)
        .expect((me) => {
          expect(me.body).toMatchObject({ name: 'New name', theme: 'DARK', locale: 'EN' });
        });
    });

    it('changes only the fields that were sent', async () => {
      const agent = await signedInAgent();

      const res = await agent.patch('/api/users/me').send({ theme: 'LIGHT' }).expect(200);

      expect(res.body).toMatchObject({ name: 'Old', theme: 'LIGHT', locale: 'RU' });
    });

    it('normalizes a new e-mail to lower case (BR-01)', async () => {
      const agent = await signedInAgent();

      const res = await agent
        .patch('/api/users/me')
        .send({ email: 'Changed.Mail@Example.com' })
        .expect(200);

      expect(json<UserProfile>(res).email).toBe('changed.mail@example.com');
    });

    it('returns 409 when the e-mail belongs to another user (any letter case)', async () => {
      const taken = uniqueEmail();
      await signedInAgent(taken);
      const agent = await signedInAgent();

      const res = await agent
        .patch('/api/users/me')
        .send({ email: taken.toUpperCase() })
        .expect(409);

      expect(json<ErrorBody>(res).message).toBe('This e-mail is already registered');
    });

    it('allows "changing" the e-mail to the current one', async () => {
      const email = uniqueEmail();
      const agent = await signedInAgent(email);

      await agent.patch('/api/users/me').send({ email }).expect(200);
    });

    it.each([
      ['unknown theme', { theme: 'PINK' }],
      ['unknown locale', { locale: 'DE' }],
      ['null name', { name: null }],
      ['empty name', { name: '' }],
      ['invalid e-mail', { email: 'nope' }],
      ['role escalation attempt', { role: 'ADMIN' }],
      ['password via profile', { passwordHash: 'x' }],
    ])('returns 400 for %s', async (_case, body) => {
      const agent = await signedInAgent();

      await agent.patch('/api/users/me').send(body).expect(400);
      await agent
        .get('/api/auth/me')
        .expect((me) => expect(json<UserProfile>(me).role).toBe('USER'));
    });

    it('returns 401 without authentication', async () => {
      await request(server()).patch('/api/users/me').send({ name: 'X' }).expect(401);
    });
  });

  describe('PATCH /api/users/me/password', () => {
    it('changes the password: the old one stops working, the new one works', async () => {
      const email = uniqueEmail();
      const agent = await signedInAgent(email);

      const res = await agent
        .patch('/api/users/me/password')
        .send({ currentPassword: PASSWORD, newPassword: 'NewSecret456' })
        .expect(204);

      expect(cookieValue(res, ACCESS_COOKIE)).toBeTruthy();
      await request(server())
        .post('/api/auth/login')
        .send({ email, password: PASSWORD })
        .expect(401);
      await request(server())
        .post('/api/auth/login')
        .send({ email, password: 'NewSecret456' })
        .expect(200);
    });

    it('keeps the current device logged in but ends other sessions', async () => {
      const email = uniqueEmail();
      const agent = await signedInAgent(email);
      const otherDevice = await request(server())
        .post('/api/auth/login')
        .send({ email, password: PASSWORD })
        .expect(200);

      await agent
        .patch('/api/users/me/password')
        .send({ currentPassword: PASSWORD, newPassword: 'NewSecret456' })
        .expect(204);

      await agent.get('/api/auth/me').expect(200);
      await agent.post('/api/auth/refresh').expect(200);
      await request(server())
        .post('/api/auth/refresh')
        .set('Cookie', `${REFRESH_COOKIE}=${cookieValue(otherDevice, REFRESH_COOKIE)}`)
        .expect(401);
    });

    it('returns 400 for a wrong current password and keeps the old password', async () => {
      const email = uniqueEmail();
      const agent = await signedInAgent(email);

      const res = await agent
        .patch('/api/users/me/password')
        .send({ currentPassword: 'Wrong1234', newPassword: 'NewSecret456' })
        .expect(400);

      expect(json<ErrorBody>(res).message).toBe('Current password is incorrect');
      await request(server())
        .post('/api/auth/login')
        .send({ email, password: PASSWORD })
        .expect(200);
    });

    it('returns 400 when the new password violates the policy (BR-02)', async () => {
      const agent = await signedInAgent();

      await agent
        .patch('/api/users/me/password')
        .send({ currentPassword: PASSWORD, newPassword: 'onlyletters' })
        .expect(400);
    });

    it('returns 401 without authentication', async () => {
      await request(server())
        .patch('/api/users/me/password')
        .send({ currentPassword: PASSWORD, newPassword: 'NewSecret456' })
        .expect(401);
    });
  });
});
