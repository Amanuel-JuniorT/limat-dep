import { Controller, Get, Post, Patch, Delete, Body, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { DestinationsService } from './destinations.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { DestinationType } from '@prisma/client';

@Controller('destinations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DestinationsController {
  constructor(private destinationsService: DestinationsService) {}

  @Post()
  @Roles('ADMIN', 'STOCK')
  async create(@Body() body: { name: string; type: DestinationType; notes?: string; spinPrice?: number }) {
    return this.destinationsService.create(body);
  }

  @Get()
  @Roles('ADMIN', 'STOCK', 'SELLER')
  async findAll() {
    return this.destinationsService.findAll();
  }

  @Get('active')
  async findActive() {
    return this.destinationsService.findActive();
  }

  @Patch(':id')
  @Roles('ADMIN', 'STOCK')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { name?: string; notes?: string; isActive?: boolean; type?: DestinationType; spinPrice?: number },
  ) {
    return this.destinationsService.update(id, body);
  }

  @Delete(':id')
  @Roles('ADMIN', 'STOCK')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.destinationsService.remove(id);
  }
}
