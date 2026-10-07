import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ACCESS_COOKIE } from '../auth/auth.constants';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators';
import { canSeeDrafts } from '../cards/card-visibility';
import { RegionRefDto, SearchQueryDto, SearchResultsDto } from './dto/search.dto';
import { SearchService } from './search.service';

@ApiTags('search')
@ApiCookieAuth(ACCESS_COOKIE)
@ApiUnauthorizedResponse({ description: 'Not authenticated' })
@Controller()
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get('search')
  @ApiOkResponse({ type: SearchResultsDto })
  @ApiBadRequestResponse({ description: 'Invalid filter or yearFrom > yearTo' })
  find(@Query() query: SearchQueryDto, @CurrentUser() user: AuthUser): Promise<SearchResultsDto> {
    return this.search.search(query, canSeeDrafts(user));
  }

  /** Regions for the search filter (the map endpoint returns only the regions of one year). */
  @Get('regions')
  @ApiOkResponse({ type: [RegionRefDto] })
  regions(): Promise<RegionRefDto[]> {
    return this.search.findRegions();
  }
}
