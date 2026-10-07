import { isValidYear } from '@atlas/shared';
import {
  CardType,
  HolidayDateType,
  RelationType,
  Season,
  SourceType,
} from '../../src/generated/prisma/enums';
import type { SeedData } from './types';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MIN_POLYGON_POINTS = 5;
const MAX_POLYGON_POINTS = 16;

function checkPeriod(issues: string[], where: string, startYear: number, endYear: number): void {
  if (!isValidYear(startYear)) issues.push(`${where}: invalid startYear ${startYear}`);
  if (!isValidYear(endYear)) issues.push(`${where}: invalid endYear ${endYear}`);
  if (startYear > endYear) issues.push(`${where}: startYear ${startYear} > endYear ${endYear}`);
}

function checkDayOfYear(issues: string[], where: string, month?: number, day?: number): void {
  if ((month === undefined) !== (day === undefined)) {
    issues.push(`${where}: month and day must be set together`);
    return;
  }
  if (month === undefined || day === undefined) return;
  if (!Number.isInteger(month) || month < 1 || month > 12)
    issues.push(`${where}: invalid month ${month}`);
  if (!Number.isInteger(day) || day < 1 || day > 31) issues.push(`${where}: invalid day ${day}`);
}

function checkSlugs(issues: string[], kind: string, slugs: string[]): Set<string> {
  const seen = new Set<string>();
  for (const slug of slugs) {
    if (!SLUG.test(slug)) issues.push(`${kind} "${slug}": slug must be kebab-case`);
    if (seen.has(slug)) issues.push(`${kind} "${slug}": duplicate slug`);
    seen.add(slug);
  }
  return seen;
}

/**
 * Checks seed data against the data-model rules (DM-xx) and the content rules
 * of the project before anything is written to the database.
 * Returns a list of human-readable problems; an empty list means the data is valid.
 */
