import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiProperty,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { Public } from '../auth/decorators';

export class HealthResponseDto {
  @ApiProperty({ example: 'ok' })
  status: 'ok';

  @ApiProperty({ example: 'up' })
  database: 'up';
}

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Readiness probe: the API is up and can reach PostgreSQL. */
  @Get()
  @ApiOkResponse({ type: HealthResponseDto })
  @ApiServiceUnavailableResponse({ description: 'Database is not reachable' })
  async check(): Promise<HealthResponseDto> {
    if (!(await this.prisma.isAlive())) {
      throw new ServiceUnavailableException('Database is not reachable');
    }
    return { status: 'ok', database: 'up' };
  }
}
