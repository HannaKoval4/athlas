-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ThemePreference" AS ENUM ('LIGHT', 'DARK', 'SYSTEM');

-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('RU', 'EN');

-- CreateEnum
CREATE TYPE "CardType" AS ENUM ('MYTHOLOGY', 'EVENT', 'TRADITION', 'FACT', 'ARTWORK', 'PERSON', 'ARTIFACT');

-- CreateEnum
CREATE TYPE "RelationType" AS ENUM ('RELATED', 'PART_OF', 'DEPICTS', 'CREATED_BY', 'CELEBRATES', 'MENTIONS');

-- CreateEnum
CREATE TYPE "HolidayDateType" AS ENUM ('EXACT', 'SEASON', 'MOVABLE', 'APPROXIMATE');

-- CreateEnum
CREATE TYPE "Season" AS ENUM ('SPRING', 'SUMMER', 'AUTUMN', 'WINTER');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('BOOK', 'ARTICLE', 'ENCYCLOPEDIA', 'MUSEUM', 'WEBSITE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "theme" "ThemePreference" NOT NULL DEFAULT 'SYSTEM',
    "locale" "Locale" NOT NULL DEFAULT 'RU',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Era" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startYear" INTEGER NOT NULL,
    "endYear" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Era_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Culture" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "startYear" INTEGER NOT NULL,
    "endYear" INTEGER NOT NULL,
    "dateApproximate" BOOLEAN NOT NULL DEFAULT false,
    "color" TEXT NOT NULL,

    CONSTRAINT "Culture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Region" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "geojson" JSONB NOT NULL,
    "centerLat" DOUBLE PRECISION NOT NULL,
    "centerLng" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CultureRegion" (
    "id" TEXT NOT NULL,
    "cultureId" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "startYear" INTEGER NOT NULL,
    "endYear" INTEGER NOT NULL,
    "dateApproximate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CultureRegion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Card" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "CardType" NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "cultureId" TEXT NOT NULL,
    "startYear" INTEGER NOT NULL,
    "endYear" INTEGER NOT NULL,
    "month" INTEGER,
    "day" INTEGER,
    "dateApproximate" BOOLEAN NOT NULL DEFAULT false,
    "imageUrl" TEXT,
    "imageCredit" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    -- [manual] Full-text search vector, maintained by PostgreSQL itself.
    -- Weights: title A > summary B > content C; 'russian' config handles word forms.
    "search_vector" tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('russian', coalesce("title", '')), 'A') ||
        setweight(to_tsvector('russian', coalesce("summary", '')), 'B') ||
        setweight(to_tsvector('russian', coalesce("content", '')), 'C')
    ) STORED,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardLink" (
    "fromCardId" TEXT NOT NULL,
    "toCardId" TEXT NOT NULL,
    "relationType" "RelationType" NOT NULL,

    CONSTRAINT "CardLink_pkey" PRIMARY KEY ("fromCardId","toCardId","relationType")
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "SourceType" NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "publisher" TEXT,
    "year" INTEGER,
    "url" TEXT,
    "accessedAt" TIMESTAMP(3),

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardSource" (
    "cardId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "pages" TEXT,

    CONSTRAINT "CardSource_pkey" PRIMARY KEY ("cardId","sourceId")
);

-- CreateTable
CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "cultureId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "dateType" "HolidayDateType" NOT NULL,
    "month" INTEGER,
    "day" INTEGER,
    "season" "Season",
    "dateNote" TEXT,
    "cardId" TEXT,
    "sourceId" TEXT,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "cardId" TEXT,
    "cultureId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ViewHistory" (
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ViewHistory_pkey" PRIMARY KEY ("userId","cardId")
);

