import { Controller, Get, Post, Patch, Delete, Body, Param, ParseIntPipe, Query, UseGuards, Request } from '@nestjs/common';
import { SpinReportsService, SpinReportItemInput } from './spin-reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('spin-reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SpinReportsController {
  constructor(private spinReportsService: SpinReportsService) {}

  @Post()
  @Roles('ADMIN', 'SELLER')
  async create(
    @Request() req,
    @Body()
    body: {
      destinationId: number;
      reportDate: string;
      items: SpinReportItemInput[];
      notes?: string;
    },
  ) {
    return this.spinReportsService.create(req.user.id, body);
  }

  @Get()
  @Roles('ADMIN', 'SELLER')
  async findAll(
    @Request() req,
    @Query('destinationId') destinationId?: string,
  ) {
    const sellerIdFilter = req.user.role === 'SELLER' ? req.user.id : undefined;
    const destId = destinationId ? parseInt(destinationId, 10) : undefined;
    return this.spinReportsService.findAll(destId, sellerIdFilter);
  }

  @Get(':id')
  @Roles('ADMIN', 'SELLER')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.spinReportsService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'SELLER')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
    @Body()
    body: {
      destinationId?: number;
      reportDate?: string;
      items?: SpinReportItemInput[];
      notes?: string;
    },
  ) {
    return this.spinReportsService.update(id, req.user, body);
  }

  @Delete(':id')
  @Roles('ADMIN', 'SELLER')
  async remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.spinReportsService.remove(id, req.user);
  }
}
