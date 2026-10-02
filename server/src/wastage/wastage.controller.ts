import { Controller, Get, Post, Body, Query, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { WastageService } from './wastage.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('wastage')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WastageController {
  constructor(private wastageService: WastageService) {}

  @Post()
  @Roles('ADMIN', 'STOCK', 'SELLER')
  async create(
    @Request() req,
    @Body() body: { itemId: number; quantity: number; date?: string; destinationId?: number; reason?: string },
  ) {
    const role = req.user.role;

    // SELLER: can only record wastage for a destination (shop/event), not warehouse
    if (role === 'SELLER' && !body.destinationId) {
      throw new ForbiddenException('Sellers can only record wastage for a shop or event location, not the main warehouse.');
    }

    // STOCK: can only record wastage for main warehouse, not destinations
    if (role === 'STOCK' && body.destinationId) {
      throw new ForbiddenException('Stock department can only record warehouse damage. Use a Seller account for shop/event wastage.');
    }

    return this.wastageService.create(req.user.id, body);
  }

  @Get()
  @Roles('ADMIN', 'STOCK', 'SELLER')
  async findAll(@Request() req, @Query('destinationId') destinationId?: string) {
    const role = req.user.role;
    // STOCK sees only warehouse wastage (destinationId = null)
    // SELLER sees only destination wastage
    // ADMIN sees all
    if (role === 'STOCK') {
      return this.wastageService.findAll(undefined, true); // warehouse only
    }
    const destId = destinationId ? parseInt(destinationId, 10) : undefined;
    return this.wastageService.findAll(destId);
  }
}
