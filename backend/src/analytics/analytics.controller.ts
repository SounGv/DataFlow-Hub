import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { IsIn, IsISO8601, IsOptional } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';

class RangeQuery {
  @IsOptional() @IsISO8601() dateFrom?: string;
  @IsOptional() @IsISO8601() dateTo?: string;
}

class TrendQuery extends RangeQuery {
  @IsOptional() @IsIn(['contacts', 'shipments', 'after_sales']) metric?: string;
  @IsOptional() @IsIn(['day', 'week', 'month', 'year']) bucket?: string;
  @IsOptional() compare?: string;
}

@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('overview')
  overview(@Query() q: RangeQuery) {
    return this.analytics.overview(q);
  }

  /** PHASE 2 — KPI cards: current/previous/%change/sparkline */
  @Get('kpis')
  kpis(@Query() q: RangeQuery) {
    return this.analytics.kpis(q);
  }

  /** PHASE 2 — Business Performance Trend (metric + bucket + compare) */
  @Get('business-trend')
  businessTrend(@Query() q: TrendQuery) {
    return this.analytics.businessTrend(
      q.metric ?? 'after_sales',
      q.bucket ?? 'day',
      q,
      q.compare === '1' || q.compare === 'true',
    );
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
