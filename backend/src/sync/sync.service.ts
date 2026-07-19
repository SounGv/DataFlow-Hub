import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { PROCESSORS } from './processors/registry';
import { SheetsClient } from './sheets.client';

export const SYNC_QUEUE = 'sheet-sync';
export const SYNC_EVENTS_CHANNEL = 'sync-events';

export interface SyncEvent {
  type: 'started' | 'progress' | 'finished' | 'failed';
  sheetName: string;
  runId?: string;
  rowsRead?: number;
  rowsUpserted?: number;
  rowsRejected?: number;
  error?: string;
  at: string;
}

@Injectable()
export class SyncService implements OnModuleDestroy {
  private readonly logger = new Logger(SyncService.name);
  readonly queue: Queue;
  private readonly redisPub: Redis;

  constructor(private readonly prisma: PrismaService) {
    const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
    this.queue = new Queue(SYNC_QUEUE, { connection: { url } as never });
    this.redisPub = new Redis(url);
  }

  async onModuleDestroy() {
    await this.queue.close();
    this.redisPub.disconnect();
  }

  /** Enqueue every enabled data source (ordered) — called by cron or POST /sync/run */
  async enqueueAll(): Promise<number> {
    const sources = await this.prisma.dataSource.findMany({
      where: { enabled: true },
      orderBy: { syncOrder: 'asc' },
    });
    for (const s of sources) {
      await this.queue.add(
        'sync-sheet',
        { dataSourceId: s.id.toString() },
        { jobId: `ds-${s.id}`, removeOnComplete: 100, removeOnFail: 100 },
      );
    }
    return sources.length;
  }

  async enqueueOne(dataSourceId: bigint): Promise<void> {
    await this.queue.add(
      'sync-sheet',
      { dataSourceId: dataSourceId.toString() },
      { jobId: `ds-${dataSourceId}-${Date.now()}`, removeOnComplete: 100, removeOnFail: 100 },
    );
  }

  async publish(event: SyncEvent): Promise<void> {
    await this.redisPub.publish(SYNC_EVENTS_CHANNEL, JSON.stringify(event));
  }

  /**
   * Execute one sync job — used by the worker process.
   * Extract → Normalize/Validate (processor) → Upsert → record sync_run + row errors.
   */
  async runDataSource(dataSourceId: bigint): Promise<void> {
    const ds = await this.prisma.dataSource.findUnique({ where: { id: dataSourceId } });
    if (!ds || !ds.enabled) return;
    const processor = PROCESSORS[ds.processor];
    if (!processor) {
      this.logger.error(`Unknown processor "${ds.processor}" for sheet "${ds.sheetName}"`);
      return;
    }

    const run = await this.prisma.syncRun.create({
      data: { dataSourceId: ds.id, startedAt: new Date(), status: 'running' },
    });
    await this.publish({ type: 'started', sheetName: ds.sheetName, runId: run.id.toString(), at: new Date().toISOString() });

    try {
      const sheets = new SheetsClient();
      const rows = await sheets.readSheet(ds.spreadsheetId, ds.sheetName);
      const result = await processor(rows, {
        prisma: this.prisma,
        sourceSheet: ds.sheetName,
        chunkSize: parseInt(process.env.SYNC_CHUNK_SIZE ?? '1000', 10),
      });

      if (result.errors.length) {
        await this.prisma.syncRowError.createMany({
          data: result.errors.slice(0, 1000).map((e) => ({
            syncRunId: run.id,
            sourceRow: e.sourceRow,
            rawData: e.rawData as never,
            reason: e.reason,
          })),
        });
      }
      const status = result.rejected > 0 ? 'partial' : 'success';
      await this.prisma.syncRun.update({
        where: { id: run.id },
        data: {
          finishedAt: new Date(), status,
          rowsRead: result.read, rowsUpserted: result.upserted, rowsRejected: result.rejected,
        },
      });
      await this.prisma.dataSource.update({ where: { id: ds.id }, data: { lastSyncedAt: new Date() } });
      await this.publish({
        type: 'finished', sheetName: ds.sheetName, runId: run.id.toString(),
        rowsRead: result.read, rowsUpserted: result.upserted, rowsRejected: result.rejected,
        at: new Date().toISOString(),
      });
      this.logger.log(`Synced "${ds.sheetName}": ${result.upserted}/${result.read} upserted, ${result.rejected} rejected`);
    } catch (e) {
      const msg = (e as Error).message.slice(0, 1000);
      await this.prisma.syncRun.update({
        where: { id: run.id },
        data: { finishedAt: new Date(), status: 'failed', error: msg },
      });
      await this.publish({ type: 'failed', sheetName: ds.sheetName, runId: run.id.toString(), error: msg, at: new Date().toISOString() });
      throw e;
    }
  }

  /** Latest run per data source — for the Sync Monitor page */
  async status() {
    const sources = await this.prisma.dataSource.findMany({
      orderBy: { syncOrder: 'asc' },
      include: { syncRuns: { orderBy: { startedAt: 'desc' }, take: 1 } },
    });
    return sources.map((s) => ({
      id: s.id.toString(),
      sheetName: s.sheetName,
      targetTable: s.targetTable,
      enabled: s.enabled,
      lastSyncedAt: s.lastSyncedAt,
      lastRun: s.syncRuns[0]
        ? {
            id: s.syncRuns[0].id.toString(),
            status: s.syncRuns[0].status,
            startedAt: s.syncRuns[0].startedAt,
            finishedAt: s.syncRuns[0].finishedAt,
            rowsRead: s.syncRuns[0].rowsRead,
            rowsUpserted: s.syncRuns[0].rowsUpserted,
            rowsRejected: s.syncRuns[0].rowsRejected,
            error: s.syncRuns[0].error,
          }
        : null,
    }));
  }
}
