import { Injectable, NotFoundException } from '@nestjs/common';
import { CaseStatus, Prisma, ProblemGroup } from '@prisma/client';
import { PageQuery, paged, skipTake } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';

export interface CaseFilters {
  q?: string;
  problemGroup?: ProblemGroup;
  status?: CaseStatus;
  shopId?: string;
  dateFrom?: string;
  dateTo?: string;
}

@Injectable()
export class CasesService {
  constructor(private readonly prisma: PrismaService) {}

  private where(f: CaseFilters): Prisma.ServiceCaseWhereInput {
    return {
      ...(f.problemGroup ? { problemGroup: f.problemGroup } : {}),
      ...(f.status ? { status: f.status } : {}),
      ...(f.shopId ? { shopId: BigInt(f.shopId) } : {}),
      ...(f.dateFrom || f.dateTo
        ? {
            caseDate: {
              ...(f.dateFrom ? { gte: new Date(f.dateFrom) } : {}),
              ...(f.dateTo ? { lte: new Date(f.dateTo) } : {}),
            },
          }
        : {}),
      ...(f.q
        ? {
            OR: [
              { caseCode: { contains: f.q, mode: 'insensitive' } },
              { orderNo: { contains: f.q, mode: 'insensitive' } },
              { returnTrackingNo: { contains: f.q, mode: 'insensitive' } },
              { serialNo: { contains: f.q, mode: 'insensitive' } },
              { problem: { contains: f.q, mode: 'insensitive' } },
              { customer: { is: { OR: [
                { fullName: { contains: f.q, mode: 'insensitive' } },
                { phone: { contains: f.q } },
              ] } } },
            ],
          }
        : {}),
    };
  }

  async list(f: CaseFilters, page: PageQuery) {
    const where = this.where(f);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.serviceCase.findMany({
        where,
        include: { shop: true, customer: true, product: true },
        orderBy: [{ caseDate: 'desc' }, { id: 'desc' }],
        ...skipTake(page),
      }),
      this.prisma.serviceCase.count({ where }),
    ]);
    return paged(items, total, page);
  }

  async byId(id: bigint) {
    const item = await this.prisma.serviceCase.findUnique({
      where: { id },
      include: { shop: true, customer: true, product: true, followups: true, smsLogs: true },
    });
    if (!item) throw new NotFoundException('Case not found');
    return item;
  }

  async byCode(code: string) {
    const item = await this.prisma.serviceCase.findUnique({
      where: { caseCode: code.toUpperCase() },
      include: { shop: true, customer: true, product: true, followups: true },
    });
    if (!item) throw new NotFoundException('Case not found');
    return item;
  }
}
