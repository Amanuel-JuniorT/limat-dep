import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MovementType, DestinationType, PaymentMethod, EventRecordType } from '@prisma/client';
import { ItemPriceHistoryService } from '../item-price-history/item-price-history.service';

export interface SpinReportItemInput {
  type: EventRecordType; // 'SPIN' or 'SALE'
  itemId?: number;
  spinCount?: number;
  quantity?: number;
  unitPrice?: number;
  paymentMethod?: PaymentMethod;
  tipAmount?: number;
  notes?: string;
}

@Injectable()
export class SpinReportsService {
  constructor(
    private prisma: PrismaService,
    private priceHistory: ItemPriceHistoryService,
  ) {}

  async create(
    userId: number,
    data: {
      destinationId: number;
      reportDate: string;
      items: SpinReportItemInput[];
      notes?: string;
    },
  ) {
    const { destinationId, reportDate, items = [], notes } = data;

    const dest = await this.prisma.stockDestination.findUnique({ where: { id: destinationId } });
    if (!dest) throw new NotFoundException('Destination not found');

    if (dest.type !== DestinationType.EVENT_WINDOW) {
      throw new BadRequestException('Spin/Event reports can only be recorded for Event Window destinations!');
    }

    const dateObj = new Date(reportDate);

    // Check if marked closed
    const closed = await this.prisma.closedDate.findFirst({
      where: {
        destinationId,
        date: dateObj,
      },
    });
    if (closed) {
      throw new BadRequestException(`Destination is marked as closed for date ${reportDate}`);
    }

    let totalSpins = 0;
    let subtotal = 0;
    let totalTips = 0;

    const spinPricePerSpin = Number(dest.spinPrice ?? 30);

    const processedItems = items.map((i) => {
      const type = i.type || EventRecordType.SPIN;
      const spinCount = type === EventRecordType.SPIN ? (i.spinCount || 1) : 0;
      const quantity = type === EventRecordType.SALE ? (i.quantity || 1) : (i.quantity || 0); // for spin, quantity is reward item count if any
      const unitPrice = type === EventRecordType.SALE ? (i.unitPrice || 0) : spinPricePerSpin;
      const itemSubtotal = type === EventRecordType.SPIN ? spinCount * spinPricePerSpin : quantity * unitPrice;
      const tipAmount = i.tipAmount || 0;

      totalSpins += spinCount;
      subtotal += itemSubtotal;
      totalTips += tipAmount;

      return {
        type,
        itemId: i.itemId || null,
        spinCount,
        quantity,
        unitPrice,
        subtotal: itemSubtotal,
        paymentMethod: i.paymentMethod || PaymentMethod.CASH,
        tipAmount,
        notes: i.notes || null,
      };
    });

    const totalAmount = subtotal + totalTips;
    const primaryPaymentMethod = processedItems[0]?.paymentMethod || PaymentMethod.CASH;

    return this.prisma.$transaction(async (tx) => {
      // Resolve cost prices for SALE items that have an itemId
      const processedItemsWithCost = await Promise.all(
        processedItems.map(async (i) => {
          if (i.type === EventRecordType.SALE && i.itemId) {
            const price = await this.priceHistory.getEffectivePrice(i.itemId, dateObj);
            return { ...i, costPrice: price?.costPrice ?? null };
          }
          return { ...i, costPrice: null };
        }),
      );

      const report = await tx.spinReport.create({
        data: {
          destinationId,
          userId,
          reportDate: dateObj,
          spinCount: totalSpins,
          revenuePerSpin: spinPricePerSpin,
          subtotal,
          tipAmount: totalTips,
          totalAmount,
          paymentMethod: primaryPaymentMethod,
          notes,
          items: {
            create: processedItemsWithCost.map((i) => ({
              type: i.type,
              itemId: i.itemId,
              spinCount: i.spinCount,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              costPrice: i.costPrice,
              subtotal: i.subtotal,
              paymentMethod: i.paymentMethod,
              tipAmount: i.tipAmount,
              notes: i.notes,
            })),
          },
        },
        include: {
          destination: true,
          user: { select: { id: true, email: true, name: true, role: true } },
          items: { include: { item: true } },
        },
      });

      for (const item of processedItemsWithCost) {
        if (item.itemId && item.quantity > 0) {
          const movementType =
            item.type === EventRecordType.SPIN
              ? MovementType.SPIN_REWARD
              : MovementType.EVENT_SALE;

          await tx.inventoryMovements.create({
            data: {
              itemId: item.itemId,
              type: movementType,
              quantityChange: -item.quantity,
              destinationId,
              referenceId: report.id,
              referenceType: 'SPIN_REPORT',
            },
          });
        }
      }

      return report;
    });
  }

