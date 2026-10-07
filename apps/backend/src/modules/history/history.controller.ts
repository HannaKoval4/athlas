import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ACCESS_COOKIE } from '../auth/auth.constants';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators';
import { canSeeDrafts } from '../cards/card-visibility';
import { RecordViewDto, ViewedCardDto } from './dto/history.dto';
import { HistoryService } from './history.service';

@ApiTags('users')
@ApiCookieAuth(ACCESS_COOKIE)
@ApiUnauthorizedResponse({ description: 'Not authenticated' })
@Controller('users/me/history')
export class HistoryController {
  constructor(private readonly history: HistoryService) {}

  @Get()
  @ApiOkResponse({ type: [ViewedCardDto] })
  findRecent(@CurrentUser() user: AuthUser): Promise<ViewedCardDto[]> {
    return this.history.findRecent(user.id, canSeeDrafts(user));
  }

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'View recorded, or its time updated' })
  @ApiBadRequestResponse({ description: 'cardId is not a UUID' })
  @ApiNotFoundResponse({ description: 'No such card, or a draft for a regular user' })
  record(@CurrentUser() user: AuthUser, @Body() dto: RecordViewDto): Promise<void> {
    return this.history.record(user.id, dto.cardId, canSeeDrafts(user));
  }
}
