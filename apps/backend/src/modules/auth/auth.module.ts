import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthCookiesService } from './auth-cookies.service';
import { AuthController } from './auth.controller';
import { AUTH_THROTTLE_DEFAULT_LIMIT, AUTH_THROTTLE_TTL_MS } from './auth.constants';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

@Module({
  imports: [
    // Secrets differ for access and refresh tokens, so TokenService passes them per call.
    JwtModule.register({}),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: AUTH_THROTTLE_TTL_MS,
          limit: Number(
            config.get<string>('THROTTLE_AUTH_LIMIT', `${AUTH_THROTTLE_DEFAULT_LIMIT}`),
          ),
        },
      ],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    PasswordService,
    AuthCookiesService,
    // Global guards run in registration order: authenticate first, then check the role.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [TokenService, PasswordService, AuthCookiesService],
})
export class AuthModule {}
