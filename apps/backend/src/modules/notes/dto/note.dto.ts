import {
  type CreateNoteInput,
  NOTE_CONTENT_MAX_LENGTH,
  NOTE_EXPORT_FORMATS,
  NOTE_TITLE_MAX_LENGTH,
  type Note,
  type NoteCardRef,
  type NoteExportFormat,
  SUPPORTED_LOCALES,
  type AppLocale,
  type UpdateNoteInput,
} from '@atlas/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { CardType } from '../../../generated/prisma/enums';
import { CultureRefDto } from '../../cards/dto/card.dto';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** An empty or blank title means "no title". */
const trimTitle = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() || null : value;

export class NoteCardRefDto implements NoteCardRef {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'parthenon' })
  slug: string;

  @ApiProperty({ example: 'Парфенон' })
  title: string;

  @ApiProperty({ enum: CardType })
  type: CardType;
}

export class NoteDto implements Note {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ type: String, nullable: true })
  title: string | null;

  @ApiProperty({ description: 'Markdown written by the user' })
  content: string;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;

  @ApiProperty({ type: NoteCardRefDto, nullable: true })
  card: NoteCardRefDto | null;

  @ApiProperty({ type: CultureRefDto, nullable: true })
  culture: CultureRefDto | null;
}

export class CreateNoteDto implements CreateNoteInput {
  @ApiProperty({ maxLength: NOTE_CONTENT_MAX_LENGTH })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(NOTE_CONTENT_MAX_LENGTH)
  content: string;

  @ApiPropertyOptional({ maxLength: NOTE_TITLE_MAX_LENGTH })
  @Transform(trimTitle)
  @IsOptional()
  @IsString()
  @MaxLength(NOTE_TITLE_MAX_LENGTH)
  title?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'The card the note is about' })
  @IsOptional()
  @IsUUID()
  cardId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'The culture the note is about; for a card note it is taken from the card',
  })
  @IsOptional()
  @IsUUID()
  cultureId?: string;
}

/** PATCH: only the text can change; a note keeps its card/culture. */
export class UpdateNoteDto implements UpdateNoteInput {
  @ApiPropertyOptional({ maxLength: NOTE_CONTENT_MAX_LENGTH })
  @Transform(trim)
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(NOTE_CONTENT_MAX_LENGTH)
  content?: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: NOTE_TITLE_MAX_LENGTH,
    description: 'null or an empty string removes the title',
  })
  @Transform(trimTitle)
  @IsOptional()
  @IsString()
  @MaxLength(NOTE_TITLE_MAX_LENGTH)
  title?: string | null;
}

export class NotesQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  cardId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Includes the notes on its cards' })
  @IsOptional()
  @IsUUID()
  cultureId?: string;
}

export class NotesExportQueryDto {
  @ApiProperty({ enum: NOTE_EXPORT_FORMATS })
  @IsIn(NOTE_EXPORT_FORMATS)
  format: NoteExportFormat;

  @ApiPropertyOptional({ enum: SUPPORTED_LOCALES, default: 'ru', description: 'Headings language' })
  @IsOptional()
  @IsIn(SUPPORTED_LOCALES)
  lang: AppLocale = 'ru';
}
