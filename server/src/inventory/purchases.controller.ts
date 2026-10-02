import { Controller, Post, Get, Patch, Param, ParseIntPipe, Body, UseGuards, Req } from '@nestjs/common';
import { PurchasesService } from './purchases.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Post()
  @Roles('ADMIN', 'STOCK')
  create(
    @Req() req,
    @Body()
    data: {
      supplierName?: string;
      invoiceNumber?: string;
      items: {
        itemId: number;
        quantity: number;
        unitCost: number;
        newSellingPrice?: number;
        effectiveFrom?: string;
        priceNote?: string;
      }[];
    },
  ) {
    return this.purchasesService.create(req.user.id, data);
  }

  @Get()
  @Roles('ADMIN', 'STOCK')
  findAll() {
    return this.purchasesService.findAll();
  }

  @Get(':id')
  @Roles('ADMIN', 'STOCK')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.purchasesService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'STOCK')
  updateIntake(
    @Req() req,
    @Param('id', ParseIntPipe) id: number,
    @Body()
    data: {
      supplierName?: string;
      invoiceNumber?: string;
      items: {
        purchaseItemId: number;
        quantity: number;
        unitCost: number;
      }[];
    },
  ) {
    return this.purchasesService.updateIntake(id, req.user.id, data);
  }
}
