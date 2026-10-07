import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ACCESS_COOKIE } from '../auth/auth.constants';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators';
import { canSeeDrafts } from '../cards/card-visibility';
import { CalendarService } from './calendar.service';
import { HolidayDto, HolidaysQueryDto, TodayInHistoryDto, TodayQueryDto } from './dto/calendar.dto';

@ApiTags('calendar')
@ApiCookieAuth(ACCESS_COOKIE)
@ApiUnauthorizedResponse({ description: 'Not authenticated' })
@Controller()
export class CalendarController {
  constructor(private readonly calendar: CalendarService) {}

  @Get('calendar/today')
  @ApiOkResponse({ type: TodayInHistoryDto })
  @ApiBadRequestResponse({ description: 'Only one of month/day, or no such day' })
  today(@Query() query: TodayQueryDto, @CurrentUser() user: AuthUser): Promise<TodayInHistoryDto> {
    return this.calendar.today(query, canSeeDrafts(user));
  }

  @Get('holidays')
  @ApiOkResponse({ type: [HolidayDto] })
  @ApiBadRequestResponse({ description: 'Invalid culture id or month' })
  holidays(@Query() query: HolidaysQueryDto, @CurrentUser() user: AuthUser): Promise<HolidayDto[]> {
    return this.calendar.findHolidays(query, canSeeDrafts(user));
  }
}