  async findAll(destinationId?: number, userId?: number) {
    const where: any = {};
    if (destinationId) where.destinationId = destinationId;
    if (userId) where.userId = userId;

    return this.prisma.spinReport.findMany({
      where,
      include: {
        destination: true,
        user: { select: { id: true, email: true, name: true, role: true } },
        items: { include: { item: true } },
      },
      orderBy: [{ reportDate: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(id: number) {
    const report = await this.prisma.spinReport.findUnique({
      where: { id },
      include: {
        destination: true,
        user: { select: { id: true, email: true, name: true, role: true } },
        items: { include: { item: true } },
      },
    });
    if (!report) throw new NotFoundException('Event report not found');
    return report;
  }

  async update(
    id: number,
    user: { id: number; role: string },
    data: {
      destinationId?: number;
      reportDate?: string;
      items?: SpinReportItemInput[];
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

    const reportDateStr = data.reportDate || report.reportDate.toISOString().split('T')[0];
    const dateObj = new Date(reportDateStr);

    const closed = await this.prisma.closedDate.findFirst({
      where: {
        destinationId,
        date: dateObj,
      },
    });
    if (closed) {
      throw new BadRequestException(`Destination is marked as closed for date ${reportDateStr}`);
    }

    const itemsInput = data.items || report.items.map((i) => ({
      type: i.type,
      itemId: i.itemId || undefined,
      spinCount: i.spinCount,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice),
      paymentMethod: i.paymentMethod,
      tipAmount: Number(i.tipAmount || 0),
      notes: i.notes || undefined,
    }));

    let totalSpins = 0;
    let subtotal = 0;
    let totalTips = 0;

    const spinPricePerSpin = Number(dest.spinPrice ?? 30);

    const processedItems = itemsInput.map((i) => {
      const type = i.type || EventRecordType.SPIN;
      const spinCount = type === EventRecordType.SPIN ? (i.spinCount || 1) : 0;
      const quantity = type === EventRecordType.SALE ? (i.quantity || 1) : (i.quantity || 0);
      const unitPrice = type === EventRecordType.SALE ? (i.unitPrice || 0) : spinPricePerSpin;
      const itemSubtotal = type === EventRecordType.SPIN ? spinCount * spinPricePerSpin : quantity * unitPrice;
      const tipAmount = i.tipAmount || 0;

      totalSpins += spinCount;
      subtotal += itemSubtotal;
      totalTips += tipAmount;

      return {
        type,
        itemId: i.itemId || null,
        spinCount,
        quantity,
        unitPrice,
        subtotal: itemSubtotal,
        paymentMethod: i.paymentMethod || PaymentMethod.CASH,
        tipAmount,
        notes: i.notes || null,
      };
    });

    const totalAmount = subtotal + totalTips;
    const primaryPaymentMethod = processedItems[0]?.paymentMethod || PaymentMethod.CASH;

    return this.prisma.$transaction(async (tx) => {
      // 1. Rollback old inventory movements
      await tx.inventoryMovements.deleteMany({
        where: { referenceId: id, referenceType: 'SPIN_REPORT' },
      });

      // 2. Delete old items
      await tx.spinReportItems.deleteMany({
        where: { spinReportId: id },
      });

      // 3. Update main spin report
      const updatedReport = await tx.spinReport.update({
        where: { id },
        data: {
          destinationId,
          reportDate: dateObj,
          spinCount: totalSpins,
          revenuePerSpin: spinPricePerSpin,
          subtotal,
          tipAmount: totalTips,
          totalAmount,
          paymentMethod: primaryPaymentMethod,
          notes: data.notes !== undefined ? data.notes : report.notes,
          items: {
            create: processedItems.map((i) => ({
              type: i.type,
              itemId: i.itemId,
              spinCount: i.spinCount,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              costPrice: (i as any).costPrice ?? null,
              subtotal: i.subtotal,
              paymentMethod: i.paymentMethod,
              tipAmount: i.tipAmount,
              notes: i.notes,
            })),
          },
        },
        include: {
          destination: true,
          user: { select: { id: true, email: true, name: true, role: true } },
          items: { include: { item: true } },
        },
      });

      // 4. Re-create new inventory movements
      for (const item of processedItems) {
        if (item.itemId && item.quantity > 0) {
          const movementType =
            item.type === EventRecordType.SPIN
              ? MovementType.SPIN_REWARD
              : MovementType.EVENT_SALE;

          await tx.inventoryMovements.create({
            data: {
              itemId: item.itemId,
              type: movementType,
              quantityChange: -item.quantity,
              destinationId,
              referenceId: id,
              referenceType: 'SPIN_REPORT',
            },
          });
        }
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
        where: { referenceId: id, referenceType: 'SPIN_REPORT' },
      });
      await tx.spinReportItems.deleteMany({
        where: { spinReportId: id },
      });
      await tx.spinReport.delete({
        where: { id },
      });
      return { message: 'Event report deleted successfully' };
    });
  }
}
