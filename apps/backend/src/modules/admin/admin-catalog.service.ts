import {
  type AdminCulture,
  type AdminCultureRegion,
  type AdminEra,
  type AdminHoliday,
  type AdminRegion,
  holidayDateIssue,
  isRegionGeometry,
  periodIssue,
} from '@atlas/shared';
import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { cultureRefSelect } from '../cards/cards.service';
import { adminWrite, assertNoIssue } from './admin-errors';
import type {
  CultureInputDto,
  CultureRegionInputDto,
  CultureRegionsQueryDto,
  EraInputDto,
  HolidayInputDto,
  HolidaysAdminQueryDto,
  RegionInputDto,
} from './dto/catalog.dto';

const regionRefSelect = { id: true, slug: true, name: true } as const;

const cultureRegionSelect = {
  id: true,
  cultureId: true,
  regionId: true,
  startYear: true,
  endYear: true,
  dateApproximate: true,
  culture: { select: cultureRefSelect },
  region: { select: regionRefSelect },
} satisfies Prisma.CultureRegionSelect;

const holidaySelect = {
  id: true,
  slug: true,
  cultureId: true,
  name: true,
  description: true,
  dateType: true,
  month: true,
  day: true,
  season: true,
  dateNote: true,
  cardId: true,
  sourceId: true,
  culture: { select: cultureRefSelect },
  card: { select: { id: true, slug: true, title: true } },
} satisfies Prisma.HolidaySelect;

/**
 * F-18, reference data of the atlas: eras, cultures, regions, culture presence in regions
 * (the time slice of the map) and holidays. The public API reads these tables directly,
 * so every change is visible on the map, in the calendar and in search immediately.
 */
