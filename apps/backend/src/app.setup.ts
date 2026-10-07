import { API_DOCS_PATH, API_PREFIX } from '@atlas/shared';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { ACCESS_COOKIE } from './modules/auth/auth.constants';

export interface AppSetupOptions {
  /** The only origin allowed by CORS (the frontend dev server or production host). */
  frontendOrigin: string;
}

/**
 * Global HTTP configuration shared by main.ts and e2e tests,
 * so tests exercise exactly the same pipeline as the running app.
 */
export function configureApp(app: INestApplication, options: AppSetupOptions): void {
  app.setGlobalPrefix(API_PREFIX);

  app.use(helmet());
  // Populates req.cookies: the auth tokens arrive as httpOnly cookies.
  app.use(cookieParser());
  app.enableCors({
    origin: options.frontendOrigin,
    // Auth uses httpOnly cookies, so the browser must be allowed to send them.
    credentials: true,
    // Lets the frontend read the file name of downloads (notes export).
    exposedHeaders: ['Content-Disposition'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Atlas API')
    .setDescription('Interactive atlas of history, mythology and traditions')
    .setVersion('0.1.0')
    // Log in via POST /api/auth/login in Swagger UI; the browser then sends the cookie itself.
    .addCookieAuth(ACCESS_COOKIE)
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${API_PREFIX}/${API_DOCS_PATH}`, app, document);
}
