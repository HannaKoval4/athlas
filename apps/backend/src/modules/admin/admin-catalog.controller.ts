import {
  Body,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { AdminCatalogService } from './admin-catalog.service';
import { AdminController } from './admin-controller.decorator';
import {
  AdminCultureDto,
  AdminCultureRegionDto,
  AdminEraDto,
  AdminHolidayDto,
  AdminRegionDto,
  CultureInputDto,
  CultureRegionInputDto,
  CultureRegionsQueryDto,
  EraInputDto,
  HolidayInputDto,
  HolidaysAdminQueryDto,
  RegionInputDto,
} from './dto/catalog.dto';

const id = () => Param('id', ParseUUIDPipe);

@AdminController('eras')
export class AdminErasController {
  constructor(private readonly catalog: AdminCatalogService) {}

  @Get()
  @ApiOkResponse({ type: [AdminEraDto] })
  findAll(): Promise<AdminEraDto[]> {
    return this.catalog.findEras();
  }

  @Post()
  @ApiCreatedResponse({ type: AdminEraDto })
  @ApiBadRequestResponse({ description: 'Validation failed or invalid period (DM-02)' })
  @ApiConflictResponse({ description: 'Slug taken' })
  create(@Body() dto: EraInputDto): Promise<AdminEraDto> {
    return this.catalog.createEra(dto);
  }

  @Put(':id')
  @ApiOkResponse({ type: AdminEraDto })
  @ApiNotFoundResponse({ description: 'No such era' })
  update(@id() eraId: string, @Body() dto: EraInputDto): Promise<AdminEraDto> {
    return this.catalog.updateEra(eraId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Deleted' })
  @ApiConflictResponse({ description: 'The era has quizzes' })
  remove(@id() eraId: string): Promise<void> {
    return this.catalog.removeEra(eraId);
  }
}

@AdminController('cultures')
export class AdminCulturesController {
  constructor(private readonly catalog: AdminCatalogService) {}

  @Get()
  @ApiOkResponse({ type: [AdminCultureDto] })
  findAll(): Promise<AdminCultureDto[]> {
    return this.catalog.findCultures();
  }

  @Post()
  @ApiCreatedResponse({ type: AdminCultureDto })
  @ApiBadRequestResponse({ description: 'Validation failed or invalid period (DM-02)' })
  @ApiConflictResponse({ description: 'Slug taken' })
  create(@Body() dto: CultureInputDto): Promise<AdminCultureDto> {
    return this.catalog.createCulture(dto);
  }

  @Put(':id')
  @ApiOkResponse({ type: AdminCultureDto })
  @ApiNotFoundResponse({ description: 'No such culture' })
  update(@id() cultureId: string, @Body() dto: CultureInputDto): Promise<AdminCultureDto> {
    return this.catalog.updateCulture(cultureId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Deleted with its regions, holidays and quizzes' })
  @ApiConflictResponse({ description: 'The culture has cards (BR-17)' })
  remove(@id() cultureId: string): Promise<void> {
    return this.catalog.removeCulture(cultureId);
  }
}

@AdminController('regions')
export class AdminRegionsController {
  constructor(private readonly catalog: AdminCatalogService) {}

  @Get()
  @ApiOkResponse({ type: [AdminRegionDto] })
  findAll(): Promise<AdminRegionDto[]> {
    return this.catalog.findRegions();
  }

  @Post()
  @ApiCreatedResponse({ type: AdminRegionDto })
  @ApiBadRequestResponse({ description: 'Validation failed or invalid GeoJSON (DM-10)' })
  @ApiConflictResponse({ description: 'Slug taken' })
  create(@Body() dto: RegionInputDto): Promise<AdminRegionDto> {
    return this.catalog.createRegion(dto);
  }

  @Put(':id')
  @ApiOkResponse({ type: AdminRegionDto })
  @ApiNotFoundResponse({ description: 'No such region' })
  update(@id() regionId: string, @Body() dto: RegionInputDto): Promise<AdminRegionDto> {
    return this.catalog.updateRegion(regionId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Deleted with its culture periods' })
  remove(@id() regionId: string): Promise<void> {
    return this.catalog.removeRegion(regionId);
  }
}

@AdminController('culture-regions')
export class AdminCultureRegionsController {
  constructor(private readonly catalog: AdminCatalogService) {}

  @Get()
  @ApiOkResponse({ type: [AdminCultureRegionDto] })
  findAll(@Query() query: CultureRegionsQueryDto): Promise<AdminCultureRegionDto[]> {
    return this.catalog.findCultureRegions(query);
  }

  @Post()
  @ApiCreatedResponse({ type: AdminCultureRegionDto })
  @ApiBadRequestResponse({
    description: 'Validation failed, invalid period, unknown culture/region',
  })
  @ApiConflictResponse({ description: 'Same culture, region and start year' })
  create(@Body() dto: CultureRegionInputDto): Promise<AdminCultureRegionDto> {
    return this.catalog.createCultureRegion(dto);
  }

  @Put(':id')
  @ApiOkResponse({ type: AdminCultureRegionDto })
  @ApiNotFoundResponse({ description: 'No such period' })
  update(
    @id() periodId: string,
    @Body() dto: CultureRegionInputDto,
  ): Promise<AdminCultureRegionDto> {
    return this.catalog.updateCultureRegion(periodId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Deleted' })
  remove(@id() periodId: string): Promise<void> {
    return this.catalog.removeCultureRegion(periodId);
  }
}

@AdminController('holidays')
export class AdminHolidaysController {
  constructor(private readonly catalog: AdminCatalogService) {}

  @Get()
  @ApiOkResponse({ type: [AdminHolidayDto] })
  findAll(@Query() query: HolidaysAdminQueryDto): Promise<AdminHolidayDto[]> {
    return this.catalog.findHolidays(query);
  }

  @Post()
  @ApiCreatedResponse({ type: AdminHolidayDto })
  @ApiBadRequestResponse({
    description: 'Validation failed or date fields do not match the type (DM-05)',
  })
  @ApiConflictResponse({ description: 'Slug taken' })
  create(@Body() dto: HolidayInputDto): Promise<AdminHolidayDto> {
    return this.catalog.createHoliday(dto);
  }

  @Put(':id')
  @ApiOkResponse({ type: AdminHolidayDto })
  @ApiNotFoundResponse({ description: 'No such holiday' })
  update(@id() holidayId: string, @Body() dto: HolidayInputDto): Promise<AdminHolidayDto> {
    return this.catalog.updateHoliday(holidayId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Deleted' })
  remove(@id() holidayId: string): Promise<void> {
    return this.catalog.removeHoliday(holidayId);
  }
}
