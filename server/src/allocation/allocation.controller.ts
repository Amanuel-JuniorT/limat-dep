import { Controller, Get, Post, Body, Param, ParseIntPipe, UseGuards, Request } from '@nestjs/common';
import { AllocationService } from './allocation.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('allocations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AllocationController {
  constructor(private allocationService: AllocationService) {}

  @Post()
  @Roles('ADMIN', 'STOCK')
  async createAllocation(
    @Request() req,
    @Body() body: { destinationId: number; items: { itemId: number; quantity: number }[]; notes?: string },
  ) {
    return this.allocationService.createAllocation(req.user.id, body);
  }

  @Post('return')
  @Roles('ADMIN', 'STOCK')
  async returnAllocation(
    @Request() req,
    @Body() body: { destinationId: number; items: { itemId: number; quantity: number }[]; notes?: string },
  ) {
    return this.allocationService.returnAllocation(req.user.id, body);
  }

  @Get('balances')
  @Roles('ADMIN', 'STOCK', 'SELLER')
  async getBalances() {
    return this.allocationService.getDestinationBalances();
  }

  @Get()
  @Roles('ADMIN', 'STOCK')
  async findAll() {
    return this.allocationService.findAll();
  }

  @Get('destination/:id')
  @Roles('ADMIN', 'STOCK')
  async findByDestination(@Param('id', ParseIntPipe) id: number) {
    return this.allocationService.findByDestination(id);
  }
}
