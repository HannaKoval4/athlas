import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { ErasService } from '../eras/eras.service';
import type { ActiveRegionRow, MapRepository } from './map.repository';
import { MapService } from './map.service';

const antiquity = {
  id: 'era-1',
  slug: 'antiquity',
  name: 'Античность',
  description: null,
  startYear: -1200,
  endYear: 476,
};

const crete: ActiveRegionRow = {
  id: 'region-1',
  slug: 'crete',
  name: 'Крит',
  geojson: {
    type: 'Polygon',
    coordinates: [
      [
        [23.5, 35.3],
        [26.3, 35.3],
        [25, 34.9],
        [23.5, 35.3],
      ],
    ],
  },
  centerLat: 35.2,
  centerLng: 24.9,
  cultures: [
    {
      id: 'c-1',
      slug: 'ancient-greece',
      name: 'Древняя Греция',
      color: '#2F6DB5',
      dateApproximate: true,
    },
  ],
};

describe('MapService', () => {
  const repository = { findActiveRegions: jest.fn<Promise<ActiveRegionRow[]>, [number]>() };
  const eras = { findBySlug: jest.fn<Promise<typeof antiquity>, [string]>() };
  const service = new MapService(
    repository as unknown as MapRepository,
    eras as unknown as ErasService,
  );

  beforeEach(() => {
    repository.findActiveRegions.mockReset().mockResolvedValue([crete]);
    eras.findBySlug.mockReset().mockResolvedValue(antiquity);
  });

  it('maps repository rows to the API shape', async () => {
    const slice = await service.getSlice(-450);

    expect(slice).toEqual({
      year: -450,
      regions: [
        {
          id: 'region-1',
          slug: 'crete',
          name: 'Крит',
          geometry: crete.geojson,
          center: { lat: 35.2, lng: 24.9 },
          cultures: crete.cultures,
        },
      ],
    });
    expect(repository.findActiveRegions).toHaveBeenCalledWith(-450);
  });

  it('does not look up an era when none is given', async () => {
    await service.getSlice(1000);

    expect(eras.findBySlug).not.toHaveBeenCalled();
  });

  it.each([-1200, -450, 476])(
    'accepts year %i inside the era, bounds included (BR-05)',
    async (year) => {
      await expect(service.getSlice(year, 'antiquity')).resolves.toMatchObject({ year });
    },
  );

  it.each([-1201, 477])('rejects year %i outside the era with 400 (BR-05)', async (year) => {
    await expect(service.getSlice(year, 'antiquity')).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.findActiveRegions).not.toHaveBeenCalled();
  });

  it('propagates 404 for an unknown era', async () => {
    eras.findBySlug.mockRejectedValueOnce(new NotFoundException('Era "nope" not found'));

    await expect(service.getSlice(-450, 'nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns an empty slice when nothing is active', async () => {
    repository.findActiveRegions.mockResolvedValueOnce([]);

    await expect(service.getSlice(1500)).resolves.toEqual({ year: 1500, regions: [] });
  });
});
