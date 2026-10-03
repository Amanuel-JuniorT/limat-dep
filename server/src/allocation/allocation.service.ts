import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MovementType } from '@prisma/client';

@Injectable()
export class AllocationService {
  constructor(private prisma: PrismaService) {}

  async createAllocation(
    userId: number,
    data: {
      destinationId: number;
      items: { itemId: number; quantity: number }[];
      notes?: string;
      spinPrice?: number;
    },
  ) {
    const { destinationId, items, notes, spinPrice } = data;

    const dest = await this.prisma.stockDestination.findUnique({ where: { id: destinationId } });
    if (!dest) throw new NotFoundException('Destination not found');

    return this.prisma.$transaction(async (tx) => {
      // Auto-reopen a closed EVENT_WINDOW when new stock is allocated to it, and update spinPrice if supplied
      if (dest.type === 'EVENT_WINDOW') {
        const updateData: { isActive?: boolean; spinPrice?: number } = {};
        if (!dest.isActive) updateData.isActive = true;
        if (spinPrice !== undefined && !isNaN(Number(spinPrice))) updateData.spinPrice = Number(spinPrice);

        if (Object.keys(updateData).length > 0) {
          await tx.stockDestination.update({
            where: { id: destinationId },
            data: updateData,
          });
        }
      }

      const allocation = await tx.allocation.create({
        data: {
          destinationId,
          userId,
          isReturn: false,
          notes,
          items: {
            create: items.map((i) => ({
              itemId: i.itemId,
              quantity: i.quantity,
            })),
          },
        },
        include: { items: { include: { item: true } }, destination: true, user: { select: { id: true, email: true, name: true, role: true } } },
      });

      for (const item of items) {
        // Warehouse stock decreases
        await tx.inventoryMovements.create({
          data: {
            itemId: item.itemId,
            type: MovementType.ALLOCATION_OUT,
            quantityChange: -item.quantity,
            destinationId: null,
            referenceId: allocation.id,
            referenceType: 'ALLOCATION',
          },
        });

        // Destination stock increases
        await tx.inventoryMovements.create({
          data: {
            itemId: item.itemId,
            type: MovementType.ALLOCATION_IN,
            quantityChange: item.quantity,
            destinationId,
            referenceId: allocation.id,
            referenceType: 'ALLOCATION',
          },
        });
      }

      return allocation;
    });
  }

  async returnAllocation(
    userId: number,
    data: {
      destinationId: number;
      items: { itemId: number; quantity: number }[];
      notes?: string;
    },
  ) {
    const { destinationId, items, notes } = data;

    const dest = await this.prisma.stockDestination.findUnique({ where: { id: destinationId } });
    if (!dest) throw new NotFoundException('Destination not found');

    // Validate: each item must have sufficient balance at this destination
    for (const item of items) {
      const balanceAgg = await this.prisma.inventoryMovements.aggregate({
        where: { itemId: item.itemId, destinationId },
        _sum: { quantityChange: true },
      });
      const currentBalance = balanceAgg._sum.quantityChange || 0;
      if (item.quantity > currentBalance) {
        const itemRecord = await this.prisma.items.findUnique({ where: { id: item.itemId }, select: { name: true } });
        throw new BadRequestException(
          `Cannot return ${item.quantity} units of "${itemRecord?.name || 'item'}". ` +
          `This location only has ${currentBalance} unit${currentBalance !== 1 ? 's' : ''} allocated.`,
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const allocation = await tx.allocation.create({
        data: {
          destinationId,
          userId,
          isReturn: true,
          notes,
          items: {
            create: items.map((i) => ({
              itemId: i.itemId,
              quantity: i.quantity,
            })),
          },
        },
        include: { items: { include: { item: true } }, destination: true, user: { select: { id: true, email: true, name: true, role: true } } },
      });

      for (const item of items) {
        // Destination stock decreases
        await tx.inventoryMovements.create({
          data: {
            itemId: item.itemId,
            type: MovementType.ALLOCATION_RETURN,
            quantityChange: -item.quantity,
            destinationId,
            referenceId: allocation.id,
            referenceType: 'ALLOCATION_RETURN',
          },
        });

        // Warehouse stock increases
        await tx.inventoryMovements.create({
          data: {
            itemId: item.itemId,
            type: MovementType.ALLOCATION_RETURN,
            quantityChange: item.quantity,
            destinationId: null,
            referenceId: allocation.id,
            referenceType: 'ALLOCATION_RETURN',
          },
        });
      }

      return allocation;
    });
  }

  async findAll() {
    return this.prisma.allocation.findMany({
      include: {
        destination: true,
        user: { select: { id: true, email: true, name: true, role: true } },
        items: { include: { item: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByDestination(destinationId: number) {
    return this.prisma.allocation.findMany({
      where: { destinationId },
      include: {
        destination: true,
        user: { select: { id: true, email: true, name: true, role: true } },
        items: { include: { item: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDestinationBalances(destinationId?: number) {
    const whereClause: any = { destinationId: { not: null } };
    if (destinationId) {
      whereClause.destinationId = destinationId;
    }

    const grouped = await this.prisma.inventoryMovements.groupBy({
      by: ['destinationId', 'itemId'],
      where: whereClause,
      _sum: { quantityChange: true },
    });

    const itemIds = Array.from(new Set(grouped.map((g) => g.itemId)));
    const items = await this.prisma.items.findMany({
      where: { id: { in: itemIds } },
      select: { id: true, name: true, sku: true },
    });

    const destIds = Array.from(new Set(grouped.map((g) => g.destinationId).filter(Boolean))) as number[];
    const destinations = await this.prisma.stockDestination.findMany({
      where: { id: { in: destIds } },
    });

    const result: Record<number, { destination: any; items: { itemId: number; item: any; currentStock: number }[] }> = {};

    for (const g of grouped) {
      if (!g.destinationId) continue;
      const stock = g._sum.quantityChange || 0;
      if (stock === 0) continue;

      if (!result[g.destinationId]) {
        const dest = destinations.find((d) => d.id === g.destinationId);
        result[g.destinationId] = { destination: dest, items: [] };
      }

      const item = items.find((i) => i.id === g.itemId);
      result[g.destinationId].items.push({
        itemId: g.itemId,
        item,
        currentStock: stock,
      });
    }

    return Object.values(result);
  }
}
