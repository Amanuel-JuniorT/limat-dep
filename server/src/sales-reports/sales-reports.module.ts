import { Module } from '@nestjs/common';
import { SalesReportsService } from './sales-reports.service';
import { SalesReportsController } from './sales-reports.controller';
import { ItemPriceHistoryModule } from '../item-price-history/item-price-history.module';

@Module({
  imports: [ItemPriceHistoryModule],
  providers: [SalesReportsService],
  controllers: [SalesReportsController],
  exports: [SalesReportsService],
})
export class SalesReportsModule {}
