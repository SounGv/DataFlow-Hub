import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Brand } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PageQuery, paged, skipTake } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';

class UsageIssueQuery extends PageQuery {
  @IsOptional() @IsString() q?: string;
}

class FaqQuery {
  @IsOptional() @IsEnum(Brand) brand?: Brand;
  @IsOptional() @IsString() q?: string;
}

/** Supporting endpoints: usage issues, chat metrics, knowledge base, lookups */
@UseGuards(JwtAuthGuard)
@Controller()
export class OperationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('usage-issues')
  async usageIssues(@Query() q: UsageIssueQuery) {
    const where = q.q
      ? {
          OR: [
            { customerName: { contains: q.q, mode: 'insensitive' as const } },
            { problem: { contains: q.q, mode: 'insensitive' as const } },
            { orderNo: { contains: q.q, mode: 'insensitive' as const } },
          ],
        }
      : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.usageIssue.findMany({
        where, include: { shop: true, product: true },
        orderBy: { reportedAt: 'desc' }, ...skipTake(q),
      }),
      this.prisma.usageIssue.count({ where }),
    ]);
    return paged(items, total, q);
  }

  @Get('chat-metrics')
  chatMetrics() {
    return this.prisma.chatDailyMetric.findMany({
      include: { shop: true },
      orderBy: { metricDate: 'desc' },
      take: 500,
    });
  }

  @Get('faq')
  async faq(@Query() q: FaqQuery) {
    return this.prisma.faqEntry.findMany({
      where: {
        ...(q.brand ? { brand: q.brand } : {}),
        ...(q.q
          ? {
              OR: [
                { question: { contains: q.q, mode: 'insensitive' } },
                { answer: { contains: q.q, mode: 'insensitive' } },
                { sku: { contains: q.q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ brand: 'asc' }, { sku: 'asc' }],
    });
  }

  @Get('shops')
  shops() {
    return this.prisma.shop.findMany({ orderBy: { code: 'asc' } });
  }

  @Get('products')
  products(@Query('q') q?: string) {
    return this.prisma.product.findMany({
      where: q ? { sku: { contains: q, mode: 'insensitive' } } : {},
      orderBy: { sku: 'asc' },
      take: 100,
    });
  }

  @Get('spare-parts')
  spareParts() {
    return this.prisma.sparePartRequest.findMany({ orderBy: { requestDate: 'desc' } });
  }

  @Get('chair-claims')
  chairClaims() {
    return this.prisma.chairClaim.findMany({ orderBy: { submittedAt: 'desc' } });
  }
}
