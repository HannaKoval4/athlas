import type { RecordViewInput, ViewedCard } from '@atlas/shared';
import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { CardListItemDto } from '../../cards/dto/card.dto';

export class RecordViewDto implements RecordViewInput {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  cardId: string;
}

export class ViewedCardDto extends CardListItemDto implements ViewedCard {
  @ApiProperty({ format: 'date-time' })
  viewedAt: string;
}
