import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { ErasModule } from './modules/eras/eras.module';
import { HealthModule } from './modules/health/health.module';
import { MapModule } from './modules/map/map.module';
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
  ],
})
export class AppModule {}
