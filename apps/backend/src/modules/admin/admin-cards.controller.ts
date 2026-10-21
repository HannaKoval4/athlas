import {
  Body,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { RelationType } from '../../generated/prisma/enums';
import { AdminCardsService } from './admin-cards.service';
import { AdminController } from './admin-controller.decorator';
import {
  AdminCardDto,
  AdminCardLinkDto,
  AdminCardPageDto,
  AdminCardSourceDto,
  AdminCardsQueryDto,
  AdminSourceDto,
  CardInputDto,
  CardLinkInputDto,
  CardSourceInputDto,
  CardSourcePagesDto,
  SourceInputDto,
} from './dto/cards.dto';

const uuid = (name: string) => Param(name, ParseUUIDPipe);

@AdminController('cards')
export class AdminCardsController {
  constructor(private readonly cards: AdminCardsService) {}

  @Get()
  @ApiOkResponse({ type: AdminCardPageDto, description: 'Drafts included, recently edited first' })
  findAll(@Query() query: AdminCardsQueryDto): Promise<AdminCardPageDto> {
    return this.cards.findCards(query);
  }

  @Get(':id')
  @ApiOkResponse({ type: AdminCardDto })
  @ApiNotFoundResponse({ description: 'No such card' })
  findOne(@uuid('id') id: string): Promise<AdminCardDto> {
    return this.cards.findCard(id);
  }

  @Post()
  @ApiCreatedResponse({ type: AdminCardDto, description: 'Created as a draft' })
  @ApiBadRequestResponse({ description: 'Validation failed, invalid period/day, unknown culture' })
  @ApiConflictResponse({ description: 'Slug taken' })
  create(@Body() dto: CardInputDto): Promise<AdminCardDto> {
    return this.cards.createCard(dto);
  }

  @Put(':id')
  @ApiOkResponse({ type: AdminCardDto })
  @ApiNotFoundResponse({ description: 'No such card' })
  update(@uuid('id') id: string, @Body() dto: CardInputDto): Promise<AdminCardDto> {
    return this.cards.updateCard(id, dto);
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AdminCardDto, description: 'publishedAt is set by the database (DM-09)' })
  @ApiNotFoundResponse({ description: 'No such card' })
  publish(@uuid('id') id: string): Promise<AdminCardDto> {
    return this.cards.setPublished(id, true);
  }

  @Post(':id/unpublish')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AdminCardDto })
  @ApiNotFoundResponse({ description: 'No such card' })
  unpublish(@uuid('id') id: string): Promise<AdminCardDto> {
    return this.cards.setPublished(id, false);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Deleted with its links and sources; notes stay' })
  @ApiNotFoundResponse({ description: 'No such card' })
  remove(@uuid('id') id: string): Promise<void> {
    return this.cards.removeCard(id);
  }
}

@AdminController('card-links')
export class AdminCardLinksController {
  constructor(private readonly cards: AdminCardsService) {}

  @Post()
  @ApiCreatedResponse({ type: AdminCardLinkDto })
  @ApiBadRequestResponse({ description: 'Link to itself (BR-18) or unknown card' })
  @ApiConflictResponse({ description: 'Duplicate link (BR-18)' })
  create(@Body() dto: CardLinkInputDto): Promise<AdminCardLinkDto> {
    return this.cards.createLink(dto);
  }

  @Delete(':fromCardId/:toCardId/:relationType')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Deleted' })
  @ApiNotFoundResponse({ description: 'No such link' })
  remove(
    @uuid('fromCardId') fromCardId: string,
    @uuid('toCardId') toCardId: string,
    @Param('relationType', new ParseEnumPipe(RelationType)) relationType: RelationType,
  ): Promise<void> {
    return this.cards.removeLink({ fromCardId, toCardId, relationType });
  }
}

@AdminController('sources')
export class AdminSourcesController {
  constructor(private readonly cards: AdminCardsService) {}

  @Get()
  @ApiOkResponse({ type: [AdminSourceDto] })
  findAll(): Promise<AdminSourceDto[]> {
    return this.cards.findSources();
  }

  @Post()
  @ApiCreatedResponse({ type: AdminSourceDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiConflictResponse({ description: 'Slug taken' })
  create(@Body() dto: SourceInputDto): Promise<AdminSourceDto> {
    return this.cards.createSource(dto);
  }

  @Put(':id')
  @ApiOkResponse({ type: AdminSourceDto })
  @ApiNotFoundResponse({ description: 'No such source' })
  update(@uuid('id') id: string, @Body() dto: SourceInputDto): Promise<AdminSourceDto> {
    return this.cards.updateSource(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Deleted' })
  @ApiConflictResponse({ description: 'The source is cited by cards (BR-17)' })
  remove(@uuid('id') id: string): Promise<void> {
    return this.cards.removeSource(id);
  }
}

@AdminController('card-sources')
export class AdminCardSourcesController {
  constructor(private readonly cards: AdminCardsService) {}

  @Post()
  @ApiCreatedResponse({ type: AdminCardSourceDto })
  @ApiBadRequestResponse({ description: 'Unknown card or source' })
  @ApiConflictResponse({ description: 'Already attached' })
  create(@Body() dto: CardSourceInputDto): Promise<AdminCardSourceDto> {
    return this.cards.addCardSource(dto);
  }

  @Put(':cardId/:sourceId')
  @ApiOkResponse({ type: AdminCardSourceDto })
  @ApiNotFoundResponse({ description: 'Not attached' })
  update(
    @uuid('cardId') cardId: string,
    @uuid('sourceId') sourceId: string,
    @Body() dto: CardSourcePagesDto,
  ): Promise<AdminCardSourceDto> {
    return this.cards.updateCardSource(cardId, sourceId, dto);
  }

  @Delete(':cardId/:sourceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Detached' })
  @ApiNotFoundResponse({ description: 'Not attached' })
  remove(@uuid('cardId') cardId: string, @uuid('sourceId') sourceId: string): Promise<void> {
    return this.cards.removeCardSource(cardId, sourceId);
  }
}