-- CreateTable
CREATE TABLE "Quiz" (
    "id" TEXT NOT NULL,
    "eraId" TEXT NOT NULL,
    "cultureId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "questionsPerAttempt" INTEGER NOT NULL DEFAULT 10,
    "passPercent" INTEGER NOT NULL DEFAULT 70,

    CONSTRAINT "Quiz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "multiple" BOOLEAN NOT NULL DEFAULT false,
    "cardId" TEXT,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnswerOption" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,

    CONSTRAINT "AnswerOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "questionIds" TEXT[],
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "score" INTEGER,
    "total" INTEGER NOT NULL,
    "passed" BOOLEAN,

    CONSTRAINT "QuizAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttemptAnswer" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "selectedOptionIds" TEXT[],
    "isCorrect" BOOLEAN NOT NULL,

    CONSTRAINT "AttemptAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "titleKey" TEXT NOT NULL,
    "descriptionKey" TEXT NOT NULL,
    "quizId" TEXT,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAchievement" (
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAchievement_pkey" PRIMARY KEY ("userId","achievementId")
);

-- CreateTable
CREATE TABLE "BookCache" (
    "id" TEXT NOT NULL,
    "queryKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Era_slug_key" ON "Era"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Culture_slug_key" ON "Culture"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Region_slug_key" ON "Region"("slug");

-- CreateIndex
CREATE INDEX "CultureRegion_startYear_endYear_idx" ON "CultureRegion"("startYear", "endYear");

-- CreateIndex
CREATE UNIQUE INDEX "CultureRegion_cultureId_regionId_startYear_key" ON "CultureRegion"("cultureId", "regionId", "startYear");

-- CreateIndex
CREATE UNIQUE INDEX "Card_slug_key" ON "Card"("slug");

-- CreateIndex
CREATE INDEX "Card_cultureId_type_idx" ON "Card"("cultureId", "type");

-- CreateIndex
CREATE INDEX "Card_startYear_endYear_idx" ON "Card"("startYear", "endYear");

-- CreateIndex
CREATE INDEX "Card_published_publishedAt_idx" ON "Card"("published", "publishedAt");

-- CreateIndex
CREATE INDEX "Card_month_day_idx" ON "Card"("month", "day");

-- CreateIndex
CREATE INDEX "card_search_idx" ON "Card" USING GIN ("search_vector");

-- CreateIndex
CREATE INDEX "CardLink_toCardId_idx" ON "CardLink"("toCardId");

-- CreateIndex
CREATE UNIQUE INDEX "Source_slug_key" ON "Source"("slug");

-- CreateIndex
CREATE INDEX "CardSource_sourceId_idx" ON "CardSource"("sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "Holiday_slug_key" ON "Holiday"("slug");

-- CreateIndex
CREATE INDEX "Holiday_month_day_idx" ON "Holiday"("month", "day");

-- CreateIndex
CREATE INDEX "Holiday_cultureId_idx" ON "Holiday"("cultureId");

-- CreateIndex
CREATE INDEX "Note_userId_cardId_idx" ON "Note"("userId", "cardId");

-- CreateIndex
CREATE INDEX "Note_userId_cultureId_idx" ON "Note"("userId", "cultureId");

-- CreateIndex
CREATE INDEX "ViewHistory_userId_viewedAt_idx" ON "ViewHistory"("userId", "viewedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Quiz_eraId_cultureId_key" ON "Quiz"("eraId", "cultureId");

-- CreateIndex
CREATE INDEX "Question_quizId_idx" ON "Question"("quizId");

-- CreateIndex
CREATE INDEX "AnswerOption_questionId_idx" ON "AnswerOption"("questionId");

-- CreateIndex
CREATE INDEX "QuizAttempt_userId_quizId_idx" ON "QuizAttempt"("userId", "quizId");

-- CreateIndex
CREATE UNIQUE INDEX "AttemptAnswer_attemptId_questionId_key" ON "AttemptAnswer"("attemptId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "Achievement_code_key" ON "Achievement"("code");

-- CreateIndex
CREATE UNIQUE INDEX "BookCache_queryKey_key" ON "BookCache"("queryKey");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CultureRegion" ADD CONSTRAINT "CultureRegion_cultureId_fkey" FOREIGN KEY ("cultureId") REFERENCES "Culture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CultureRegion" ADD CONSTRAINT "CultureRegion_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_cultureId_fkey" FOREIGN KEY ("cultureId") REFERENCES "Culture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardLink" ADD CONSTRAINT "CardLink_fromCardId_fkey" FOREIGN KEY ("fromCardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardLink" ADD CONSTRAINT "CardLink_toCardId_fkey" FOREIGN KEY ("toCardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardSource" ADD CONSTRAINT "CardSource_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardSource" ADD CONSTRAINT "CardSource_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holiday" ADD CONSTRAINT "Holiday_cultureId_fkey" FOREIGN KEY ("cultureId") REFERENCES "Culture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holiday" ADD CONSTRAINT "Holiday_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holiday" ADD CONSTRAINT "Holiday_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_cultureId_fkey" FOREIGN KEY ("cultureId") REFERENCES "Culture"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViewHistory" ADD CONSTRAINT "ViewHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViewHistory" ADD CONSTRAINT "ViewHistory_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_eraId_fkey" FOREIGN KEY ("eraId") REFERENCES "Era"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_cultureId_fkey" FOREIGN KEY ("cultureId") REFERENCES "Culture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnswerOption" ADD CONSTRAINT "AnswerOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttemptAnswer" ADD CONSTRAINT "AttemptAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "QuizAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttemptAnswer" ADD CONSTRAINT "AttemptAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- [manual] CHECK constraints (Prisma schema language cannot express them)
-- ============================================================================

-- BR-01: e-mail is stored in lower case so uniqueness is case-insensitive
ALTER TABLE "User" ADD CONSTRAINT user_email_lower_chk CHECK ("email" = lower("email"));

-- DM-01 / DM-02: periods are ordered and never use the non-existent year 0
ALTER TABLE "Era" ADD CONSTRAINT era_period_chk
    CHECK ("startYear" <= "endYear" AND "startYear" <> 0 AND "endYear" <> 0);
ALTER TABLE "Culture" ADD CONSTRAINT culture_period_chk
    CHECK ("startYear" <= "endYear" AND "startYear" <> 0 AND "endYear" <> 0);
ALTER TABLE "CultureRegion" ADD CONSTRAINT cr_period_chk
    CHECK ("startYear" <= "endYear" AND "startYear" <> 0 AND "endYear" <> 0);
ALTER TABLE "Card" ADD CONSTRAINT card_period_chk
    CHECK ("startYear" <= "endYear" AND "startYear" <> 0 AND "endYear" <> 0);

-- Calendar day of a dated card: both fields or neither, within valid ranges
ALTER TABLE "Card" ADD CONSTRAINT card_date_chk
    CHECK (("month" IS NULL AND "day" IS NULL)
        OR ("month" BETWEEN 1 AND 12 AND "day" BETWEEN 1 AND 31));

-- DM-06: a card cannot link to itself
ALTER TABLE "CardLink" ADD CONSTRAINT cardlink_self_chk CHECK ("fromCardId" <> "toCardId");

-- DM-07: a note belongs to a card and/or a culture
ALTER TABLE "Note" ADD CONSTRAINT note_target_chk
    CHECK ("cardId" IS NOT NULL OR "cultureId" IS NOT NULL);

-- DM-05: EXACT holidays have a valid month+day, SEASON holidays have a season
ALTER TABLE "Holiday" ADD CONSTRAINT holiday_exact_chk
    CHECK ("dateType" <> 'EXACT'
        OR ("month" BETWEEN 1 AND 12 AND "day" BETWEEN 1 AND 31));
ALTER TABLE "Holiday" ADD CONSTRAINT holiday_season_chk
    CHECK ("dateType" <> 'SEASON' OR "season" IS NOT NULL);
ALTER TABLE "Holiday" ADD CONSTRAINT holiday_date_range_chk
    CHECK (("month" IS NULL OR "month" BETWEEN 1 AND 12) AND ("day" IS NULL OR "day" BETWEEN 1 AND 31));

-- Quiz settings
ALTER TABLE "Quiz" ADD CONSTRAINT quiz_pass_chk CHECK ("passPercent" BETWEEN 1 AND 100);
ALTER TABLE "Quiz" ADD CONSTRAINT quiz_questions_chk CHECK ("questionsPerAttempt" > 0);
