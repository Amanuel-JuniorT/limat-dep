import { Controller, Get, Post, Patch, Delete, Body, Param, ParseIntPipe, Query, UseGuards, Request } from '@nestjs/common';
import { SalesReportsService } from './sales-reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PaymentMethod } from '@prisma/client';

@Controller('sales-reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SalesReportsController {
  constructor(private salesReportsService: SalesReportsService) {}

  @Post()
  @Roles('ADMIN', 'SELLER')
  async create(
    @Request() req,
    @Body()
    body: {
      destinationId: number;
      saleDate: string;
      items: { itemId: number; quantity: number; unitPrice: number }[];
      tipAmount?: number;
      paymentMethod?: PaymentMethod;
      paymentDetails?: any;
      notes?: string;
    },
  ) {
    return this.salesReportsService.create(req.user.id, body);
  }

  @Get()
  @Roles('ADMIN', 'SELLER')
  async findAll(
    @Request() req,
    @Query('destinationId') destinationId?: string,
  ) {
    const sellerIdFilter = req.user.role === 'SELLER' ? req.user.id : undefined;
    const destId = destinationId ? parseInt(destinationId, 10) : undefined;
    return this.salesReportsService.findAll(destId, sellerIdFilter);
  }

  @Get(':id')
  @Roles('ADMIN', 'SELLER')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.salesReportsService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'SELLER')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
    @Body()
    body: {
      destinationId?: number;
      saleDate?: string;
      items?: {
        itemId: number;
        quantity: number;
        unitPrice: number;
        paymentMethod?: PaymentMethod;
        tipAmount?: number;
        notes?: string;
      }[];
      tipAmount?: number;
      paymentMethod?: PaymentMethod;
      notes?: string;
    },
  ) {
    return this.salesReportsService.update(id, req.user, body);
  }

  @Delete(':id')
  @Roles('ADMIN', 'SELLER')
  async remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.salesReportsService.remove(id, req.user);
  }
}
