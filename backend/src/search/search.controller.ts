import { Controller, Get, NotFoundException, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Global search + customer profile (Phase 3 spec):
 * partial, case-insensitive, ignores spaces and hyphens.
 * Searches: customer name, phone, order no, tracking no, serial, SKU, case code.
 */
@UseGuards(JwtAuthGuard)
@Controller()
export class SearchController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('search')
  async search(@Query('q') qRaw = '') {
    const q = qRaw.trim();
    if (q.length < 2) return { customers: [], cases: [], products: [] };
    const compact = q.replace(/[\s\-]/g, '');

    const [customers, cases, byCompact, products] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where: {
          OR: [
            { fullName: { contains: q, mode: 'insensitive' } },
            { chatName: { contains: q, mode: 'insensitive' } },
            { phone: { contains: compact } },
          ],
        },
        take: 10,
      }),
      this.prisma.serviceCase.findMany({
        where: {
          OR: [
            { caseCode: { contains: compact, mode: 'insensitive' } },
            { orderNo: { contains: compact, mode: 'insensitive' } },
            { returnTrackingNo: { contains: compact, mode: 'insensitive' } },
            { serialNo: { contains: compact, mode: 'insensitive' } },
          ],
        },
        include: { customer: true, product: true, shop: true },
        orderBy: { caseDate: 'desc' },
        take: 10,
      }),
      // phone stored as +66… — try matching normalized form too
      this.prisma.customer.findMany({
        where: compact.match(/^0\d{8,9}$/)
          ? { phone: { contains: compact.slice(1) } }
          : { id: { in: [] } },
        take: 10,
      }),
      this.prisma.product.findMany({
        where: { sku: { contains: compact, mode: 'insensitive' } },
        take: 10,
      }),
    ]);
    const seen = new Set(customers.map((c) => c.id.toString()));
    const allCustomers = [...customers, ...byCompact.filter((c) => !seen.has(c.id.toString()))];
    return { customers: allCustomers, cases, products };
  }

  /** Customer profile: info + timeline (cases → followups → sms) */
  @Get('customers/:id')
  async customer(@Param('id') id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: BigInt(id) },
      include: {
        serviceCases: {
          include: { product: true, shop: true, followups: true, smsLogs: true },
          orderBy: { caseDate: 'desc' },
        },
      },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  @Get('audit-logs')
  auditLogs(@Query('limit') limit = '100') {
    return this.prisma.auditLog.findMany({
      orderBy: { at: 'desc' },
      take: Math.min(parseInt(limit, 10) || 100, 500),
    });
  }
}
