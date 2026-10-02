import { Module } from '@nestjs/common';
import { ClosedDatesService } from './closed-dates.service';
import { ClosedDatesController } from './closed-dates.controller';

@Module({
  providers: [ClosedDatesService],
  controllers: [ClosedDatesController],
  exports: [ClosedDatesService],
})
export class ClosedDatesModule {}
