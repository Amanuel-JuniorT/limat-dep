import { Module } from '@nestjs/common';
import { AllocationService } from './allocation.service';
import { AllocationController } from './allocation.controller';

@Module({
  providers: [AllocationService],
  controllers: [AllocationController],
  exports: [AllocationService],
})
export class AllocationModule {}
