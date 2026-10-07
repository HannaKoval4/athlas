import type { UserProfile } from '@atlas/shared';
import { Controller, Get, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { PrismaClient } from '../../src/generated/prisma/client';
import { Role } from '../../src/generated/prisma/enums';
import { Public, Roles } from '../../src/modules/auth/decorators';
import { createTestApp, json, type ErrorBody } from '../utils/app';
import { createTestPrisma, truncateAll } from '../utils/db';

/** Test-only routes: real admin endpoints arrive in module 12, the guards are tested now. */
@Controller('test-guards')
class GuardProbeController {
  @Public()
  @Get('public')
  open() {
    return { ok: true };
  }

  @Get('user')
  anyUser() {
    return { ok: true };
  }

  @Roles(Role.ADMIN)
  @Get('admin')
  adminOnly() {
    return { ok: true };
  }
}

describe('Role guard (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;

  const server = () => app.getHttpServer();

  async function agentWithRole(email: string, role: Role) {
    const agent = request.agent(server());
    await agent
      .post('/api/auth/register')
      .send({ email, password: 'Secret123', name: 'R' })
      .expect(201);
    if (role !== Role.USER) {
      // There is no API to grant roles (by design); promote directly and log in again,
      // because the role is read into the access token at login.
      await prisma.user.update({ where: { email }, data: { role } });
      await agent.post('/api/auth/login').send({ email, password: 'Secret123' }).expect(200);
    }
    return agent;
  }

  beforeAll(async () => {
    prisma = createTestPrisma();
    await truncateAll(prisma);
    app = await createTestApp({ controllers: [GuardProbeController] });
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('@Public() routes are reachable without a session', async () => {
    await request(server()).get('/api/test-guards/public').expect(200);
  });

  it('routes are protected by default: 401 without a session', async () => {
    await request(server()).get('/api/test-guards/user').expect(401);
    await request(server()).get('/api/test-guards/admin').expect(401);
  });

  it('a USER gets 403 on an ADMIN route', async () => {
    const user = await agentWithRole('user@example.com', Role.USER);

    await user.get('/api/test-guards/user').expect(200);
    const res = await user.get('/api/test-guards/admin').expect(403);
    expect(json<ErrorBody>(res).message).toBe('Insufficient permissions');
  });

  it('an ADMIN can access the ADMIN route', async () => {
    const admin = await agentWithRole('admin@example.com', Role.ADMIN);

    await admin.get('/api/test-guards/admin').expect(200);
    await admin
      .get('/api/auth/me')
      .expect((res) => expect(json<UserProfile>(res).role).toBe('ADMIN'));
  });
});
