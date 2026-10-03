import { Controller, Post, Body, UseGuards, Req, Get } from '@nestjs/common';
import { SalesService } from './sales.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PaymentMethod } from '@prisma/client';

@UseGuards(JwtAuthGuard)
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  createSale(
    @Req() req,
    @Body() data: { items: { itemId: number; quantity: number }[]; tipAmount?: number; paymentMethod?: PaymentMethod; splitPayments?: any }
  ) {
    return this.salesService.createSale(req.user.id, data.items, data.tipAmount, data.paymentMethod, data.splitPayments);
  }

  @Post('spin')
  createSpin(
    @Req() req,
    @Body() data: { spinResult: string; rewardItemId?: number; tipAmount?: number; paymentMethod?: PaymentMethod; destinationId?: number }
  ) {
    return this.salesService.createSpin(req.user.id, data.spinResult, data.rewardItemId, data.tipAmount, data.paymentMethod, data.destinationId);
  }

  @Get()
  findAll(@Req() req) {
    const userId = req.user.role === 'ADMIN' ? undefined : req.user.id;
    return this.salesService.findAll(userId);
  }
}
