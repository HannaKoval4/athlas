import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ACCESS_COOKIE } from '../auth/auth.constants';
import { MapQueryDto } from './dto/map-query.dto';
import { MapSliceDto } from './dto/map-slice.dto';
import { MapService } from './map.service';

@ApiTags('map')
@ApiCookieAuth(ACCESS_COOKIE)
@ApiUnauthorizedResponse({ description: 'Not authenticated' })
@Controller('map')
export class MapController {
  constructor(private readonly map: MapService) {}

  /** Time slice: regions with materials in the given year (BR-04). */
  @Get()
  @ApiOkResponse({ type: MapSliceDto })
  @ApiBadRequestResponse({ description: 'Invalid year, or the year is outside the era (BR-05)' })
  @ApiNotFoundResponse({ description: 'Unknown era' })
  getSlice(@Query() query: MapQueryDto): Promise<MapSliceDto> {
    return this.map.getSlice(query.year, query.era);
  }
}
