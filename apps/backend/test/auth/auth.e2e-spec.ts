import type { UserProfile } from '@atlas/shared';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { PrismaClient } from '../../src/generated/prisma/client';
import { ACCESS_COOKIE, REFRESH_COOKIE } from '../../src/modules/auth/auth.constants';
import { createTestApp, cookieValue, setCookie, json, type ErrorBody } from '../utils/app';
import { createTestPrisma, truncateAll } from '../utils/db';

const PASSWORD = 'Secret123';

describe('Auth API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let counter = 0;

  const server = () => app.getHttpServer();
  const uniqueEmail = () => `user${++counter}@example.com`;
  // Consent is required for every sign-up; tests that check it override the field.
  const register = (body: Record<string, unknown>) =>
    request(server())
      .post('/api/auth/register')
      .send({ consent: true, ...body });

  beforeAll(async () => {
    prisma = createTestPrisma();
    await truncateAll(prisma);
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('POST /api/auth/register', () => {
    it('creates the account, returns the profile and sets httpOnly cookies', async () => {
      const res = await register({
        email: '  New.User@Example.COM ',
        password: PASSWORD,
        name: ' Ann ',
      }).expect(201);

      const profile = json<UserProfile>(res);
      expect(profile).toMatchObject({
        email: 'new.user@example.com',
        name: 'Ann',
        role: 'USER',
        theme: 'SYSTEM',
        locale: 'RU',
      });
      // The moment of consent is recorded (personal data processing).
      expect(Date.parse(profile.consentAt ?? '')).toBeGreaterThan(Date.now() - 60_000);
      // Exactly the whitelisted fields: no passwordHash or other internals leak out.
      expect(Object.keys(profile).sort()).toEqual([
        'consentAt',
        'createdAt',
        'email',
        'id',
        'locale',
        'name',
        'role',
        'theme',
      ]);

      const access = setCookie(res, ACCESS_COOKIE);
      const refresh = setCookie(res, REFRESH_COOKIE);
      expect(access).toMatch(/HttpOnly/);
      expect(access).toMatch(/SameSite=Lax/);
      expect(access).toMatch(/Path=\/api;/);
      expect(access).not.toMatch(/Secure/);
      expect(refresh).toMatch(/HttpOnly/);
      expect(refresh).toMatch(/Path=\/api\/auth;/);
    });

    it('stores an argon2id hash, not the password (BR-02)', async () => {
      const email = uniqueEmail();
      await register({ email, password: PASSWORD, name: 'U' }).expect(201);

      const user = await prisma.user.findUniqueOrThrow({ where: { email } });
      expect(user.passwordHash).toMatch(/^\$argon2id\$/);
      expect(user.passwordHash).not.toContain(PASSWORD);
    });

    it('returns 409 for an e-mail that differs only in case (BR-01)', async () => {
      const email = uniqueEmail();
      await register({ email, password: PASSWORD, name: 'U' }).expect(201);

      const res = await register({
        email: email.toUpperCase(),
        password: PASSWORD,
        name: 'U2',
      }).expect(409);
      expect(json<ErrorBody>(res).message).toBe('This e-mail is already registered');
    });

    it.each([
      ['password shorter than 8', { password: 'Abc1234' }],
      ['password without a digit', { password: 'Password' }],
      ['password without a letter', { password: '12345678' }],
      ['invalid e-mail', { email: 'not-an-email' }],
      ['empty name', { name: '   ' }],
      ['missing name', { name: undefined }],
      ['extra field "role"', { role: 'ADMIN' }],
      ['no consent to data processing', { consent: undefined }],
      ['consent = false', { consent: false }],
      ['consent as the string "true"', { consent: 'true' }],
    ])('returns 400 for %s', async (_case, override) => {
      const body = { email: uniqueEmail(), password: PASSWORD, name: 'U', ...override };

      await register(body).expect(400);
      expect(await prisma.user.count({ where: { email: body.email } })).toBe(0);
    });

    it('accepts a password of exactly 8 characters (boundary)', async () => {
      await register({ email: uniqueEmail(), password: 'Abcdef12', name: 'U' }).expect(201);
    });
  });

  describe('POST /api/auth/login', () => {
    const email = 'login@example.com';

    beforeAll(async () => {
      await register({ email, password: PASSWORD, name: 'Login' }).expect(201);
    });

    it('logs in with any letter case of the e-mail and sets cookies', async () => {
      const res = await request(server())
        .post('/api/auth/login')
        .send({ email: 'LOGIN@example.com', password: PASSWORD })
        .expect(200);

      expect(json<UserProfile>(res).email).toBe(email);
      expect(cookieValue(res, ACCESS_COOKIE)).toBeTruthy();
      expect(cookieValue(res, REFRESH_COOKIE)).toBeTruthy();
    });

    it('returns 401 with the same message for a wrong password and an unknown e-mail', async () => {
      const wrongPassword = await request(server())
        .post('/api/auth/login')
        .send({ email, password: 'Wrong1234' })
        .expect(401);
      const unknownEmail = await request(server())
        .post('/api/auth/login')
        .send({ email: 'nobody@example.com', password: PASSWORD })
        .expect(401);

      expect(json<ErrorBody>(wrongPassword).message).toBe('Invalid e-mail or password');
      expect(json<ErrorBody>(unknownEmail).message).toBe(json<ErrorBody>(wrongPassword).message);
      expect(setCookie(wrongPassword, ACCESS_COOKIE)).toBeUndefined();
    });

    it('returns 400 when the password is missing', async () => {
      await request(server()).post('/api/auth/login').send({ email }).expect(400);
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns the current user when the access cookie is present', async () => {
      const agent = request.agent(server());
      const email = uniqueEmail();
      await agent
        .post('/api/auth/register')
        .send({ email, password: PASSWORD, name: 'Me', consent: true });

      const res = await agent.get('/api/auth/me').expect(200);

      expect(res.body).toMatchObject({ email, name: 'Me', role: 'USER' });
    });

    it('returns 401 without a cookie', async () => {
      await request(server()).get('/api/auth/me').expect(401);
    });

    it('returns 401 for a forged token (signed with another secret)', async () => {
      const forged = new JwtService().sign({ sub: 'x', role: 'ADMIN' }, { secret: 'guess' });

      await request(server())
        .get('/api/auth/me')
        .set('Cookie', `${ACCESS_COOKIE}=${forged}`)
        .expect(401);
    });

    it('returns 401 for an expired access token', async () => {
      const user = await prisma.user.findFirstOrThrow();
      const expired = new JwtService().sign(
        { sub: user.id, role: user.role, exp: Math.floor(Date.now() / 1000) - 1 },
        { secret: process.env.JWT_ACCESS_SECRET },
      );

      await request(server())
        .get('/api/auth/me')
        .set('Cookie', `${ACCESS_COOKIE}=${expired}`)
        .expect(401);
    });

    it('does not accept the refresh token in place of the access token', async () => {
      const res = await register({ email: uniqueEmail(), password: PASSWORD, name: 'U' });

      await request(server())
        .get('/api/auth/me')
        .set('Cookie', `${ACCESS_COOKIE}=${cookieValue(res, REFRESH_COOKIE)}`)
        .expect(401);
    });
  });

  describe('POST /api/auth/refresh (BR-03)', () => {
    it('rotates the refresh token: old one is revoked, a new pair is issued', async () => {
      const email = uniqueEmail();
      const registered = await register({ email, password: PASSWORD, name: 'R' }).expect(201);
      const oldRefresh = cookieValue(registered, REFRESH_COOKIE);

      const res = await request(server())
        .post('/api/auth/refresh')
        .set('Cookie', `${REFRESH_COOKIE}=${oldRefresh}`)
        .expect(200);

      expect(json<UserProfile>(res).email).toBe(email);
      const newRefresh = cookieValue(res, REFRESH_COOKIE);
      expect(newRefresh).toBeTruthy();
      expect(newRefresh).not.toBe(oldRefresh);
      expect(cookieValue(res, ACCESS_COOKIE)).toBeTruthy();

      const user = await prisma.user.findUniqueOrThrow({ where: { email } });
      const tokens = await prisma.refreshToken.findMany({ where: { userId: user.id } });
      expect(tokens).toHaveLength(2);
      expect(tokens.filter((t) => t.revokedAt === null)).toHaveLength(1);
    });

    it('reusing a rotated token revokes all sessions of the user', async () => {
      const email = uniqueEmail();
      const registered = await register({ email, password: PASSWORD, name: 'R' }).expect(201);
      const stolen = cookieValue(registered, REFRESH_COOKIE);
      const rotated = await request(server())
        .post('/api/auth/refresh')
        .set('Cookie', `${REFRESH_COOKIE}=${stolen}`)
        .expect(200);

      const reuse = await request(server())
        .post('/api/auth/refresh')
        .set('Cookie', `${REFRESH_COOKIE}=${stolen}`)
        .expect(401);

      expect(json<ErrorBody>(reuse).message).toMatch(/reuse detected/);
      // The legitimate client's fresh token is dead too: the attacker cannot keep a session.
      await request(server())
        .post('/api/auth/refresh')
        .set('Cookie', `${REFRESH_COOKIE}=${cookieValue(rotated, REFRESH_COOKIE)}`)
        .expect(401);
      const user = await prisma.user.findUniqueOrThrow({ where: { email } });
      expect(await prisma.refreshToken.count({ where: { userId: user.id, revokedAt: null } })).toBe(
        0,
      );
    });

    it('returns 401 and clears cookies when the refresh cookie is missing', async () => {
      const res = await request(server()).post('/api/auth/refresh').expect(401);

      expect(setCookie(res, ACCESS_COOKIE)).toMatch(/Expires=Thu, 01 Jan 1970/);
      expect(setCookie(res, REFRESH_COOKIE)).toMatch(/Expires=Thu, 01 Jan 1970/);
    });

    it('returns 401 for a garbage refresh token', async () => {
      await request(server())
        .post('/api/auth/refresh')
        .set('Cookie', `${REFRESH_COOKIE}=garbage`)
        .expect(401);
    });

    it('works through a cookie jar: the browser sends the refresh cookie only to /api/auth', async () => {
      const agent = request.agent(server());
      await agent
        .post('/api/auth/register')
        .send({ email: uniqueEmail(), password: PASSWORD, name: 'Jar', consent: true })
        .expect(201);

      await agent.post('/api/auth/refresh').expect(200);
      await agent.get('/api/auth/me').expect(200);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('revokes the refresh token and clears both cookies', async () => {
      const email = uniqueEmail();
      const registered = await register({ email, password: PASSWORD, name: 'L' }).expect(201);
      const refresh = cookieValue(registered, REFRESH_COOKIE);

      const res = await request(server())
        .post('/api/auth/logout')
        .set('Cookie', `${REFRESH_COOKIE}=${refresh}`)
        .expect(204);

      expect(setCookie(res, ACCESS_COOKIE)).toMatch(/Expires=Thu, 01 Jan 1970/);
      expect(setCookie(res, REFRESH_COOKIE)).toMatch(/Expires=Thu, 01 Jan 1970/);
      await request(server())
        .post('/api/auth/refresh')
        .set('Cookie', `${REFRESH_COOKIE}=${refresh}`)
        .expect(401);
    });

    it('logs out the session only: other sessions of the user stay active', async () => {
      const email = uniqueEmail();
      await register({ email, password: PASSWORD, name: 'L' }).expect(201);
      const laptop = await request(server())
        .post('/api/auth/login')
        .send({ email, password: PASSWORD });
      const phone = await request(server())
        .post('/api/auth/login')
        .send({ email, password: PASSWORD });

      await request(server())
        .post('/api/auth/logout')
        .set('Cookie', `${REFRESH_COOKIE}=${cookieValue(laptop, REFRESH_COOKIE)}`)
        .expect(204);

      await request(server())
        .post('/api/auth/refresh')
        .set('Cookie', `${REFRESH_COOKIE}=${cookieValue(phone, REFRESH_COOKIE)}`)
        .expect(200);
    });

    it('is idempotent: 204 even without a cookie', async () => {
      await request(server()).post('/api/auth/logout').expect(204);
    });
  });

  it('documents the auth endpoints in Swagger', async () => {
    const res = await request(server()).get('/api/docs-json').expect(200);

    expect(Object.keys(json<{ paths: object }>(res).paths)).toEqual(
      expect.arrayContaining([
        '/api/auth/register',
        '/api/auth/login',
        '/api/auth/refresh',
        '/api/auth/logout',
        '/api/auth/me',
        '/api/users/me',
        '/api/users/me/password',
      ]),
    );
  });
});
