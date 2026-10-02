import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Req } from '@nestjs/common';
import { ItemsService } from './items.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Post()
  @Roles('ADMIN', 'STOCK')
  create(
    @Req() req,
    @Body()
    body: {
      name: string;
      description?: string;
      sku?: string;
      sellingPrice?: number;
      costPrice?: number;
      initialQuantity?: number;
    },
  ) {
    return this.itemsService.create(req.user.id, body);
  }

  @Get()
  @Roles('ADMIN', 'STOCK', 'SELLER')
  findAll(@Query('destinationId') destinationId?: string) {
    const destId = destinationId ? parseInt(destinationId, 10) : undefined;
    return this.itemsService.findAll(destId);
  }

  @Get(':id')
  @Roles('ADMIN', 'STOCK', 'SELLER')
  findOne(@Param('id') id: string) {
    return this.itemsService.findOne(+id);
  }

  @Patch(':id/prices')
  @Roles('ADMIN', 'STOCK')
  updatePrices(
    @Param('id') id: string,
    @Body() body: { sellingPrice?: number; costPrice?: number },
  ) {
    return this.itemsService.updatePrices(+id, body);
  }

  @Delete(':id')
  @Roles('ADMIN', 'STOCK')
  remove(@Param('id') id: string) {
    return this.itemsService.remove(+id);
  }
}
