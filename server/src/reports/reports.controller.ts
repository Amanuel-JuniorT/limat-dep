import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  @Roles('ADMIN', 'SELLER')
  getSummary(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('destinationId') destinationId?: string,
  ) {
    const startDate = from ? new Date(from) : new Date();
    const endDate = to ? new Date(to) : startDate;
    const destId = destinationId ? parseInt(destinationId, 10) : undefined;
    return this.reportsService.getSummary(startDate, endDate, destId);
  }

  @Get('inventory')
  @Roles('ADMIN', 'STOCK')
  getInventoryStatus() {
    return this.reportsService.getInventoryStatus();
  }
}
