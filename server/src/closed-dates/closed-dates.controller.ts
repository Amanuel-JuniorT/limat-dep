import { Controller, Get, Post, Delete, Body, Param, ParseIntPipe, Query, UseGuards, Request } from '@nestjs/common';
import { ClosedDatesService } from './closed-dates.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('closed-dates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClosedDatesController {
  constructor(private closedDatesService: ClosedDatesService) {}

  @Post()
  @Roles('ADMIN', 'SELLER')
  async create(
    @Request() req,
    @Body() body: { date: string; destinationId: number; reason?: string },
  ) {
    return this.closedDatesService.create(req.user.id, body);
  }

  @Get()
  @Roles('ADMIN', 'SELLER', 'STOCK')
  async findAll(@Query('destinationId') destinationId?: string) {
    const destId = destinationId ? parseInt(destinationId, 10) : undefined;
    return this.closedDatesService.findAll(destId);
  }

  @Delete(':id')
  @Roles('ADMIN', 'SELLER')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.closedDatesService.remove(id);
  }
}
