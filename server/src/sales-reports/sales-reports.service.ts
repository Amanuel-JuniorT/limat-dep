import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MovementType, DestinationType, PaymentMethod } from '@prisma/client';
import { ItemPriceHistoryService } from '../item-price-history/item-price-history.service';

@Injectable()
export class SalesReportsService {
  constructor(
    private prisma: PrismaService,
    private priceHistory: ItemPriceHistoryService,
  ) {}

  async create(
    userId: number,
    data: {
      destinationId: number;
      saleDate: string;
      items: {
        itemId: number;
        quantity: number;
        unitPrice: number;
        paymentMethod?: PaymentMethod;
        tipAmount?: number;
        notes?: string;
      }[];
      tipAmount?: number;
      paymentMethod?: PaymentMethod;
      paymentDetails?: any;
      notes?: string;
    },
  ) {
    const { destinationId, saleDate, items, paymentDetails } = data;

    const dest = await this.prisma.stockDestination.findUnique({ where: { id: destinationId } });
    if (!dest) throw new NotFoundException('Destination not found');

    const dateObj = new Date(saleDate);

    // Check if destination is marked closed
    const closed = await this.prisma.closedDate.findFirst({
      where: {
        destinationId,
        date: dateObj,
      },
    });
    if (closed) {
      throw new BadRequestException(`Destination is marked as closed for date ${saleDate} (${closed.reason || 'No reason provided'})`);
    }

    const subtotal = items.reduce((acc, i) => acc + i.quantity * i.unitPrice, 0);
    const totalTips = items.reduce((acc, i) => acc + (i.tipAmount || 0), 0) + (data.tipAmount || 0);
    const totalAmount = subtotal + totalTips;
    const primaryPaymentMethod = items[0]?.paymentMethod || data.paymentMethod || PaymentMethod.CASH;

    return this.prisma.$transaction(async (tx) => {
      // Resolve cost price for each item at the sale date
      const itemsWithCost = await Promise.all(
        items.map(async (i) => {
          const price = await this.priceHistory.getEffectivePrice(i.itemId, dateObj);
          return { ...i, costPrice: price?.costPrice ?? null };
        }),
      );

      const report = await tx.salesReport.create({
        data: {
          destinationId,
          userId,
          saleDate: dateObj,
          subtotal,
          tipAmount: totalTips,
          totalAmount,
          paymentMethod: primaryPaymentMethod,
          paymentDetails,
          notes: data.notes,
          items: {
            create: itemsWithCost.map((i) => ({
              itemId: i.itemId,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              costPrice: i.costPrice,
              subtotal: i.quantity * i.unitPrice,
              paymentMethod: i.paymentMethod || PaymentMethod.CASH,
              tipAmount: i.tipAmount || 0,
              notes: i.notes || null,
            })),
          },
        },
        include: {
          destination: true,
          user: { select: { id: true, email: true, name: true, role: true } },
          items: { include: { item: true } },
        },
      });

      const movementType = dest.type === DestinationType.SHOP ? MovementType.SHOP_SALE : MovementType.EVENT_SALE;

      for (const item of items) {
        await tx.inventoryMovements.create({
          data: {
            itemId: item.itemId,
            type: movementType,
            quantityChange: -item.quantity,
            destinationId,
            referenceId: report.id,
            referenceType: 'SALES_REPORT',
          },
        });
      }

      return report;
    });
  }

