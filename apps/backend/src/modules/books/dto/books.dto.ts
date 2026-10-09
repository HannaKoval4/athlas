import type { Book } from '@atlas/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

/** Exactly one of the two (checked in the service: class-validator has no "one of"). */
export class BooksQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  cardId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  cultureId?: string;
}

export class BookDto implements Book {
  @ApiProperty({ example: '/works/OL4290372W' })
  key: string;

  @ApiProperty({ example: 'The Parthenon' })
  title: string;

  @ApiProperty({ type: [String], example: ['Jenifer Neils'] })
  authors: string[];

  @ApiProperty({ type: Number, nullable: true, example: 2005 })
  firstPublishYear: number | null;

  @ApiProperty({ type: String, nullable: true })
  coverUrl: string | null;

  @ApiProperty({ example: 'https://openlibrary.org/works/OL4290372W' })
  url: string;
}
