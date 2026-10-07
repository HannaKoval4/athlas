import { Module } from '@nestjs/common';
import { RandomTopicController } from './random-topic.controller';
import { RandomTopicService } from './random-topic.service';

@Module({
  controllers: [RandomTopicController],
  providers: [RandomTopicService],
})
export class RandomTopicModule {}
