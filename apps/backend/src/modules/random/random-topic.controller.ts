import { Controller, Get } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ACCESS_COOKIE } from '../auth/auth.constants';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators';
import { RandomTopicDto } from './dto/random-topic.dto';
import { RandomTopicService } from './random-topic.service';

@ApiTags('random-topic')
@ApiCookieAuth(ACCESS_COOKIE)
@ApiUnauthorizedResponse({ description: 'Not authenticated' })
@Controller('random-topic')
export class RandomTopicController {
  constructor(private readonly topics: RandomTopicService) {}

  @Get()
  @ApiOkResponse({ type: RandomTopicDto })
  @ApiNotFoundResponse({ description: 'No era + culture pair has published cards' })
  pick(@CurrentUser() user: AuthUser): Promise<RandomTopicDto> {
    return this.topics.pick(user.id);
  }
}
