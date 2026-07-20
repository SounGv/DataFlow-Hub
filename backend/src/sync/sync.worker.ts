/**
 * Sync worker — BullMQ processor + repeating full-sync schedule.
 *
 * Two ways to run:
 *  - Standalone process: `npm run worker` (dev / เครื่องตัวเอง)
 *  - In-process with the API: set START_WORKER=true (Render free tier ไม่มี worker แยก)
 */
import 'reflect-metadata';
import { PrismaClient } from '@prisma/client';
import { Queue, Worker } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { SyncService, SYNC_QUEUE } from './sync.service';

export async function startSyncWorker(service: SyncService): Promise<Worker> {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';

  const worker = new Worker(
    SYNC_QUEUE,
    async (job) => {
      if (job.name === 'enqueue-all') {
        await service.enqueueAll();
        return;
      }
      await service.runDataSource(BigInt(job.data.dataSourceId));
    },
    { connection: { url } as never, concurrency: 2 },
  );

  worker.on('failed', (job, err) => console.error(`[sync] job ${job?.id} failed:`, err.message));
  worker.on('completed', (job) => console.log(`[sync] job ${job.id} done`));

  // repeatable full sync
  const minutes = parseInt(process.env.SYNC_CRON_MINUTES ?? '15', 10);
  const queue = new Queue(SYNC_QUEUE, { connection: { url } as never });
  await queue.add('enqueue-all', {}, { repeat: { pattern: `*/${minutes} * * * *` }, jobId: 'cron-enqueue-all' });
  // free tier หลับเมื่อไม่มีคนใช้ → sync ทันทีทุกครั้งที่ตื่น (boot)
  await queue.add('enqueue-all', {}, { jobId: `boot-${Date.now()}`, removeOnComplete: true, removeOnFail: true });
  console.log(`[sync] worker started — sync on boot + every ${minutes} min`);
  return worker;
}

// Standalone entrypoint
if (require.main === module) {
  (async () => {
    const prisma = new PrismaService();
    await (prisma as PrismaClient).$connect();
    await startSyncWorker(new SyncService(prisma));
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