export function validateSeedData(data: SeedData): string[] {
  const issues: string[] = [];

  // Eras: valid, ordered, non-overlapping periods
  checkSlugs(
    issues,
    'era',
    data.eras.map((e) => e.slug),
  );
  data.eras.forEach((era) => checkPeriod(issues, `era "${era.slug}"`, era.startYear, era.endYear));
  const erasByOrder = [...data.eras].sort((a, b) => a.sortOrder - b.sortOrder);
  for (let i = 1; i < erasByOrder.length; i++) {
    const prev = erasByOrder[i - 1];
    const curr = erasByOrder[i];
    if (curr.startYear <= prev.endYear) {
      issues.push(`era "${curr.slug}": overlaps or precedes era "${prev.slug}"`);
    }
  }

  // Regions: simplified closed polygons (DM-10)
  const regionSlugs = checkSlugs(
    issues,
    'region',
    data.regions.map((r) => r.slug),
  );
  for (const region of data.regions) {
    const where = `region "${region.slug}"`;
    if (region.geometry?.type !== 'Polygon') {
      issues.push(`${where}: geometry must be a Polygon`);
      continue;
    }
    const ring = region.geometry.coordinates[0] ?? [];
    if (ring.length < MIN_POLYGON_POINTS || ring.length > MAX_POLYGON_POINTS) {
      issues.push(
        `${where}: ring must have ${MIN_POLYGON_POINTS}-${MAX_POLYGON_POINTS} points, has ${ring.length}`,
      );
    }
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (!first || !last || first[0] !== last[0] || first[1] !== last[1]) {
      issues.push(`${where}: polygon ring must be closed (first point = last point)`);
    }
    for (const [lng, lat] of ring) {
      if (Math.abs(lng) > 180 || Math.abs(lat) > 90)
        issues.push(`${where}: point [${lng}, ${lat}] out of range`);
    }
    if (Math.abs(region.centerLat) > 90 || Math.abs(region.centerLng) > 180) {
      issues.push(`${where}: center out of range`);
    }
  }

  // Sources
  const sourceSlugs = checkSlugs(
    issues,
    'source',
    data.sources.map((s) => s.slug),
  );
  for (const source of data.sources) {
    if (!Object.values(SourceType).includes(source.type)) {
      issues.push(`source "${source.slug}": unknown type ${source.type}`);
    }
    if (!source.title.trim()) issues.push(`source "${source.slug}": empty title`);
  }

  // Cultures
  checkSlugs(
    issues,
    'culture',
    data.cultures.map((c) => c.slug),
  );
  const allCards = data.cultures.flatMap((c) => c.cards);
  const cardSlugs = checkSlugs(
    issues,
    'card',
    allCards.map((c) => c.slug),
  );
  checkSlugs(
    issues,
    'holiday',
    data.cultures.flatMap((c) => c.holidays.map((h) => h.slug)),
  );

  for (const culture of data.cultures) {
    const where = `culture "${culture.slug}"`;
    checkPeriod(issues, where, culture.startYear, culture.endYear);
    if (!HEX_COLOR.test(culture.color)) issues.push(`${where}: color must be #RRGGBB`);

    if (culture.regions.length === 0) issues.push(`${where}: has no regions`);
    for (const cr of culture.regions) {
      const crWhere = `${where} region "${cr.region}"`;
      if (!regionSlugs.has(cr.region)) issues.push(`${crWhere}: unknown region`);
      checkPeriod(issues, crWhere, cr.startYear, cr.endYear);
    }

    // Every card type is represented (the culture panel has a tab per type)
    for (const type of Object.values(CardType)) {
      if (!culture.cards.some((card) => card.type === type)) {
        issues.push(`${where}: no cards of type ${type}`);
      }
    }

    for (const card of culture.cards) {
      const cardWhere = `card "${card.slug}"`;
      if (!Object.values(CardType).includes(card.type))
        issues.push(`${cardWhere}: unknown type ${card.type}`);
      if (!card.title.trim() || !card.summary.trim())
        issues.push(`${cardWhere}: empty title or summary`);
      if (card.content.length === 0 || card.content.some((p) => !p.trim())) {
        issues.push(`${cardWhere}: content must have non-empty paragraphs`);
      }
      checkPeriod(issues, cardWhere, card.startYear, card.endYear);
      checkDayOfYear(issues, cardWhere, card.month, card.day);
      // Content rule: every card cites at least one real source
      if (card.sources.length === 0) issues.push(`${cardWhere}: has no sources`);
      for (const s of card.sources) {
        if (!sourceSlugs.has(s)) issues.push(`${cardWhere}: unknown source "${s}"`);
      }
    }

    // Card links (DM-06): known cards, no self-links, no duplicates
    const linkKeys = new Set<string>();
    for (const link of culture.links) {
      const linkWhere = `link ${link.from} -> ${link.to}`;
      if (!cardSlugs.has(link.from)) issues.push(`${linkWhere}: unknown card "${link.from}"`);
      if (!cardSlugs.has(link.to)) issues.push(`${linkWhere}: unknown card "${link.to}"`);
      if (link.from === link.to) issues.push(`${linkWhere}: a card cannot link to itself`);
      if (!Object.values(RelationType).includes(link.type))
        issues.push(`${linkWhere}: unknown type ${link.type}`);
      const key = `${link.from}|${link.to}|${link.type}`;
      if (linkKeys.has(key)) issues.push(`${linkWhere}: duplicate link`);
      linkKeys.add(key);
    }

    // Holidays (DM-05)
    for (const holiday of culture.holidays) {
      const hWhere = `holiday "${holiday.slug}"`;
      if (!Object.values(HolidayDateType).includes(holiday.dateType)) {
        issues.push(`${hWhere}: unknown dateType ${holiday.dateType}`);
      }
      checkDayOfYear(issues, hWhere, holiday.month, holiday.day);
      if (holiday.dateType === HolidayDateType.EXACT && holiday.month === undefined) {
        issues.push(`${hWhere}: EXACT holiday needs month and day`);
      }
      if (holiday.dateType === HolidayDateType.SEASON) {
        if (!holiday.season) issues.push(`${hWhere}: SEASON holiday needs a season`);
        else if (!Object.values(Season).includes(holiday.season))
          issues.push(`${hWhere}: unknown season`);
      }
      if (holiday.dateType !== HolidayDateType.EXACT && !holiday.dateNote?.trim()) {
        issues.push(`${hWhere}: non-exact date must be explained in dateNote`);
      }
      if (holiday.card && !cardSlugs.has(holiday.card))
        issues.push(`${hWhere}: unknown card "${holiday.card}"`);
      if (holiday.source && !sourceSlugs.has(holiday.source)) {
        issues.push(`${hWhere}: unknown source "${holiday.source}"`);
      }
    }
  }

  return issues;
}

/** Every `verify` note in the data, for the author's manual fact-check list. */
export function collectVerifyNotes(data: SeedData): string[] {
  const notes: string[] = [];
  const add = (where: string, note?: string): void => {
    if (note) notes.push(`${where}: ${note}`);
  };

  data.eras.forEach((e) => add(`era ${e.slug}`, e.verify));
  data.regions.forEach((r) => add(`region ${r.slug}`, r.verify));
  data.sources.forEach((s) => add(`source ${s.slug}`, s.verify));
  for (const c of data.cultures) {
    add(`culture ${c.slug}`, c.verify);
    c.regions.forEach((r) => add(`culture ${c.slug} / region ${r.region}`, r.verify));
    c.cards.forEach((card) => add(`card ${card.slug}`, card.verify));
    c.links.forEach((l) => add(`link ${l.from} -> ${l.to}`, l.verify));
    c.holidays.forEach((h) => add(`holiday ${h.slug}`, h.verify));
  }
  return notes;
}
