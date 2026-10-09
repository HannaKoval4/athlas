import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { CardsModule } from './modules/cards/cards.module';
import { CulturesModule } from './modules/cultures/cultures.module';
import { ErasModule } from './modules/eras/eras.module';
import { FeedModule } from './modules/feed/feed.module';
import { HealthModule } from './modules/health/health.module';
import { HistoryModule } from './modules/history/history.module';
import { MapModule } from './modules/map/map.module';
import { NotesModule } from './modules/notes/notes.module';
import { QuizzesModule } from './modules/quizzes/quizzes.module';
import { RandomTopicModule } from './modules/random/random-topic.module';
import { SearchModule } from './modules/search/search.module';
import { UsersModule } from './modules/users/users.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Scripts run with cwd = apps/backend; the single .env lives in the repo root.
      // The first file found wins for each variable; real env variables win over both.
      envFilePath: [join(process.cwd(), '.env'), join(process.cwd(), '..', '..', '.env')],
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    ErasModule,
    MapModule,
    CulturesModule,
    CardsModule,
    NotesModule,
    SearchModule,
    CalendarModule,
    RandomTopicModule,
    FeedModule,
    HistoryModule,
    QuizzesModule,
  ],
})
export class AppModule {}
