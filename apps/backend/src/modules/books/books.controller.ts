import { Controller, Get, Query } from '@nestjs/common';
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
import { canSeeDrafts } from '../cards/card-visibility';
import { BooksService } from './books.service';
import { BookDto, BooksQueryDto } from './dto/books.dto';

@ApiTags('books')
@ApiCookieAuth(ACCESS_COOKIE)
@ApiUnauthorizedResponse({ description: 'Not authenticated' })
@Controller('books')
export class BooksController {
  constructor(private readonly books: BooksService) {}

  @Get()
  @ApiOkResponse({
    type: [BookDto],
    description: 'Up to 5 books from Open Library; empty when the service is unavailable',
  })
  @ApiBadRequestResponse({ description: 'Not exactly one of cardId and cultureId' })
  @ApiNotFoundResponse({ description: 'No such card or culture' })
  find(@Query() query: BooksQueryDto, @CurrentUser() user: AuthUser): Promise<BookDto[]> {
    return this.books.findFor(query, canSeeDrafts(user));
  }
}
