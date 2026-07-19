import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { IsISO8601, IsOptional } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';

class RangeQuery {
  @IsOptional() @IsISO8601() dateFrom?: string;
  @IsOptional() @IsISO8601() dateTo?: string;
}

@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('overview')
  overview(@Query() q: RangeQuery) {
    return this.analytics.overview(q);
  }

  @Get('trends')
  trends(@Query() q: RangeQuery) {
    return this.analytics.trends(q);
  }

  @Get('top-products')
  topProducts(@Query() q: RangeQuery) {
    return this.analytics.topProducts(q);
  }

  @Get('by-shop')
  byShop(@Query() q: RangeQuery) {
    return this.analytics.byShop(q);
  }

  @Get('chat-volume')
  chatVolume() {
    return this.analytics.chatVolume();
  }

  @Get('repeat-claims')
  repeatClaims() {
    return this.analytics.repeatClaims();
  }
}
