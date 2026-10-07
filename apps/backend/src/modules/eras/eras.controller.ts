import { Controller, Get } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { ACCESS_COOKIE } from '../auth/auth.constants';
import { EraDto } from './era.dto';
import { ErasService } from './eras.service';

@ApiTags('eras')
@ApiCookieAuth(ACCESS_COOKIE)
@ApiUnauthorizedResponse({ description: 'No valid session' })
@Controller('eras')
export class ErasController {
  constructor(private readonly eras: ErasService) {}

  @Get()
  @ApiOkResponse({ type: [EraDto] })
  findAll(): Promise<EraDto[]> {
    return this.eras.findAll();
  }
}