  async findAll(destinationId?: number, userId?: number) {
    const where: any = {};
    if (destinationId) where.destinationId = destinationId;
    if (userId) where.userId = userId;

    return this.prisma.salesReport.findMany({
      where,
      include: {
        destination: true,
        user: { select: { id: true, email: true, name: true, role: true } },
        items: { include: { item: true } },
      },
      orderBy: [{ saleDate: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(id: number) {
    const report = await this.prisma.salesReport.findUnique({
      where: { id },
      include: {
        destination: true,
        user: { select: { id: true, email: true, name: true, role: true } },
        items: { include: { item: true } },
      },
    });
    if (!report) throw new NotFoundException('Sales report not found');
    return report;
  }

  async update(
    id: number,
    user: { id: number; role: string },
    data: {
      destinationId?: number;
      saleDate?: string;
      items?: {
        itemId: number;
        quantity: number;
        unitPrice: number;
        paymentMethod?: PaymentMethod;
        tipAmount?: number;
        notes?: string;
      }[];
      tipAmount?: number;
      paymentMethod?: PaymentMethod;
      notes?: string;
    },
  ) {
    const report = await this.findOne(id);
    if (user.role === 'SELLER' && report.userId !== user.id) {
      throw new BadRequestException('You can only edit your own submitted reports');
    }

    const destinationId = data.destinationId || report.destinationId;
    const dest = await this.prisma.stockDestination.findUnique({ where: { id: destinationId } });
    if (!dest) throw new NotFoundException('Destination not found');

    const saleDateStr = data.saleDate || report.saleDate.toISOString().split('T')[0];
    const dateObj = new Date(saleDateStr);

    const closed = await this.prisma.closedDate.findFirst({
      where: {
        destinationId,
        date: dateObj,
      },
    });
    if (closed) {
      throw new BadRequestException(`Destination is marked as closed for date ${saleDateStr}`);
    }


    return this.prisma.$transaction(async (tx) => {
      // 1. Delete previous inventory movements for this report
      await tx.inventoryMovements.deleteMany({
        where: { referenceId: id, referenceType: 'SALES_REPORT' },
      });

      // 2. Delete previous report items
      await tx.salesReportItems.deleteMany({
        where: { salesReportId: id },
      });

      // 3. Update report
      const updatedItems = data.items || report.items.map((i) => ({
        itemId: i.itemId,
        quantity: i.quantity,
        unitPrice: Number(i.unitPrice),
        paymentMethod: (i as any).paymentMethod || report.paymentMethod,
        tipAmount: Number((i as any).tipAmount || 0),
        notes: (i as any).notes || undefined,
      }));

      const subtotal = updatedItems.reduce((acc, i) => acc + i.quantity * i.unitPrice, 0);
      const totalTips = updatedItems.reduce((acc, i) => acc + (i.tipAmount || 0), 0) + (data.tipAmount || 0);
      const totalAmount = subtotal + totalTips;
      const primaryPaymentMethod = updatedItems[0]?.paymentMethod || data.paymentMethod || report.paymentMethod;

      // Re-resolve cost prices for the (possibly new) sale date
      const itemsWithCost = await Promise.all(
        updatedItems.map(async (i) => {
          const price = await this.priceHistory.getEffectivePrice(i.itemId, dateObj);
          return { ...i, costPrice: price?.costPrice ?? null };
        }),
      );

      const updatedReport = await tx.salesReport.update({
        where: { id },
        data: {
          destinationId,
          saleDate: dateObj,
          subtotal,
          tipAmount: totalTips,
          totalAmount,
          paymentMethod: primaryPaymentMethod,
          notes: data.notes !== undefined ? data.notes : report.notes,
          items: {
            create: itemsWithCost.map((i) => ({
              itemId: i.itemId,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              costPrice: i.costPrice,
              subtotal: i.quantity * i.unitPrice,
              paymentMethod: i.paymentMethod || PaymentMethod.CASH,
              tipAmount: i.tipAmount || 0,
              notes: i.notes || null,
            })),
          },
        },
        include: {
          destination: true,
          user: { select: { id: true, email: true, name: true, role: true } },
          items: { include: { item: true } },
        },
      });

      // 4. Create new inventory movements
      const movementType = dest.type === DestinationType.SHOP ? MovementType.SHOP_SALE : MovementType.EVENT_SALE;

      for (const item of updatedItems) {
        await tx.inventoryMovements.create({
          data: {
            itemId: item.itemId,
            type: movementType,
            quantityChange: -item.quantity,
            destinationId,
            referenceId: id,
            referenceType: 'SALES_REPORT',
          },
        });
      }

      return updatedReport;
    });
  }

  async remove(id: number, user: { id: number; role: string }) {
    const report = await this.findOne(id);
    if (user.role === 'SELLER' && report.userId !== user.id) {
      throw new BadRequestException('You can only delete your own submitted reports');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.inventoryMovements.deleteMany({
        where: { referenceId: id, referenceType: 'SALES_REPORT' },
      });
      await tx.salesReportItems.deleteMany({
        where: { salesReportId: id },
      });
      await tx.salesReport.delete({
        where: { id },
      });
      return { message: 'Sales report deleted successfully' };
    });
  }
}
