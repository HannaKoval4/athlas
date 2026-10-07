import { Module } from '@nestjs/common';
import { ErasModule } from '../eras/eras.module';
import { MapController } from './map.controller';
import { MapRepository } from './map.repository';
import { MapService } from './map.service';

@Module({
  imports: [ErasModule],
  controllers: [MapController],
  providers: [MapRepository, MapService],
})
export class MapModule {}
