import { Module } from '@nestjs/common';
import { SpinReportsService } from './spin-reports.service';
import { SpinReportsController } from './spin-reports.controller';
import { ItemPriceHistoryModule } from '../item-price-history/item-price-history.module';

@Module({
  imports: [ItemPriceHistoryModule],
  providers: [SpinReportsService],
  controllers: [SpinReportsController],
  exports: [SpinReportsService],
})
export class SpinReportsModule {}
