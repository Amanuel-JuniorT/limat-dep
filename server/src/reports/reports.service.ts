import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getSummary(startDate: Date, endDate: Date, destinationId?: number) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const salesWhere: any = {
      saleDate: { gte: start, lte: end },
    };
    const spinWhere: any = {
      reportDate: { gte: start, lte: end },
    };
    if (destinationId) {
      salesWhere.destinationId = destinationId;
      spinWhere.destinationId = destinationId;
    }

    const salesReports = await this.prisma.salesReport.findMany({
      where: salesWhere,
      include: {
        items: { include: { item: true } },
      },
    });

    const spinReports = await this.prisma.spinReport.findMany({
      where: spinWhere,
      include: {
        items: { include: { item: true } },
      },
    });

    const salesRevenue = salesReports.reduce((sum, r) => sum + Number(r.subtotal || 0), 0);
    const salesCount = salesReports.length;

    const spinRevenue = spinReports.reduce((sum, r) => sum + Number(r.subtotal || 0), 0);
    const spinCount = spinReports.reduce((sum, r) => sum + r.spinCount, 0);

    const salesTips = salesReports.reduce((sum, r) => sum + Number(r.tipAmount || 0), 0);
    const spinTips = spinReports.reduce((sum, r) => sum + Number(r.tipAmount || 0), 0);
    const totalTips = salesTips + spinTips;

    const totalRevenue = salesRevenue + spinRevenue + totalTips;

    const paymentBreakdown = { CASH: 0, TELEBIRR: 0, CBE: 0 };
    const tipBreakdown = { CASH: 0, TELEBIRR: 0, CBE: 0 };

    // Process sales report payments
    salesReports.forEach((r) => {
      const method = r.paymentMethod as keyof typeof paymentBreakdown;
      if (paymentBreakdown[method] !== undefined) {
        paymentBreakdown[method] += Number(r.totalAmount || 0);
        tipBreakdown[method] += Number(r.tipAmount || 0);
      }
    });

    // Process spin report payments
    spinReports.forEach((r) => {
      const method = r.paymentMethod as keyof typeof paymentBreakdown;
      if (paymentBreakdown[method] !== undefined) {
        paymentBreakdown[method] += Number(r.totalAmount || 0);
        tipBreakdown[method] += Number(r.tipAmount || 0);
      }
    });

    // Item sales breakdown
    const itemMap = new Map<number, { name: string; quantity: number; revenue: number }>();
    salesReports.forEach((r) => {
      r.items.forEach((item) => {
        const existing = itemMap.get(item.itemId) || { name: item.item.name, quantity: 0, revenue: 0 };
        existing.quantity += item.quantity;
        existing.revenue += Number(item.subtotal);
        itemMap.set(item.itemId, existing);
      });
    });

    const itemBreakdown = Array.from(itemMap.entries()).map(([itemId, data]) => ({
      itemId,
      ...data,
      revenue: Number(data.revenue.toFixed(2)),
    }));

    // Spin rewards & event sales breakdown
    const spinItemMap = new Map<number, { name: string; quantity: number }>();
    spinReports.forEach((r) => {
      r.items.forEach((item) => {
        if (item.itemId && item.item) {
          const existing = spinItemMap.get(item.itemId) || { name: item.item.name, quantity: 0 };
          existing.quantity += item.quantity;
          spinItemMap.set(item.itemId, existing);
        }
      });
    });

    const spinBreakdown = Array.from(spinItemMap.entries()).map(([itemId, data]) => ({
      itemId,
      ...data,
    }));

    // Wastage summary
    const wastageWhere: any = { date: { gte: start, lte: end } };
    if (destinationId) wastageWhere.destinationId = destinationId;
    const wastages = await this.prisma.wastage.findMany({
      where: wastageWhere,
      include: { item: true },
    });

    const wastageCount = wastages.reduce((sum, w) => sum + w.quantity, 0);

    return {
      date: start,
      endDate: end,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      salesRevenue: Number(salesRevenue.toFixed(2)),
      salesCount,
      spinRevenue: Number(spinRevenue.toFixed(2)),
      spinCount,
      totalTips: Number(totalTips.toFixed(2)),
      wastageCount,
      paymentBreakdown: {
        CASH: Number(paymentBreakdown.CASH.toFixed(2)),
        TELEBIRR: Number(paymentBreakdown.TELEBIRR.toFixed(2)),
        CBE: Number(paymentBreakdown.CBE.toFixed(2)),
      },
      tipBreakdown: {
        CASH: Number(tipBreakdown.CASH.toFixed(2)),
        TELEBIRR: Number(tipBreakdown.TELEBIRR.toFixed(2)),
        CBE: Number(tipBreakdown.CBE.toFixed(2)),
      },
      itemBreakdown,
      spinBreakdown,
    };
  }

  async getInventoryStatus() {
    const items = await this.prisma.items.findMany({ where: { isActive: true } });
    const status: { id: number; name: string; warehouseStock: number }[] = [];

    for (const item of items) {
      const stockAgg = await this.prisma.inventoryMovements.aggregate({
        where: { itemId: item.id, destinationId: null },
        _sum: { quantityChange: true },
      });
      status.push({
        id: item.id,
        name: item.name,
        warehouseStock: stockAgg._sum.quantityChange || 0,
      });
    }

    return status;
  }
}
