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

  // ---------- PHASE 2: KPI with previous-period compare + sparkline ----------

  private static rangeDays(r: DateRange): number | null {
    if (!r.dateFrom || !r.dateTo) return null;
    return Math.round((new Date(r.dateTo).getTime() - new Date(r.dateFrom).getTime()) / 86400000) + 1;
  }

  private static prevOf(r: DateRange): DateRange {
    const days = AnalyticsService.rangeDays(r);
    if (!days) return {};
    const from = new Date(r.dateFrom!);
    const prevTo = new Date(from.getTime() - 86400000);
    const prevFrom = new Date(prevTo.getTime() - (days - 1) * 86400000);
    return { dateFrom: prevFrom.toISOString().slice(0, 10), dateTo: prevTo.toISOString().slice(0, 10) };
  }

  /** นับค่าเดียวต่อ metric ในช่วงวันที่ (NULL range = ทั้งหมด) */
  private async metricValue(metric: string, r: DateRange): Promise<number> {
    const f = r.dateFrom ?? null;
    const t = r.dateTo ?? null;
    let rows: { v: unknown }[];
    switch (metric) {
      case 'contacts':
        rows = await this.prisma.$queryRaw`
          SELECT COALESCE(SUM(presale_total + postsale_total),0) AS v FROM chat_daily_metrics
          WHERE (${f}::date IS NULL OR metric_date >= ${f}::date) AND (${t}::date IS NULL OR metric_date <= ${t}::date)`;
        break;
      case 'shipments':
        rows = await this.prisma.$queryRaw`
          SELECT COUNT(*) AS v FROM service_cases WHERE returned_to_customer = true
          AND (${f}::date IS NULL OR returned_date >= ${f}::date) AND (${t}::date IS NULL OR returned_date <= ${t}::date)`;
        break;
      case 'after_sales':
        rows = await this.prisma.$queryRaw`
          SELECT COUNT(*) AS v FROM service_cases
          WHERE (${f}::date IS NULL OR case_date >= ${f}::date) AND (${t}::date IS NULL OR case_date <= ${t}::date)`;
        break;
      case 'pending':
        rows = await this.prisma.$queryRaw`
          SELECT COUNT(*) AS v FROM service_cases WHERE status IN ('open','received','in_repair')
          AND (${f}::date IS NULL OR case_date >= ${f}::date) AND (${t}::date IS NULL OR case_date <= ${t}::date)`;
        break;
      case 'feedback':
        rows = await this.prisma.$queryRaw`
          SELECT COUNT(*) AS v FROM case_followups
          WHERE (${f}::date IS NULL OR followup_date >= ${f}::date) AND (${t}::date IS NULL OR followup_date <= ${t}::date)`;
        break;
      default:
        return 0;
    }
    return Number(rows[0]?.v ?? 0);
  }

  /** sparkline รายวัน (สูงสุด 30 จุดท้ายของช่วง; ไม่มีช่วง = 30 วันล่าสุด) */
  private async sparkline(metric: string, r: DateRange): Promise<number[]> {
    const end = r.dateTo ?? new Date().toISOString().slice(0, 10);
    const endD = new Date(end);
    const startD = new Date(endD.getTime() - 29 * 86400000);
    const start = r.dateFrom && new Date(r.dateFrom) > startD ? r.dateFrom : startD.toISOString().slice(0, 10);
    const dateCol =
      metric === 'contacts' ? 'metric_date' : metric === 'shipments' ? 'returned_date' : metric === 'feedback' ? 'followup_date' : 'case_date';
    const table = metric === 'contacts' ? 'chat_daily_metrics' : metric === 'feedback' ? 'case_followups' : 'service_cases';
    const valueExpr = metric === 'contacts' ? 'SUM(presale_total + postsale_total)' : 'COUNT(*)';
    const extra = metric === 'shipments' ? 'AND returned_to_customer = true' : metric === 'pending' ? "AND status IN ('open','received','in_repair')" : '';
    const rows = await this.prisma.$queryRawUnsafe<{ d: Date; v: unknown }[]>(
      `SELECT ${dateCol} AS d, ${valueExpr} AS v FROM ${table}
       WHERE ${dateCol} >= $1::date AND ${dateCol} <= $2::date ${extra}
       GROUP BY ${dateCol} ORDER BY ${dateCol}`,
      start, end,
    );
    // เติมวันว่างเป็น 0 เพื่อให้ sparkline ต่อเนื่อง
    const byDay = new Map(rows.map((x) => [new Date(x.d).toISOString().slice(0, 10), Number(x.v)]));
    const out: number[] = [];
    for (let d = new Date(start); d <= endD; d = new Date(d.getTime() + 86400000)) {
      out.push(byDay.get(d.toISOString().slice(0, 10)) ?? 0);
    }
    return out;
  }

  /**
   * KPI cards — current / previous / %change / sparkline ต่อ metric
   * metric ที่ไม่มีแหล่งข้อมูล (closed sales, sales value) ส่ง available:false — ห้ามใส่เลขปลอม
   */
  async kpis(r: DateRange) {
    const prev = AnalyticsService.prevOf(r);
    const hasPrev = !!prev.dateFrom;
    const metrics = ['contacts', 'shipments', 'after_sales', 'pending', 'feedback'] as const;
    const result: Record<string, unknown> = {};
    for (const m of metrics) {
      const [current, previous, spark] = await Promise.all([
        this.metricValue(m, r),
        hasPrev ? this.metricValue(m, prev) : Promise.resolve(null),
        this.sparkline(m, r),
      ]);
      const changePct =
        previous !== null && previous > 0 ? Math.round(((current - previous) / previous) * 1000) / 10 : null;
      result[m] = { available: true, current, previous, changePct, spark };
    }
    // ยังไม่มีแหล่งข้อมูล — ดู PROJECT_ANALYSIS.md (P1)
    for (const m of ['closed_sales', 'sales_value', 'conversion_rate']) {
      result[m] = { available: false, reason: 'ยังไม่มีชีตข้อมูลยอดขาย/แอดมิน' };
    }
    return { range: r, prevRange: hasPrev ? prev : null, metrics: result };
  }

  /** Business Performance Trend — bucket day/week/month/year + เทียบช่วงก่อนหน้า */
  async businessTrend(metric: string, bucket: string, r: DateRange, compare: boolean) {
    const safeBucket = ['day', 'week', 'month', 'year'].includes(bucket) ? bucket : 'day';
    const series = await this.trendSeries(metric, safeBucket, r);
    let prevSeries: { t: string; value: number }[] | null = null;
    if (compare) {
      const prev = AnalyticsService.prevOf(r);
      if (prev.dateFrom) prevSeries = await this.trendSeries(metric, safeBucket, prev);
    }
    return { metric, bucket: safeBucket, series, prevSeries };
  }

  private async trendSeries(metric: string, bucket: string, r: DateRange) {
    const f = r.dateFrom ?? null;
    const t = r.dateTo ?? null;
    const dateCol =
      metric === 'contacts' ? 'metric_date' : metric === 'shipments' ? 'returned_date' : 'case_date';
    const table = metric === 'contacts' ? 'chat_daily_metrics' : 'service_cases';
    const valueExpr = metric === 'contacts' ? 'SUM(presale_total + postsale_total)' : 'COUNT(*)';
    const extra = metric === 'shipments' ? 'AND returned_to_customer = true' : '';
    const rows = await this.prisma.$queryRawUnsafe<{ b: Date; v: unknown }[]>(
      `SELECT date_trunc('${bucket}', ${dateCol}) AS b, ${valueExpr} AS v FROM ${table}
       WHERE ${dateCol} IS NOT NULL
         AND ($1::date IS NULL OR ${dateCol} >= $1::date)
         AND ($2::date IS NULL OR ${dateCol} <= $2::date)
       GROUP BY 1 ORDER BY 1`,
      f, t,
    );
    return rows.map((x) => ({ t: new Date(x.b).toISOString().slice(0, 10), value: Number(x.v) }));
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
