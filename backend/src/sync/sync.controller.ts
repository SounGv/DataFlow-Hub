import { Controller, Get, Param, Post, Query, Res, Sse, UseGuards } from '@nestjs/common';
import Redis from 'ioredis';
import { Observable } from 'rxjs';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { SyncService, SYNC_EVENTS_CHANNEL } from './sync.service';

@UseGuards(JwtAuthGuard)
@Controller('sync')
export class SyncController {
  constructor(
    private readonly sync: SyncService,
    private readonly prisma: PrismaService,
  ) {}

  /** Trigger full sync of all enabled data sources */
  @Post('run')
  async run() {
    const enqueued = await this.sync.enqueueAll();
    return { enqueued };
  }

  /** Trigger sync of a single data source */
  @Post('run/:dataSourceId')
  async runOne(@Param('dataSourceId') id: string) {
    await this.sync.enqueueOne(BigInt(id));
    return { enqueued: 1 };
  }

  /** Latest run per source — Sync Monitor table */
  @Get('status')
  status() {
    return this.sync.status();
  }

  /** Run history */
  @Get('runs')
  runs(@Query('limit') limit = '50') {
    return this.prisma.syncRun.findMany({
      include: { dataSource: true },
      orderBy: { startedAt: 'desc' },
      take: Math.min(parseInt(limit, 10) || 50, 200),
    });
  }

  /** Row-level errors of a run */
  @Get('runs/:id/errors')
  runErrors(@Param('id') id: string) {
    return this.prisma.syncRowError.findMany({
      where: { syncRunId: BigInt(id) },
      orderBy: { sourceRow: 'asc' },
      take: 500,
    });
  }

  /** Live sync events (SSE) — Sync Monitor live feed */
  @Sse('stream')
  stream(): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      const sub = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
      sub.subscribe(SYNC_EVENTS_CHANNEL);
      sub.on('message', (_ch, msg) => {
        subscriber.next({ data: msg } as MessageEvent);
      });
      return () => sub.disconnect();
    });
  }
}
