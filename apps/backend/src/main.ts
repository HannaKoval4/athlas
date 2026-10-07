import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  configureApp(app, {
    frontendOrigin: config.get<string>('FRONTEND_ORIGIN', 'http://localhost:5173'),
  });

  await app.listen(config.get<number>('PORT', 3000));
}
void bootstrap();