@Injectable()
export class AdminCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Eras ----------------------------------------------------------------------------------

  async findEras(): Promise<AdminEra[]> {
    const rows = await this.prisma.era.findMany({
      include: { _count: { select: { quizzes: true } } },
      orderBy: [{ sortOrder: 'asc' }, { startYear: 'asc' }],
    });
    return rows.map(({ _count, ...era }) => ({ ...era, quizCount: _count.quizzes }));
  }

  async createEra(dto: EraInputDto): Promise<AdminEra> {
    assertNoIssue(periodIssue(dto.startYear, dto.endYear), 'period');
    const era = await adminWrite(() => this.prisma.era.create({ data: { ...dto } }));
    return { ...era, quizCount: 0 };
  }

  async updateEra(id: string, dto: EraInputDto): Promise<AdminEra> {
    assertNoIssue(periodIssue(dto.startYear, dto.endYear), 'period');
    const era = await adminWrite(
      () =>
        this.prisma.era.update({
          where: { id },
          data: { ...dto },
          include: { _count: { select: { quizzes: true } } },
        }),
      { notFound: 'Era not found' },
    );
    const { _count, ...rest } = era;
    return { ...rest, quizCount: _count.quizzes };
  }

  /**
   * Quizzes (and users' attempts) cascade with their era, so an era with quizzes is kept:
   * the admin deletes or moves its quizzes first.
   */
  async removeEra(id: string): Promise<void> {
    const quizzes = await this.prisma.quiz.count({ where: { eraId: id } });
    if (quizzes > 0) {
      throw new ConflictException(`The era has ${quizzes} quiz(zes); delete them first`);
    }
    await adminWrite(() => this.prisma.era.delete({ where: { id } }), {
      notFound: 'Era not found',
    });
  }

  // ---- Cultures ------------------------------------------------------------------------------

  async findCultures(): Promise<AdminCulture[]> {
    const rows = await this.prisma.culture.findMany({
      include: { _count: { select: { cards: true } } },
      orderBy: { name: 'asc' },
    });
    return rows.map(({ _count, ...culture }) => ({ ...culture, cardCount: _count.cards }));
  }

  async createCulture(dto: CultureInputDto): Promise<AdminCulture> {
    assertNoIssue(periodIssue(dto.startYear, dto.endYear), 'period');
    const culture = await adminWrite(() => this.prisma.culture.create({ data: { ...dto } }));
    return { ...culture, cardCount: 0 };
  }

  async updateCulture(id: string, dto: CultureInputDto): Promise<AdminCulture> {
    assertNoIssue(periodIssue(dto.startYear, dto.endYear), 'period');
    const { _count, ...culture } = await adminWrite(
      () =>
        this.prisma.culture.update({
          where: { id },
          data: { ...dto },
          include: { _count: { select: { cards: true } } },
        }),
      { notFound: 'Culture not found' },
    );
    return { ...culture, cardCount: _count.cards };
  }

  /** BR-17: Card.cultureId is ON DELETE RESTRICT, so a culture with cards cannot be deleted. */
  async removeCulture(id: string): Promise<void> {
    await adminWrite(() => this.prisma.culture.delete({ where: { id } }), {
      notFound: 'Culture not found',
      inUse: 'The culture has cards; delete or move them first (BR-17)',
    });
  }

  // ---- Regions -------------------------------------------------------------------------------

  async findRegions(): Promise<AdminRegion[]> {
    const rows = await this.prisma.region.findMany({
      include: { _count: { select: { cultures: true } } },
      orderBy: { name: 'asc' },
    });
    return rows.map(({ _count, ...region }) => toAdminRegion(region, _count.cultures));
  }

  async createRegion(dto: RegionInputDto): Promise<AdminRegion> {
    const region = await adminWrite(() => this.prisma.region.create({ data: regionData(dto) }));
    return toAdminRegion(region, 0);
  }

  async updateRegion(id: string, dto: RegionInputDto): Promise<AdminRegion> {
    const { _count, ...region } = await adminWrite(
      () =>
        this.prisma.region.update({
          where: { id },
          data: regionData(dto),
          include: { _count: { select: { cultures: true } } },
        }),
      { notFound: 'Region not found' },
    );
    return toAdminRegion(region, _count.cultures);
  }

  /** The culture periods of the region are deleted with it (ON DELETE CASCADE). */
  async removeRegion(id: string): Promise<void> {
    await adminWrite(() => this.prisma.region.delete({ where: { id } }), {
      notFound: 'Region not found',
    });
  }

  // ---- Culture presence in regions (time slice, DM-03) --------------------------------------

  findCultureRegions(query: CultureRegionsQueryDto): Promise<AdminCultureRegion[]> {
    return this.prisma.cultureRegion.findMany({
      where: { cultureId: query.cultureId, regionId: query.regionId },
      select: cultureRegionSelect,
      orderBy: [{ culture: { name: 'asc' } }, { region: { name: 'asc' } }, { startYear: 'asc' }],
    });
  }

  createCultureRegion(dto: CultureRegionInputDto): Promise<AdminCultureRegion> {
    assertNoIssue(periodIssue(dto.startYear, dto.endYear), 'period');
    return adminWrite(
      () => this.prisma.cultureRegion.create({ data: { ...dto }, select: cultureRegionSelect }),
      {
        conflict: 'The culture already has a period in this region starting this year',
        missingReference: 'Unknown culture or region',
      },
    );
  }

  updateCultureRegion(id: string, dto: CultureRegionInputDto): Promise<AdminCultureRegion> {
    assertNoIssue(periodIssue(dto.startYear, dto.endYear), 'period');
    return adminWrite(
      () =>
        this.prisma.cultureRegion.update({
          where: { id },
          data: { ...dto },
          select: cultureRegionSelect,
        }),
      {
        notFound: 'Culture period not found',
        conflict: 'The culture already has a period in this region starting this year',
        missingReference: 'Unknown culture or region',
      },
    );
  }

  async removeCultureRegion(id: string): Promise<void> {
    await adminWrite(() => this.prisma.cultureRegion.delete({ where: { id } }), {
      notFound: 'Culture period not found',
    });
  }

  // ---- Holidays (DM-05) ----------------------------------------------------------------------

  findHolidays(query: HolidaysAdminQueryDto): Promise<AdminHoliday[]> {
    return this.prisma.holiday.findMany({
      where: { cultureId: query.cultureId },
      select: holidaySelect,
      orderBy: [{ culture: { name: 'asc' } }, { name: 'asc' }],
    });
  }

  createHoliday(dto: HolidayInputDto): Promise<AdminHoliday> {
    assertNoIssue(holidayDateIssue(dto), 'date');
    return adminWrite(
      () => this.prisma.holiday.create({ data: { ...dto }, select: holidaySelect }),
      { missingReference: 'Unknown culture, card or source' },
    );
  }

  updateHoliday(id: string, dto: HolidayInputDto): Promise<AdminHoliday> {
    assertNoIssue(holidayDateIssue(dto), 'date');
    return adminWrite(
      () => this.prisma.holiday.update({ where: { id }, data: { ...dto }, select: holidaySelect }),
      { notFound: 'Holiday not found', missingReference: 'Unknown culture, card or source' },
    );
  }

  async removeHoliday(id: string): Promise<void> {
    await adminWrite(() => this.prisma.holiday.delete({ where: { id } }), {
      notFound: 'Holiday not found',
    });
  }
}

/** DM-10: only a Polygon/MultiPolygon is stored, so the map can always draw the region. */
function regionData(dto: RegionInputDto): Prisma.RegionCreateInput {
  if (!isRegionGeometry(dto.geojson)) {
    throw new BadRequestException(
      'geojson: expected a GeoJSON Polygon or MultiPolygon with closed rings of [lng, lat] points',
    );
  }
  return { ...dto, geojson: dto.geojson as unknown as Prisma.InputJsonValue };
}

function toAdminRegion(
  region: {
    id: string;
    slug: string;
    name: string;
    geojson: Prisma.JsonValue;
    centerLat: number;
    centerLng: number;
  },
  periodCount: number,
): AdminRegion {
  const { geojson, ...rest } = region;
  if (!isRegionGeometry(geojson)) {
    throw new Error(`Region ${region.slug} has an invalid geometry`);
  }
  return { ...rest, geojson, periodCount };
}
