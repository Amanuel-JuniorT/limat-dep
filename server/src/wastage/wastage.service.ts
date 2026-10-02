import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MovementType } from '@prisma/client';

@Injectable()
export class WastageService {
  constructor(private prisma: PrismaService) {}

  async create(
    userId: number,
    data: {
      itemId: number;
      quantity: number;
      date?: string;
      destinationId?: number;
      reason?: string;
    },
  ) {
    const { itemId, quantity, date, destinationId, reason } = data;

    const item = await this.prisma.items.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Item not found');

    const dateObj = date ? new Date(date) : new Date();

    return this.prisma.$transaction(async (tx) => {
      const wastage = await tx.wastage.create({
        data: {
          itemId,
          quantity,
          date: dateObj,
          destinationId: destinationId || null,
          userId,
          reason,
        },
        include: {
          item: true,
          destination: true,
          user: { select: { id: true, email: true, name: true, role: true } },
        },
      });

      await tx.inventoryMovements.create({
        data: {
          itemId,
          type: MovementType.WASTAGE,
          quantityChange: -quantity,
          destinationId: destinationId || null,
          referenceId: wastage.id,
          referenceType: 'WASTAGE',
        },
      });

      return wastage;
    });
  }

  async findAll(destinationId?: number, warehouseOnly?: boolean) {
    const where: any = {};
    if (warehouseOnly) {
      where.destinationId = null;
    } else if (destinationId) {
      where.destinationId = destinationId;
    }

    return this.prisma.wastage.findMany({
      where,
      include: {
        item: true,
        destination: true,
        user: { select: { id: true, email: true, name: true, role: true } },
      },
      orderBy: { date: 'desc' },
    });
  }
}
