import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CaseStatus, ProblemGroup } from '@prisma/client';
import { IsEnum, IsISO8601, IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PageQuery } from '../common/pagination';
import { CasesService } from './cases.service';

class CasesQuery extends PageQuery {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsEnum(ProblemGroup) problemGroup?: ProblemGroup;
  @IsOptional() @IsEnum(CaseStatus) status?: CaseStatus;
  @IsOptional() @IsString() shopId?: string;
  @IsOptional() @IsISO8601() dateFrom?: string;
  @IsOptional() @IsISO8601() dateTo?: string;
}

@UseGuards(JwtAuthGuard)
@Controller('cases')
export class CasesController {
  constructor(private readonly cases: CasesService) {}

  @Get()
  list(@Query() q: CasesQuery) {
    return this.cases.list(q, q);
  }

  @Get('code/:code')
  byCode(@Param('code') code: string) {
    return this.cases.byCode(code);
  }

  @Get(':id')
  byId(@Param('id') id: string) {
    return this.cases.byId(BigInt(id));
  }
}
