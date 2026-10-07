import { type AppLocale, type NoteExportFormat, groupNotes } from '@atlas/shared';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { visibleCards } from '../cards/card-visibility';
import type { CreateNoteDto, NoteDto, NotesQueryDto, UpdateNoteDto } from './dto/note.dto';
import { exportFileName, renderMarkdown, renderPdf } from './notes-export';

const noteSelect = {
  id: true,
  title: true,
  content: true,
  createdAt: true,
  updatedAt: true,
  card: { select: { id: true, slug: true, title: true, type: true } },
  culture: { select: { id: true, slug: true, name: true, color: true } },
} satisfies Prisma.NoteSelect;

type NoteRow = Prisma.NoteGetPayload<{ select: typeof noteSelect }>;

function toDto(row: NoteRow): NoteDto {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export interface NotesFile {
  content: Buffer | string;
  contentType: string;
  fileName: string;
}

/**
 * Private notes (F-07). Every query is scoped by userId, so somebody else's note behaves
 * exactly like a missing one: 404, its existence is not revealed (BR-07).
 */
@Injectable()
export class NotesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Newest first; ?cultureId also returns the notes on the culture's cards. */
  async findMany(userId: string, query: NotesQueryDto): Promise<NoteDto[]> {
    const rows = await this.prisma.note.findMany({
      where: { userId, cardId: query.cardId, cultureId: query.cultureId },
      select: noteSelect,
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map(toDto);
  }

  /**
   * A note is about a card or a culture (note_target_chk). A card note also stores the card's
   * culture: the culture panel lists it, and it survives the deletion of the card (SetNull).
   * Notes can be attached only to cards the user can see (BR-06).
   */
  async create(userId: string, includeDrafts: boolean, dto: CreateNoteDto): Promise<NoteDto> {
    let cultureId = dto.cultureId;
    if (dto.cardId) {
      const card = await this.prisma.card.findFirst({
        where: { id: dto.cardId, ...visibleCards(includeDrafts) },
        select: { cultureId: true },
      });
      if (!card) throw new NotFoundException(`Card ${dto.cardId} not found`);
      if (cultureId && cultureId !== card.cultureId) {
        throw new BadRequestException('The card belongs to another culture');
      }
      cultureId = card.cultureId;
    } else if (cultureId) {
      const culture = await this.prisma.culture.findUnique({
        where: { id: cultureId },
        select: { id: true },
      });
      if (!culture) throw new NotFoundException(`Culture ${cultureId} not found`);
    } else {
      throw new BadRequestException('A note needs a cardId or a cultureId');
    }

    const row = await this.prisma.note.create({
      data: {
        userId,
        title: dto.title ?? null,
        content: dto.content,
        cardId: dto.cardId,
        cultureId,
      },
      select: noteSelect,
    });
    return toDto(row);
  }

  async update(userId: string, id: string, dto: UpdateNoteDto): Promise<NoteDto> {
    await this.findOwn(userId, id);
    const row = await this.prisma.note.update({
      where: { id },
      data: { title: dto.title, content: dto.content },
      select: noteSelect,
    });
    return toDto(row);
  }

  async remove(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.note.deleteMany({ where: { id, userId } });
    if (count === 0) throw new NotFoundException(`Note ${id} not found`);
  }

  /** F-08 / BR-19: only the user's own notes, grouped culture -> card, with creation dates. */
  async export(userId: string, format: NoteExportFormat, lang: AppLocale): Promise<NotesFile> {
    const notes = await this.findMany(userId, {});
    const groups = groupNotes(notes, lang);
    const options = { lang, exportedAt: new Date() };
    const fileName = exportFileName(format, options.exportedAt);
    return format === 'pdf'
      ? { content: await renderPdf(groups, options), contentType: 'application/pdf', fileName }
      : {
          content: renderMarkdown(groups, options),
          contentType: 'text/markdown; charset=utf-8',
          fileName,
        };
  }

  private async findOwn(userId: string, id: string): Promise<void> {
    const note = await this.prisma.note.findFirst({ where: { id, userId }, select: { id: true } });
    if (!note) throw new NotFoundException(`Note ${id} not found`);
  }
}
