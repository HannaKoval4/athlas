import type {
  AdminAnswerOption,
  AdminQuestion,
  AdminQuiz,
  AnswerOptionInput,
  QuestionInput,
  QuizInput,
} from '@atlas/shared';
import { ANSWER_OPTIONS_MAX } from '@atlas/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsOptional, IsUUID, ValidateNested } from 'class-validator';
import { CultureRefDto } from '../../cards/dto/card.dto';
import { QuizEraRefDto } from '../../quizzes/dto/quiz.dto';
import { AdminCardRefDto } from './cards.dto';
import {
  BooleanField,
  IntField,
  LONG_TEXT_MAX,
  NullableUuidField,
  TextField,
  UuidField,
} from './admin-fields';

export class QuizInputDto implements QuizInput {
  @UuidField()
  eraId: string;

  @UuidField()
  cultureId: string;

  @TextField()
  title: string;

  @IntField(1, 50)
  questionsPerAttempt: number;

  @IntField(1, 100)
  passPercent: number;
}

export class AdminQuizDto extends QuizInputDto implements AdminQuiz {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ type: QuizEraRefDto })
  era: QuizEraRefDto;

  @ApiProperty({ type: CultureRefDto })
  culture: CultureRefDto;

  @ApiProperty()
  questionCount: number;
}

export class AnswerOptionInputDto implements AnswerOptionInput {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'An existing option of this question: it is updated in place',
  })
  @IsOptional()
  @IsUUID()
  id?: string;

  @TextField(500)
  text: string;

  @BooleanField()
  isCorrect: boolean;
}

export class QuestionInputDto implements QuestionInput {
  @UuidField()
  quizId: string;

  @TextField(1000)
  text: string;

  @TextField(LONG_TEXT_MAX)
  explanation: string;

  @BooleanField()
  multiple: boolean;

  @NullableUuidField()
  cardId: string | null = null;

  @ApiProperty({
    type: [AnswerOptionInputDto],
    description: '2-8 distinct options, at least one correct; exactly one unless multiple',
  })
  @IsArray()
  @ArrayMaxSize(ANSWER_OPTIONS_MAX)
  @ValidateNested({ each: true })
  @Type(() => AnswerOptionInputDto)
  options: AnswerOptionInputDto[];
}

export class QuestionsQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  quizId: string;
}

export class AdminAnswerOptionDto implements AdminAnswerOption {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  text: string;

  @ApiProperty()
  isCorrect: boolean;
}

export class AdminQuestionDto implements AdminQuestion {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  quizId: string;

  @ApiProperty()
  text: string;

  @ApiProperty()
  explanation: string;

  @ApiProperty()
  multiple: boolean;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  cardId: string | null;

  @ApiProperty({ type: AdminCardRefDto, nullable: true })
  card: AdminCardRefDto | null;

  @ApiProperty({ type: [AdminAnswerOptionDto] })
  options: AdminAnswerOptionDto[];
}
