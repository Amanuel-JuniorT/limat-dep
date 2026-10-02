import { Module } from '@nestjs/common';
import { ItemsService } from './items.service';
import { ItemsController } from './items.controller';
import { PricesService } from './prices.service';
import { PricesController } from './prices.controller';
import { StockService } from './stock.service';
import { PurchasesService } from './purchases.service';
import { PurchasesController } from './purchases.controller';
import { ItemPriceHistoryModule } from '../item-price-history/item-price-history.module';

@Module({
  imports: [ItemPriceHistoryModule],
  controllers: [ItemsController, PricesController, PurchasesController],
  providers: [ItemsService, PricesService, StockService, PurchasesService],
  exports: [ItemsService, PricesService, StockService, PurchasesService],
})
export class InventoryModule {}
