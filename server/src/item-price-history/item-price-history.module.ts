import { Module } from '@nestjs/common';
import { ItemPriceHistoryService } from './item-price-history.service';
import { ItemPriceHistoryController } from './item-price-history.controller';

@Module({
  controllers: [ItemPriceHistoryController],
  providers: [ItemPriceHistoryService],
  exports: [ItemPriceHistoryService], // exported so SalesReports/SpinReports can inject it
})
export class ItemPriceHistoryModule {}
