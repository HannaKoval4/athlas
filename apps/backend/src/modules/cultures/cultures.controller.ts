import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiPropertyOptional,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { IsHistoricalYear } from '../../common/query.validators';
import { ACCESS_COOKIE } from '../auth/auth.constants';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators';
import { canSeeDrafts } from '../cards/card-visibility';
import { CultureGraphDto } from './dto/culture-graph.dto';
import { CultureDetailsDto, CultureSummaryDto } from './dto/culture.dto';
import { CulturesService } from './cultures.service';

export class CultureQueryDto {
  @ApiPropertyOptional({ example: -450, description: 'Count only cards existing in this year' })
  @IsOptional()
  @IsHistoricalYear()
  year?: number;
}

@ApiTags('cultures')
@ApiCookieAuth(ACCESS_COOKIE)
@ApiUnauthorizedResponse({ description: 'Not authenticated' })
@Controller('cultures')
export class CulturesController {
  constructor(private readonly cultures: CulturesService) {}

  @Get()
  @ApiOkResponse({ type: [CultureSummaryDto] })
  findAll(): Promise<CultureSummaryDto[]> {
    return this.cultures.findAll();
  }

  /** Link graph of the culture panel: visible cards and the links between them. */
  @Get(':slug/graph')
  @ApiOkResponse({ type: CultureGraphDto })
  @ApiBadRequestResponse({ description: 'Invalid year' })
  @ApiNotFoundResponse({ description: 'Unknown culture' })
  graph(
    @Param('slug') slug: string,
    @Query() query: CultureQueryDto,
    @CurrentUser() user: AuthUser,
  ): Promise<CultureGraphDto> {
    return this.cultures.getGraph(slug, { year: query.year, includeDrafts: canSeeDrafts(user) });
  }

  @Get(':slug')
  @ApiOkResponse({ type: CultureDetailsDto })
  @ApiBadRequestResponse({ description: 'Invalid year' })
  @ApiNotFoundResponse({ description: 'Unknown culture' })
  findOne(
    @Param('slug') slug: string,
    @Query() query: CultureQueryDto,
    @CurrentUser() user: AuthUser,
  ): Promise<CultureDetailsDto> {
    return this.cultures.findBySlug(slug, { year: query.year, includeDrafts: canSeeDrafts(user) });
  }
}
