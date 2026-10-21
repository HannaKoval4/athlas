import { Module } from '@nestjs/common';
import {
  AdminCultureRegionsController,
  AdminCulturesController,
  AdminErasController,
  AdminHolidaysController,
  AdminRegionsController,
} from './admin-catalog.controller';
import { AdminCatalogService } from './admin-catalog.service';
import {
  AdminCardLinksController,
  AdminCardSourcesController,
  AdminCardsController,
  AdminSourcesController,
} from './admin-cards.controller';
import { AdminCardsService } from './admin-cards.service';
import { AdminQuestionsController, AdminQuizzesController } from './admin-quizzes.controller';
import { AdminQuizzesService } from './admin-quizzes.service';

/** F-18: content management for the ADMIN role (/api/admin/*). */
@Module({
  controllers: [
    AdminErasController,
    AdminCulturesController,
    AdminRegionsController,
    AdminCultureRegionsController,
    AdminHolidaysController,
    AdminCardsController,
    AdminCardLinksController,
    AdminSourcesController,
    AdminCardSourcesController,
    AdminQuizzesController,
    AdminQuestionsController,
  ],
  providers: [AdminCatalogService, AdminCardsService, AdminQuizzesService],
})
export class AdminModule {}
