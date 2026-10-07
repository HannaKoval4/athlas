import { type RandomTopic, TopicQuizStatus } from '@atlas/shared';
import { ApiProperty } from '@nestjs/swagger';
import { CultureRefDto } from '../../cards/dto/card.dto';

export class TopicEraDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'antiquity' })
  slug: string;

  @ApiProperty({ example: 'Античность' })
  name: string;
}

export class RandomTopicDto implements RandomTopic {
  @ApiProperty({ type: TopicEraDto })
  era: TopicEraDto;

  @ApiProperty({ type: CultureRefDto })
  culture: CultureRefDto;

  @ApiProperty({ example: 12 })
  cardsCount: number;

  @ApiProperty({ enum: TopicQuizStatus })
  quizStatus: TopicQuizStatus;

  @ApiProperty({ description: 'Every filled pair has a passed quiz; chosen among all pairs' })
  allQuizzesPassed: boolean;

  @ApiProperty({ example: -450, description: 'Year to open the map at' })
  year: number;
}
