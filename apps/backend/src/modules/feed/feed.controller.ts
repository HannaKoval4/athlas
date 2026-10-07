import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ACCESS_COOKIE } from '../auth/auth.constants';
import { FeedCardDto, FeedQueryDto } from './dto/feed.dto';
import { FeedService } from './feed.service';

@ApiTags('feed')
@ApiCookieAuth(ACCESS_COOKIE)
@ApiUnauthorizedResponse({ description: 'Not authenticated' })
@Controller('feed')
export class FeedController {
  constructor(private readonly feed: FeedService) {}

  @Get('new')
  @ApiOkResponse({ type: [FeedCardDto] })
  @ApiBadRequestResponse({ description: 'Invalid limit' })
  findNew(@Query() query: FeedQueryDto): Promise<FeedCardDto[]> {
    return this.feed.findNew(query.limit);
  }
}
