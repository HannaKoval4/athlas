import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { type EraDto, toEraDto } from './era.dto';

@Injectable()
export class ErasService {
  constructor(private readonly prisma: PrismaService) {}

  /** All eras in the order of the era selector (DM-08). */
  async findAll(): Promise<EraDto[]> {
    const eras = await this.prisma.era.findMany({
      orderBy: [{ sortOrder: 'asc' }, { startYear: 'asc' }],
    });
    return eras.map(toEraDto);
  }

  async findBySlug(slug: string): Promise<EraDto> {
    const era = await this.prisma.era.findUnique({ where: { slug } });
    if (!era) {
      throw new NotFoundException(`Era "${slug}" not found`);
    }
    return toEraDto(era);
  }
}
