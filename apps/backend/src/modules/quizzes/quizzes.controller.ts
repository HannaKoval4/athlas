import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ACCESS_COOKIE } from '../auth/auth.constants';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators';
import { canSeeDrafts } from '../cards/card-visibility';
import {
  AchievementDto,
  AttemptResultDto,
  QuizSummaryDto,
  QuizzesQueryDto,
  StartedAttemptDto,
  SubmitAttemptDto,
} from './dto/quiz.dto';
import { QuizzesService } from './quizzes.service';

@ApiTags('quizzes')
@ApiCookieAuth(ACCESS_COOKIE)
@ApiUnauthorizedResponse({ description: 'Not authenticated' })
@Controller()
export class QuizzesController {
  constructor(private readonly quizzes: QuizzesService) {}

  @Get('quizzes')
  @ApiOkResponse({ type: [QuizSummaryDto] })
  @ApiBadRequestResponse({ description: 'Invalid era or culture id' })
  findMany(
    @Query() query: QuizzesQueryDto,
    @CurrentUser() user: AuthUser,
  ): Promise<QuizSummaryDto[]> {
    return this.quizzes.findMany(query, user.id);
  }

  @Get('quizzes/attempts/:id')
  @ApiOkResponse({ type: AttemptResultDto })
  @ApiNotFoundResponse({ description: 'No such attempt of this user' })
  @ApiConflictResponse({ description: 'The attempt is not finished yet' })
  result(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<AttemptResultDto> {
    return this.quizzes.result(id, user.id, canSeeDrafts(user));
  }

  @Post('quizzes/attempts/:id/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AttemptResultDto })
  @ApiBadRequestResponse({ description: 'Answer to a foreign question or option' })
  @ApiNotFoundResponse({ description: 'No such attempt of this user' })
  @ApiConflictResponse({ description: 'The attempt is already finished (BR-11)' })
  submit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitAttemptDto,
    @CurrentUser() user: AuthUser,
  ): Promise<AttemptResultDto> {
    return this.quizzes.submit(id, user.id, dto, canSeeDrafts(user));
  }

  @Get('quizzes/:id')
  @ApiOkResponse({ type: QuizSummaryDto })
  @ApiNotFoundResponse({ description: 'No such quiz' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<QuizSummaryDto> {
    return this.quizzes.findOne(id, user.id);
  }

  @Post('quizzes/:id/attempts')
  @ApiCreatedResponse({ type: StartedAttemptDto })
  @ApiNotFoundResponse({ description: 'No such quiz' })
  @ApiConflictResponse({ description: 'The quiz has no questions' })
  start(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<StartedAttemptDto> {
    return this.quizzes.start(id, user.id);
  }

  @Get('users/me/achievements')
  @ApiTags('users')
  @ApiOkResponse({ type: [AchievementDto] })
  achievements(@CurrentUser() user: AuthUser): Promise<AchievementDto[]> {
    return this.quizzes.achievements(user.id);
  }
}
