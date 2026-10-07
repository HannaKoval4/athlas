import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MapQueryDto } from './map-query.dto';

/** Query strings arrive as strings; the DTO must convert and validate them like the global pipe. */
async function errorsFor(query: Record<string, string>): Promise<string[]> {
  const dto = plainToInstance(MapQueryDto, query);
  const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  return errors.map((error) => error.property);
}

describe('MapQueryDto', () => {
  it.each(['-450', '1', '-1', '-10000', '2100'])('accepts year=%s', async (year) => {
    await expect(errorsFor({ year })).resolves.toEqual([]);
  });

  it('converts the year to a number', () => {
    expect(plainToInstance(MapQueryDto, { year: '-450' }).year).toBe(-450);
  });

  it.each(['0', '1.5', 'abc', '', '-10001', '2101'])('rejects year=%p', async (year) => {
    await expect(errorsFor({ year })).resolves.toEqual(['year']);
  });

  it('requires the year', async () => {
    await expect(errorsFor({})).resolves.toEqual(['year']);
  });

  it('accepts an era slug', async () => {
    await expect(errorsFor({ year: '-450', era: 'antiquity' })).resolves.toEqual([]);
  });

  it.each(['Antiquity', 'a b', "x' OR 1=1"])('rejects era=%p', async (era) => {
    await expect(errorsFor({ year: '-450', era })).resolves.toEqual(['era']);
  });

  it('rejects unknown parameters', async () => {
    await expect(errorsFor({ year: '-450', region: 'crete' })).resolves.toEqual(['region']);
  });
});
