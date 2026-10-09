import type {
  Achievement,
  AttemptOption,
  AttemptQuestion,
  AttemptResult,
  QuestionReview,
  QuizBest,
  QuizEraRef,
  QuizSummary,
  QuizzesQuery,
  StartedAttempt,
  SubmitAttemptInput,
  SubmittedAnswer,
} from '@atlas/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsOptional, IsUUID, ValidateNested } from 'class-validator';
import { CultureRefDto } from '../../cards/dto/card.dto';

/** More answers than questions in any attempt is never valid; caps the request size. */
const MAX_ANSWERS = 100;

export class QuizzesQueryDto implements QuizzesQuery {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  eraId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  cultureId?: string;
}

export class SubmittedAnswerDto implements SubmittedAnswer {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  questionId: string;

  @ApiProperty({ type: [String], format: 'uuid', description: 'Chosen options; empty = skipped' })
  @IsArray()
  @ArrayMaxSize(MAX_ANSWERS)
  @IsUUID('all', { each: true })
  optionIds: string[];
}

export class SubmitAttemptDto implements SubmitAttemptInput {
  @ApiProperty({ type: [SubmittedAnswerDto] })
  @IsArray()
  @ArrayMaxSize(MAX_ANSWERS)
  @ValidateNested({ each: true })
  @Type(() => SubmittedAnswerDto)
  answers: SubmittedAnswerDto[];
}

export class QuizEraRefDto implements QuizEraRef {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'antiquity' })
  slug: string;

  @ApiProperty({ example: 'Античность' })
  name: string;
}

export class QuizBestDto implements QuizBest {
  @ApiProperty()
  score: number;

  @ApiProperty()
  total: number;

  @ApiProperty()
  passed: boolean;
}

export class QuizSummaryDto implements QuizSummary {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ type: QuizEraRefDto })
  era: QuizEraRefDto;

  @ApiProperty({ type: CultureRefDto })
  culture: CultureRefDto;

  @ApiProperty({ example: 10 })
  questionsPerAttempt: number;

  @ApiProperty({ example: 70 })
  passPercent: number;

  @ApiProperty({ example: 16 })
  poolSize: number;

  @ApiProperty({ type: QuizBestDto, nullable: true, description: 'Best finished attempt (BR-12)' })
  best: QuizBestDto | null;

  @ApiProperty({ description: 'Finished attempts of the user' })
  attempts: number;
}

export class AttemptOptionDto implements AttemptOption {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  text: string;
}

export class AttemptQuestionDto implements AttemptQuestion {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  text: string;

  @ApiProperty()
  multiple: boolean;

  @ApiProperty({ type: [AttemptOptionDto], description: 'Shuffled; no isCorrect' })
  options: AttemptOptionDto[];
}

export class StartedAttemptDto implements StartedAttempt {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ type: QuizSummaryDto })
  quiz: QuizSummaryDto;

  @ApiProperty({ type: [AttemptQuestionDto] })
  questions: AttemptQuestionDto[];
}

export class ReviewOptionDto extends AttemptOptionDto {
  @ApiProperty()
  isCorrect: boolean;
}

export class ReviewCardDto {
  @ApiProperty()
  slug: string;

  @ApiProperty()
  title: string;
}

export class QuestionReviewDto implements QuestionReview {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  text: string;

  @ApiProperty()
  multiple: boolean;

  @ApiProperty({ type: [ReviewOptionDto] })
  options: ReviewOptionDto[];

  @ApiProperty({ type: [String] })
  selectedOptionIds: string[];

  @ApiProperty()
  isCorrect: boolean;

  @ApiProperty()
  explanation: string;

  @ApiProperty({ type: ReviewCardDto, nullable: true })
  card: ReviewCardDto | null;
}

export class AchievementQuizDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ type: QuizEraRefDto })
  era: QuizEraRefDto;

  @ApiProperty({ type: CultureRefDto })
  culture: CultureRefDto;
}

export class AchievementDto implements Achievement {
  @ApiProperty({ example: 'ERA_STUDIED:6f1c…' })
  code: string;

  @ApiProperty({ example: 'achievements.eraStudied' })
  titleKey: string;

  @ApiProperty({ type: AchievementQuizDto, nullable: true })
  quiz: AchievementQuizDto | null;

  @ApiProperty({ format: 'date-time' })
  earnedAt: string;
}

export class AttemptResultDto implements AttemptResult {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ type: QuizSummaryDto })
  quiz: QuizSummaryDto;

  @ApiProperty()
  score: number;

  @ApiProperty()
  total: number;

  @ApiProperty()
  passed: boolean;

  @ApiProperty({ format: 'date-time' })
  finishedAt: string;

  @ApiProperty({ type: [QuestionReviewDto] })
  review: QuestionReviewDto[];

  @ApiProperty({ type: AchievementDto, nullable: true })
  newAchievement: AchievementDto | null;
}
