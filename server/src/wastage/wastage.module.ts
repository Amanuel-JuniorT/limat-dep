import { Module } from '@nestjs/common';
import { WastageService } from './wastage.service';
import { WastageController } from './wastage.controller';

@Module({
  providers: [WastageService],
  controllers: [WastageController],
  exports: [WastageService],
})
export class WastageModule {}
