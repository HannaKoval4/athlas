import { Module } from '@nestjs/common';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';
import { OpenLibraryClient } from './open-library.client';

@Module({
  controllers: [BooksController],
  providers: [BooksService, OpenLibraryClient],
})
export class BooksModule {}
