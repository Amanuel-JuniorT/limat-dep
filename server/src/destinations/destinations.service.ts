import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DestinationType } from '@prisma/client';

@Injectable()
export class DestinationsService {
  constructor(private prisma: PrismaService) {}

  async create(data: { name: string; type: DestinationType; notes?: string; spinPrice?: number }) {
    return this.prisma.stockDestination.create({
      data: {
        ...data,
        spinPrice: data.spinPrice !== undefined ? data.spinPrice : 30,
      },
    });
  }

  async findAll() {
    return this.prisma.stockDestination.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findActive() {
    return this.prisma.stockDestination.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async update(id: number, data: { name?: string; notes?: string; isActive?: boolean; type?: DestinationType; spinPrice?: number }) {
    const dest = await this.prisma.stockDestination.findUnique({ where: { id } });
    if (!dest) throw new NotFoundException('Destination not found');
    return this.prisma.stockDestination.update({
      where: { id },
      data,
    });
  }

  async remove(id: number) {
    const dest = await this.prisma.stockDestination.findUnique({ where: { id } });
    if (!dest) throw new NotFoundException('Destination not found');

    // Check if there is any active stock allocated at this destination
    const stockAgg = await this.prisma.inventoryMovements.aggregate({
      where: { destinationId: id },
      _sum: { quantityChange: true },
    });
    const activeStock = stockAgg._sum.quantityChange || 0;
    if (activeStock > 0) {
      throw new BadRequestException(
        `Cannot delete "${dest.name}" — it still has ${activeStock} unit(s) of allocated stock. Return stock to warehouse first.`,
      );
    }

    return this.prisma.stockDestination.delete({ where: { id } });
  }
}
