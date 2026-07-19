import { PrismaClient } from '@prisma/client';

export interface RowError {
  sourceRow: number;
  rawData: unknown;
  reason: string;
}

export interface ProcessResult {
  read: number;
  upserted: number;
  rejected: number;
  errors: RowError[];
}

export interface ProcessorContext {
  prisma: PrismaClient;
  sourceSheet: string;
  chunkSize: number;
}

export type SheetProcessor = (rows: unknown[][], ctx: ProcessorContext) => Promise<ProcessResult>;
