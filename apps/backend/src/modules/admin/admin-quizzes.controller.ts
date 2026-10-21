import {
  Body,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { AdminController } from './admin-controller.decorator';
import { AdminQuizzesService } from './admin-quizzes.service';
import {
  AdminQuestionDto,
  AdminQuizDto,
  QuestionInputDto,
  QuestionsQueryDto,
  QuizInputDto,
} from './dto/quizzes.dto';

const id = () => Param('id', ParseUUIDPipe);

@AdminController('quizzes')
export class AdminQuizzesController {
  constructor(private readonly quizzes: AdminQuizzesService) {}

  @Get()
  @ApiOkResponse({ type: [AdminQuizDto] })
  findAll(): Promise<AdminQuizDto[]> {
    return this.quizzes.findQuizzes();
  }

  @Post()
  @ApiCreatedResponse({ type: AdminQuizDto })
  @ApiBadRequestResponse({ description: 'Validation failed or unknown era/culture' })
  @ApiConflictResponse({ description: 'The era + culture pair already has a quiz (DM-08)' })
  create(@Body() dto: QuizInputDto): Promise<AdminQuizDto> {
    return this.quizzes.createQuiz(dto);
  }

  @Put(':id')
  @ApiOkResponse({ type: AdminQuizDto })
  @ApiNotFoundResponse({ description: 'No such quiz' })
  update(@id() quizId: string, @Body() dto: QuizInputDto): Promise<AdminQuizDto> {
    return this.quizzes.updateQuiz(quizId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Deleted with its questions, attempts and achievement' })
  remove(@id() quizId: string): Promise<void> {
    return this.quizzes.removeQuiz(quizId);
  }
}

@AdminController('questions')
export class AdminQuestionsController {
  constructor(private readonly quizzes: AdminQuizzesService) {}

  @Get()
  @ApiOkResponse({ type: [AdminQuestionDto], description: 'The question pool of a quiz' })
  findAll(@Query() query: QuestionsQueryDto): Promise<AdminQuestionDto[]> {
    return this.quizzes.findQuestions(query.quizId);
  }

  @Post()
  @ApiCreatedResponse({ type: AdminQuestionDto })
  @ApiBadRequestResponse({ description: 'Validation failed or invalid option set' })
  create(@Body() dto: QuestionInputDto): Promise<AdminQuestionDto> {
    return this.quizzes.createQuestion(dto);
  }

  @Put(':id')
  @ApiOkResponse({ type: AdminQuestionDto })
  @ApiBadRequestResponse({ description: 'Invalid option set or a foreign option id' })
  @ApiNotFoundResponse({ description: 'No such question' })
  update(@id() questionId: string, @Body() dto: QuestionInputDto): Promise<AdminQuestionDto> {
    return this.quizzes.updateQuestion(questionId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Deleted' })
  remove(@id() questionId: string): Promise<void> {
    return this.quizzes.removeQuestion(questionId);
  }
}
