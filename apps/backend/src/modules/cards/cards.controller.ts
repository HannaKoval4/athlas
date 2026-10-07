import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ACCESS_COOKIE } from '../auth/auth.constants';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators';
import { canSeeDrafts } from './card-visibility';
import { CardsService } from './cards.service';
import { CardDetailsDto, CardPageDto } from './dto/card.dto';
import { CardsQueryDto } from './dto/cards-query.dto';

@ApiTags('cards')
@ApiCookieAuth(ACCESS_COOKIE)
@ApiUnauthorizedResponse({ description: 'Not authenticated' })
@Controller('cards')
export class CardsController {
  constructor(private readonly cards: CardsService) {}

  @Get()
  @ApiOkResponse({ type: CardPageDto })
  @ApiBadRequestResponse({ description: 'Invalid filter or pagination parameter' })
  @ApiNotFoundResponse({ description: 'Unknown era' })
  findMany(@Query() query: CardsQueryDto, @CurrentUser() user: AuthUser): Promise<CardPageDto> {
    return this.cards.findMany(query, canSeeDrafts(user));
  }

  @Get(':slug')
  @ApiOkResponse({ type: CardDetailsDto })
  @ApiNotFoundResponse({ description: 'Unknown card, or a draft requested by a user (BR-06)' })
  findOne(@Param('slug') slug: string, @CurrentUser() user: AuthUser): Promise<CardDetailsDto> {
    return this.cards.findBySlug(slug, canSeeDrafts(user));
  }
}
