import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { InventoryModule } from './inventory/inventory.module';
import { SalesModule } from './sales/sales.module';
import { ReportsModule } from './reports/reports.module';
import { DevModule } from './dev/dev.module';
import { DestinationsModule } from './destinations/destinations.module';
import { AllocationModule } from './allocation/allocation.module';
import { SalesReportsModule } from './sales-reports/sales-reports.module';
import { SpinReportsModule } from './spin-reports/spin-reports.module';
import { WastageModule } from './wastage/wastage.module';
import { ClosedDatesModule } from './closed-dates/closed-dates.module';
import { ItemPriceHistoryModule } from './item-price-history/item-price-history.module';

@Module({
  imports: [
    PrismaModule,
    UserModule,
    AuthModule,
    InventoryModule,
    SalesModule,
    ReportsModule,
    DevModule,
    DestinationsModule,
    AllocationModule,
    SalesReportsModule,
    SpinReportsModule,
    WastageModule,
    ClosedDatesModule,
    ItemPriceHistoryModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
