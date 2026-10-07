import type { EraSummary, MapSlice } from '@atlas/shared';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import type { App } from 'supertest/types';
import type { PrismaClient } from '../../src/generated/prisma/client';
import { createCard, createCulture, createEra, createRegion, placeCulture } from '../factories';
import { createTestApp, json, type ErrorBody } from '../utils/app';
import { createTestPrisma, truncateAll } from '../utils/db';

describe('Eras and map time slice (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let user: TestAgent;

  // Fixture, all periods inclusive (DM-03):
  //   greece   in "Islands"  -800 .. -146 (approximate), in "Mainland" -800 .. -146
  //   egypt    in "Delta"   -3100 .. -30
  //   rome     in "Mainland" -146 .. 476  (shares the region with greece in -146)
  //   hidden   in "Ghost"    -500 .. -400 (only an unpublished card -> never on the map, BR-04)
  //   empty    in "Ghost"    -500 .. -400 (no cards at all)
  const ids: Record<string, string> = {};

  const server = () => app.getHttpServer();
  const getMap = (query: string) => user.get(`/api/map?${query}`);
  const regionNames = (slice: MapSlice) => slice.regions.map((r) => r.name);

  beforeAll(async () => {
    prisma = createTestPrisma();
    await truncateAll(prisma);
    app = await createTestApp();

    await createEra(prisma, { slug: 'antiquity', startYear: -1200, endYear: 476, sortOrder: 2 });
    await createEra(prisma, {
      slug: 'early-antiquity',
      startYear: -3500,
      endYear: -1201,
      sortOrder: 1,
    });

    const islands = await createRegion(prisma, { name: 'Islands' });
    const mainland = await createRegion(prisma, { name: 'Mainland' });
    const delta = await createRegion(prisma, { name: 'Delta' });
    const ghost = await createRegion(prisma, { name: 'Ghost' });

    const greece = await createCulture(prisma);
    const egypt = await createCulture(prisma);
    const rome = await createCulture(prisma);
    const hidden = await createCulture(prisma);
    const empty = await createCulture(prisma);
    Object.assign(ids, { greece: greece.id, rome: rome.id, mainland: mainland.id });

    for (const culture of [greece, egypt, rome]) await createCard(prisma, culture.id);
    await createCard(prisma, hidden.id, { published: false });

    await placeCulture(prisma, greece.id, islands.id, {
      startYear: -800,
      endYear: -146,
      dateApproximate: true,
    });
    await placeCulture(prisma, greece.id, mainland.id, { startYear: -800, endYear: -146 });
    await placeCulture(prisma, egypt.id, delta.id, { startYear: -3100, endYear: -30 });
    await placeCulture(prisma, rome.id, mainland.id, { startYear: -146, endYear: 476 });
    await placeCulture(prisma, hidden.id, ghost.id, { startYear: -500, endYear: -400 });
    await placeCulture(prisma, empty.id, ghost.id, { startYear: -500, endYear: -400 });

    user = request.agent(server());
    await user
      .post('/api/auth/register')
      .send({ email: 'map@example.com', password: 'Secret123', name: 'Map', consent: true })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('GET /api/eras', () => {
    it('lists eras ordered by sortOrder', async () => {
      const res = await user.get('/api/eras').expect(200);
      const eras = json<EraSummary[]>(res);

      expect(eras.map((e) => e.slug)).toEqual(['early-antiquity', 'antiquity']);
      expect(Object.keys(eras[0]).sort()).toEqual(
        ['description', 'endYear', 'id', 'name', 'slug', 'startYear'].sort(),
      );
    });

    it('requires a session', async () => {
      await request(server()).get('/api/eras').expect(401);
    });
  });

  describe('GET /api/map', () => {
    it('returns regions active in the year with their cultures (BR-04)', async () => {
      const slice = json<MapSlice>(await getMap('year=-450').expect(200));

      expect(slice.year).toBe(-450);
      expect(regionNames(slice)).toEqual(['Delta', 'Islands', 'Mainland']);
      const islands = slice.regions.find((r) => r.name === 'Islands');
      expect(islands).toMatchObject({
        geometry: { type: 'Polygon' },
        center: { lat: 35.5, lng: 20.5 },
        cultures: [{ id: ids.greece, color: '#123456', dateApproximate: true }],
      });
    });

    it('hides regions whose cultures have no published cards (BR-04)', async () => {
      const slice = json<MapSlice>(await getMap('year=-450').expect(200));

      expect(regionNames(slice)).not.toContain('Ghost');
    });

    it('includes both period bounds and excludes the year after (DM-03)', async () => {
      const atStart = json<MapSlice>(await getMap('year=-3100').expect(200));
      const atEnd = json<MapSlice>(await getMap('year=-30').expect(200));
      const after = json<MapSlice>(await getMap('year=-29').expect(200));

      expect(regionNames(atStart)).toEqual(['Delta']);
      expect(regionNames(atEnd)).toContain('Delta');
      expect(regionNames(after)).not.toContain('Delta');
    });

    it('lists every culture of a shared region in the overlap year, once each', async () => {
      // Two CultureRegion periods of the same culture overlap in -146.
      await placeCulture(prisma, ids.greece, ids.mainland, { startYear: -200, endYear: -146 });

      const slice = json<MapSlice>(await getMap('year=-146').expect(200));
      const mainland = slice.regions.find((r) => r.name === 'Mainland');

      expect(mainland?.cultures.map((c) => c.id).sort()).toEqual([ids.greece, ids.rome].sort());
    });

    it('returns an empty list for a year without materials', async () => {
      const slice = json<MapSlice>(await getMap('year=1500').expect(200));

      expect(slice).toEqual({ year: 1500, regions: [] });
    });

    it('crosses the BCE/CE boundary correctly (1 BCE and 1 CE)', async () => {
      const bce = json<MapSlice>(await getMap('year=-1').expect(200));
      const ce = json<MapSlice>(await getMap('year=1').expect(200));

      expect(regionNames(bce)).toEqual(['Mainland']);
      expect(regionNames(ce)).toEqual(['Mainland']);
    });

    it.each(['year=0', 'year=1.5', 'year=abc', '', 'year=-10001', 'year=2101'])(
      'rejects an invalid year (%p) with 400',
      async (query) => {
        await getMap(query).expect(400);
      },
    );

    it('accepts a year inside the era, bounds included (BR-05)', async () => {
      await getMap('year=-1200&era=antiquity').expect(200);
      await getMap('year=476&era=antiquity').expect(200);
    });

    it('rejects a year outside the era with 400 (BR-05)', async () => {
      const res = await getMap('year=-1201&era=antiquity').expect(400);

      expect(json<ErrorBody>(res).message).toMatch(/outside the era "antiquity"/);
    });

    it('returns 404 for an unknown era', async () => {
      await getMap('year=-450&era=no-such-era').expect(404);
    });

    it('rejects unknown query parameters', async () => {
      await getMap('year=-450&region=crete').expect(400);
    });

    it('requires a session', async () => {
      await request(server()).get('/api/map?year=-450').expect(401);
    });

    it('a newly published card makes its culture appear at once', async () => {
      const hiddenCard = await prisma.card.findFirstOrThrow({ where: { published: false } });
      await prisma.card.update({ where: { id: hiddenCard.id }, data: { published: true } });

      const slice = json<MapSlice>(await getMap('year=-450').expect(200));

      expect(regionNames(slice)).toContain('Ghost');
      const ghost = slice.regions.find((r) => r.name === 'Ghost');
      // The culture without cards is still hidden in the same region.
      expect(ghost?.cultures).toHaveLength(1);
    });
  });
});
