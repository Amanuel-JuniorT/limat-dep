import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  ParseIntPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ItemPriceHistoryService } from './item-price-history.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('item-price-history')
export class ItemPriceHistoryController {
  constructor(private readonly service: ItemPriceHistoryService) {}

  /** GET /item-price-history — all price changes across all items */
  @Get()
  @Roles('ADMIN', 'STOCK')
  findAll() {
    return this.service.findAll();
  }

  /** GET /item-price-history/count-sales-after?itemId=1&effectiveFrom=2026-10-01 — count affected sales */
  @Get('count-sales-after')
  @Roles('ADMIN', 'STOCK')
  countSalesAfterDate(
    @Query('itemId', ParseIntPipe) itemId: number,
    @Query('effectiveFrom') effectiveFrom: string,
  ) {
    return this.service.countSalesAfterDate(itemId, effectiveFrom);
  }

  /** GET /item-price-history/:itemId — price history for a specific item */
  @Get(':itemId')
  @Roles('ADMIN', 'STOCK')
  findByItem(@Param('itemId', ParseIntPipe) itemId: number) {
    return this.service.findByItem(itemId);
  }

  /** POST /item-price-history — manually record a forward-facing price change */
  @Post()
  @Roles('ADMIN', 'STOCK')
  createManual(
    @Req() req,
    @Body()
    data: {
      itemId: number;
      costPrice: number;
      sellingPrice: number;
      effectiveFrom: string;
      notes?: string;
    },
  ) {
    return this.service.createManual(req.user.id, data);
  }

  /** POST /item-price-history/correct — perform retroactive price correction */
  @Post('correct')
  @Roles('ADMIN', 'STOCK')
  correctPrice(
    @Req() req,
    @Body()
    data: {
      itemId: number;
      fieldCorrected: 'SELLING' | 'COST' | 'QTY';
      newPrice: number;
      saleReportItemId?: number;
    },
  ) {
    return this.service.correctPrice(req.user.id, data);
  }

  /** GET /item-price-history/correction-logs/:itemId — audit trail for price corrections */
  @Get('correction-logs/:itemId')
  @Roles('ADMIN', 'STOCK')
  getCorrectionLogs(@Param('itemId', ParseIntPipe) itemId: number) {
    return this.service.getCorrectionLogs(itemId);
  }
}
