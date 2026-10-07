import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ACCESS_COOKIE } from '../auth/auth.constants';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators';
import { canSeeDrafts } from '../cards/card-visibility';
import {
  CreateNoteDto,
  NoteDto,
  NotesExportQueryDto,
  NotesQueryDto,
  UpdateNoteDto,
} from './dto/note.dto';
import { NotesService } from './notes.service';

@ApiTags('notes')
@ApiCookieAuth(ACCESS_COOKIE)
@ApiUnauthorizedResponse({ description: 'Not authenticated' })
@Controller('notes')
export class NotesController {
  constructor(private readonly notes: NotesService) {}

  @Get()
  @ApiOkResponse({ type: [NoteDto] })
  @ApiBadRequestResponse({ description: 'Invalid filter' })
  findMany(@CurrentUser() user: AuthUser, @Query() query: NotesQueryDto): Promise<NoteDto[]> {
    return this.notes.findMany(user.id, query);
  }

  /** Download of all notes of the user as a Markdown or PDF file. */
  @Get('export')
  @ApiProduces('text/markdown', 'application/pdf')
  @ApiOkResponse({ description: 'The file (attachment)' })
  @ApiBadRequestResponse({ description: 'Unknown format' })
  async export(
    @CurrentUser() user: AuthUser,
    @Query() query: NotesExportQueryDto,
  ): Promise<StreamableFile> {
    const file = await this.notes.export(user.id, query.format, query.lang);
    return new StreamableFile(Buffer.from(file.content), {
      type: file.contentType,
      disposition: `attachment; filename="${file.fileName}"`,
    });
  }

  @Post()
  @ApiCreatedResponse({ type: NoteDto })
  @ApiBadRequestResponse({ description: 'Validation failed or no card/culture given' })
  @ApiNotFoundResponse({ description: 'Unknown card or culture' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateNoteDto): Promise<NoteDto> {
    return this.notes.create(user.id, canSeeDrafts(user), dto);
  }

  @Patch(':id')
  @ApiOkResponse({ type: NoteDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiNotFoundResponse({ description: 'No such note of this user (BR-07)' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateNoteDto,
  ): Promise<NoteDto> {
    return this.notes.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Deleted' })
  @ApiNotFoundResponse({ description: 'No such note of this user (BR-07)' })
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.notes.remove(user.id, id);
  }
}
