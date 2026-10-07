import { Module } from '@nestjs/common';
import { CulturesController } from './cultures.controller';
import { CulturesService } from './cultures.service';

@Module({
  controllers: [CulturesController],
  providers: [CulturesService],
})
export class CulturesModule {}
