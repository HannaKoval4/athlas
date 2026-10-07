import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

const FRONTEND_ORIGIN = 'http://localhost:5173';

describe('App bootstrap (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app, { frontendOrigin: FRONTEND_ORIGIN });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/health', () => {
    it('returns 200 and status "ok"', async () => {
      const res = await request(app.getHttpServer()).get('/api/health').expect(200);

      expect(res.body).toEqual({ status: 'ok', database: 'up' });
    });

    it('is not available without the global /api prefix', async () => {
      await request(app.getHttpServer()).get('/health').expect(404);
    });
  });

  it('returns a JSON 404 for unknown routes', async () => {
    const res = await request(app.getHttpServer()).get('/api/does-not-exist').expect(404);

    expect(res.body).toMatchObject({ statusCode: 404 });
  });

  it('serves Swagger UI at /api/docs', async () => {
    const res = await request(app.getHttpServer()).get('/api/docs').expect(200);

    expect(res.text).toContain('swagger-ui');
  });

  it('exposes the OpenAPI document with the health endpoint', async () => {
    const res = await request(app.getHttpServer()).get('/api/docs-json').expect(200);

    expect(res.body).toHaveProperty(['paths', '/api/health']);
  });

  it('sets security headers (helmet)', async () => {
    const res = await request(app.getHttpServer()).get('/api/health');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  describe('CORS', () => {
    it('allows the frontend origin with credentials', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/health')
        .set('Origin', FRONTEND_ORIGIN);

      expect(res.headers['access-control-allow-origin']).toBe(FRONTEND_ORIGIN);
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('does not allow a foreign origin', async () => {
      const foreignOrigin = 'http://evil.example';
      const res = await request(app.getHttpServer())
        .get('/api/health')
        .set('Origin', foreignOrigin);

      // With a static origin the header always names the frontend; the browser
      // blocks the response because it does not match the requesting origin.
      expect(res.headers['access-control-allow-origin']).not.toBe(foreignOrigin);
      expect(res.headers['access-control-allow-origin']).toBe(FRONTEND_ORIGIN);
    });
  });
});
