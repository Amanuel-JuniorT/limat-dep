import { Controller, Get, Post, Param } from '@nestjs/common';
import { DevService } from './dev.service';

@Controller('dev')
export class DevController {
  constructor(private readonly devService: DevService) {}

  @Post('seed')
  seedData() {
    return this.devService.seedDemoData();
  }

  @Get('reset-all-stock/:password')
  resetAllStock(@Param('password') password: string) {
    if (password !== 'limat123') {
      return 'Invalid password';
    }
    return this.devService.resetAllInventoryStock();
  }
}