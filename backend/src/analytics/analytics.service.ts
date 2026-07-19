import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface DateRange {
  dateFrom?: string;
  dateTo?: string;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private caseDateWhere(r: DateRange): Prisma.ServiceCaseWhereInput {
    if (!r.dateFrom && !r.dateTo) return {};
    return {
      caseDate: {
        ...(r.dateFrom ? { gte: new Date(r.dateFrom) } : {}),
        ...(r.dateTo ? { lte: new Date(r.dateTo) } : {}),
      },
    };
  }

  /** Overview KPIs (Phase 3 Overview page) */
  async overview(r: DateRange) {
    const where = this.caseDateWhere(r);
    const [total, byGroup, pending, followups, satisfaction, nps] = await this.prisma.$transaction([
      this.prisma.serviceCase.count({ where }),
      this.prisma.serviceCase.groupBy({
        by: ['problemGroup'],
        where,
        _count: { _all: true },
        orderBy: { problemGroup: 'asc' },
      }),
      this.prisma.serviceCase.count({ where: { ...where, status: { in: ['open', 'received', 'in_repair'] } } }),
      this.prisma.caseFollowup.count({ where: { case: { is: where } } }),
      this.prisma.caseFollowup.aggregate({
        where: { case: { is: where } },
        _avg: { satisfaction10: true, satisfaction5: true, productScore10: true },
      }),
      this.prisma.caseFollowup.aggregate({ where: { case: { is: where } }, _avg: { npsScore: true } }),
    ]);
    return {
      totalCases: total,
      byProblemGroup: Object.fromEntries(
        byGroup.map((g) => [g.problemGroup, typeof g._count === 'object' ? g._count?._all ?? 0 : 0]),
      ),
      pendingCases: pending,
      followupCount: followups,
      avgSatisfaction10: satisfaction._avg.satisfaction10,
      avgSatisfaction5: satisfaction._avg.satisfaction5,
      avgProductScore10: satisfaction._avg.productScore10,
      avgNps: nps._avg.npsScore,
    };
  }

  /** Monthly case counts by problem group (trend chart) */
  async trends(r: DateRange) {
    const rows = await this.prisma.$queryRaw<
      { month: Date; problem_group: string; count: bigint }[]
    >`
      SELECT date_trunc('month', case_date) AS month, problem_group::text, count(*)::bigint AS count
      FROM service_cases
      WHERE case_date IS NOT NULL
        AND (${r.dateFrom ?? null}::date IS NULL OR case_date >= ${r.dateFrom ?? null}::date)
        AND (${r.dateTo ?? null}::date IS NULL OR case_date <= ${r.dateTo ?? null}::date)
      GROUP BY 1, 2
      ORDER BY 1
    `;
    return rows.map((x) => ({ month: x.month, problemGroup: x.problem_group, count: Number(x.count) }));
  }

  /** Top claimed products */
  async topProducts(r: DateRange, limit = 10) {
    const rows = await this.prisma.serviceCase.groupBy({
      by: ['productId'],
      where: { ...this.caseDateWhere(r), productId: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { productId: 'desc' } },
      take: limit,
    });
    const products = await this.prisma.product.findMany({
      where: { id: { in: rows.map((x) => x.productId).filter((x): x is bigint => x !== null) } },
    });
    const byId = new Map(products.map((p) => [p.id.toString(), p]));
    return rows.map((x) => ({
      product: x.productId ? byId.get(x.productId.toString()) : null,
      cases: x._count?._all ?? 0,
    }));
  }

  /** Cases per shop */
  async byShop(r: DateRange) {
    const rows = await this.prisma.serviceCase.groupBy({
      by: ['shopId'],
      where: this.caseDateWhere(r),
      _count: { _all: true },
      orderBy: { shopId: 'asc' },
    });
    const shops = await this.prisma.shop.findMany();
    const byId = new Map(shops.map((s) => [s.id.toString(), s]));
    return rows
      .map((x) => ({
        shop: x.shopId ? byId.get(x.shopId.toString()) : null,
        cases: x._count?._all ?? 0,
      }))
      .sort((a, b) => b.cases - a.cases);
  }

  /** Chat volume per month/shop */
  async chatVolume() {
    const rows = await this.prisma.$queryRaw<
      { month: Date; shop_id: bigint | null; presale: bigint; postsale: bigint }[]
    >`
      SELECT date_trunc('month', metric_date) AS month, shop_id,
             sum(presale_total)::bigint AS presale, sum(postsale_total)::bigint AS postsale
      FROM chat_daily_metrics
      GROUP BY 1, 2
      ORDER BY 1
    `;
    return rows.map((x) => ({
      month: x.month,
      shopId: x.shop_id?.toString() ?? null,
      presale: Number(x.presale),
      postsale: Number(x.postsale),
    }));
  }

  /** Repeat-claim customers (KPI sheet replacement) */
  async repeatClaims(minCases = 2) {
    const rows = await this.prisma.$queryRaw<
      { customer_id: bigint; claims: bigint }[]
    >`
      SELECT customer_id, count(*)::bigint AS claims
      FROM service_cases
      WHERE problem_group = 'claim' AND customer_id IS NOT NULL
      GROUP BY customer_id
      HAVING count(*) >= ${minCases}
      ORDER BY claims DESC
      LIMIT 50
    `;
    const customers = await this.prisma.customer.findMany({
      where: { id: { in: rows.map((x) => x.customer_id) } },
    });
    const byId = new Map(customers.map((c) => [c.id.toString(), c]));
    return rows.map((x) => ({
      customer: byId.get(x.customer_id.toString()),
      claims: Number(x.claims),
    }));
  }
}
