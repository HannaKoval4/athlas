import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { PrismaClient } from '../../src/generated/prisma/client';
import { createTestApp } from '../utils/app';
import { createTestPrisma, truncateAll } from '../utils/db';

const LIMIT = 3;

describe('Auth throttling (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  const server = () => app.getHttpServer();

  beforeAll(async () => {
    // test-env.ts raises the limit for other files; this file checks the real mechanism.
    process.env.THROTTLE_AUTH_LIMIT = String(LIMIT);
    prisma = createTestPrisma();
    await truncateAll(prisma);
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it(`returns 429 after ${LIMIT} login attempts per minute from one client`, async () => {
    const attempt = () =>
      request(server())
        .post('/api/auth/login')
        .send({ email: 'x@example.com', password: 'Wrong1234' });

    for (let i = 0; i < LIMIT; i += 1) {
      await attempt().expect(401);
    }
    const blocked = await attempt().expect(429);

    expect(blocked.headers['retry-after']).toBeDefined();
  });

  it('counts each route separately and does not throttle /auth/me or health', async () => {
    await request(server())
      .post('/api/auth/register')
      .send({ email: 'fresh@example.com', password: 'Secret123', name: 'F' })
      .expect(201);

    for (let i = 0; i < LIMIT + 2; i += 1) {
      await request(server()).get('/api/auth/me').expect(401);
      await request(server()).get('/api/health').expect(200);
    }
  });
});
