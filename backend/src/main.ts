import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SyncService } from './sync/sync.service';
import { startSyncWorker } from './sync/sync.worker';

// BigInt → JSON (Prisma BIGSERIAL ids)
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const corsOrigin = process.env.CORS_ORIGIN;
  app.enableCors({
    origin: !corsOrigin || corsOrigin === '*' ? true : corsOrigin.split(','),
    credentials: true,
  });
  app.enableShutdownHooks();
  const port = parseInt(process.env.PORT ?? '3000', 10);
  await app.listen(port);
  console.log(`DATAFLOW HUB API ready → http://localhost:${port}/api`);

  // Render free tier: รัน sync worker ใน process เดียวกับ API
  if (process.env.START_WORKER === 'true') {
    await startSyncWorker(app.get(SyncService));
  }
}
bootstrap();
