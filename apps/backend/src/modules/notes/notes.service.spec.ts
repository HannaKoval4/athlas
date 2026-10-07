import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import { NotesService } from './notes.service';

const CARD_ID = '6f1c1a52-6a8b-4c55-9d43-0d0c1f6b1a01';
const CULTURE_ID = '6f1c1a52-6a8b-4c55-9d43-0d0c1f6b1a02';
const OTHER_CULTURE_ID = '6f1c1a52-6a8b-4c55-9d43-0d0c1f6b1a03';
const NOTE_ID = '6f1c1a52-6a8b-4c55-9d43-0d0c1f6b1a04';

const row = {
  id: NOTE_ID,
  title: null,
  content: 'Text',
  createdAt: new Date('2026-10-01T10:00:00.000Z'),
  updatedAt: new Date('2026-10-02T10:00:00.000Z'),
  card: null,
  culture: { id: CULTURE_ID, slug: 'greece', name: 'Греция', color: '#000000' },
};

describe('NotesService', () => {
  const prisma = {
    note: {
      findMany: jest.fn<Promise<unknown[]>, [unknown]>(),
      findFirst: jest.fn<Promise<unknown>, [unknown]>(),
      create: jest.fn<Promise<unknown>, [unknown]>(),
      update: jest.fn<Promise<unknown>, [unknown]>(),
      deleteMany: jest.fn<Promise<{ count: number }>, [unknown]>(),
    },
    card: { findFirst: jest.fn<Promise<unknown>, [unknown]>() },
    culture: { findUnique: jest.fn<Promise<unknown>, [unknown]>() },
  };
  const service = new NotesService(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.note.create.mockResolvedValue(row);
    prisma.note.update.mockResolvedValue(row);
  });

  describe('create', () => {
    it('rejects a note without a card and a culture (note_target_chk)', async () => {
      await expect(service.create('u1', false, { content: 'Text' })).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.note.create).not.toHaveBeenCalled();
    });

    it("stores the card's culture with a card note", async () => {
      prisma.card.findFirst.mockResolvedValue({ cultureId: CULTURE_ID });

      await service.create('u1', false, { content: 'Text', cardId: CARD_ID });

      expect(prisma.note.create.mock.calls[0]?.[0]).toMatchObject({
        data: { userId: 'u1', cardId: CARD_ID, cultureId: CULTURE_ID },
      });
    });

    it('looks the card up among published cards only for a user (BR-06)', async () => {
      prisma.card.findFirst.mockResolvedValue(null);

      await expect(
        service.create('u1', false, { content: 'Text', cardId: CARD_ID }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.card.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: CARD_ID, published: true } }),
      );
    });

    it('rejects a card from another culture than the given one', async () => {
      prisma.card.findFirst.mockResolvedValue({ cultureId: CULTURE_ID });

      await expect(
        service.create('u1', false, { content: 'T', cardId: CARD_ID, cultureId: OTHER_CULTURE_ID }),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns 404 for an unknown culture', async () => {
      prisma.culture.findUnique.mockResolvedValue(null);

      await expect(
        service.create('u1', false, { content: 'Text', cultureId: CULTURE_ID }),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns dates as ISO strings', async () => {
      prisma.culture.findUnique.mockResolvedValue({ id: CULTURE_ID });

      const note = await service.create('u1', false, { content: 'Text', cultureId: CULTURE_ID });

      expect(note.createdAt).toBe('2026-10-01T10:00:00.000Z');
      expect(note.updatedAt).toBe('2026-10-02T10:00:00.000Z');
    });
  });

  describe('ownership (BR-07)', () => {
    it('scopes the list by user', async () => {
      prisma.note.findMany.mockResolvedValue([]);

      await service.findMany('u1', { cultureId: CULTURE_ID });

      expect(prisma.note.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'u1', cardId: undefined, cultureId: CULTURE_ID },
        }),
      );
    });

    it("answers 404 when updating somebody else's note", async () => {
      prisma.note.findFirst.mockResolvedValue(null);

      await expect(service.update('u2', NOTE_ID, { content: 'X' })).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.note.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: NOTE_ID, userId: 'u2' } }),
      );
      expect(prisma.note.update).not.toHaveBeenCalled();
    });

    it("answers 404 when deleting somebody else's note", async () => {
      prisma.note.deleteMany.mockResolvedValue({ count: 0 });

      await expect(service.remove('u2', NOTE_ID)).rejects.toThrow(NotFoundException);
      expect(prisma.note.deleteMany).toHaveBeenCalledWith({ where: { id: NOTE_ID, userId: 'u2' } });
    });
  });

  describe('export', () => {
    it("exports only the user's notes as a Markdown attachment (BR-19)", async () => {
      prisma.note.findMany.mockResolvedValue([row]);

      const file = await service.export('u1', 'md', 'ru');

      expect(prisma.note.findMany.mock.calls[0]?.[0]).toMatchObject({ where: { userId: 'u1' } });
      expect(file.contentType).toBe('text/markdown; charset=utf-8');
      expect(file.fileName).toMatch(/^atlas-notes-\d{4}-\d{2}-\d{2}\.md$/);
      expect(file.content).toContain('## Греция');
    });
  });
});
