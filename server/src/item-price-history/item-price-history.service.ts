import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class ItemPriceHistoryService {
  constructor(private prisma: PrismaService) {}

  /**
   * Returns the effective { costPrice, sellingPrice } for an item on a given date.
   * "Effective" = most recent ItemPriceHistory entry where effectiveFrom <= date.
   * Returns null if no price history exists yet.
   */
  async getEffectivePrice(
    itemId: number,
    date: Date,
  ): Promise<{ costPrice: number; sellingPrice: number } | null> {
    const entry = await this.prisma.itemPriceHistory.findFirst({
      where: {
        itemId,
        effectiveFrom: { lte: date },
      },
      orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
    });

    if (!entry) return null;

    return {
      costPrice: Number(entry.costPrice),
      sellingPrice: Number(entry.sellingPrice),
    };
  }

  /**
   * Creates a new price history entry. Optionally linked to a purchase.
   */
  async createEntry(
    createdBy: number,
    data: {
      itemId: number;
      costPrice: number;
      sellingPrice: number;
      effectiveFrom: Date;
      notes?: string;
      purchaseId?: number;
    },
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx || this.prisma;
    return client.itemPriceHistory.create({
      data: {
        itemId: data.itemId,
        costPrice: new Prisma.Decimal(data.costPrice),
        sellingPrice: new Prisma.Decimal(data.sellingPrice),
        effectiveFrom: data.effectiveFrom,
        notes: data.notes,
        createdBy,
        purchaseId: data.purchaseId || null,
      },
    });
  }

  /**
   * Returns all price history entries for a given item (newest first).
   */
  async findByItem(itemId: number) {
    const item = await this.prisma.items.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Item not found');

    return this.prisma.itemPriceHistory.findMany({
      where: { itemId },
      include: {
        user: { select: { id: true, name: true, role: true } },
        purchase: { select: { id: true, supplierName: true, invoiceNumber: true, createdAt: true } },
      },
      orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Returns all price history entries across all items (newest first).
   */
  async findAll() {
    return this.prisma.itemPriceHistory.findMany({
      include: {
        item: { select: { id: true, name: true, sku: true } },
        user: { select: { id: true, name: true, role: true } },
        purchase: { select: { id: true, supplierName: true, invoiceNumber: true, createdAt: true } },
      },
      orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Manually creates a standalone price change (not linked to an intake).
   */
  async createManual(
    createdBy: number,
    data: {
      itemId: number;
      costPrice: number;
      sellingPrice: number;
      effectiveFrom: string;
      notes?: string;
    },
  ) {
    const item = await this.prisma.items.findUnique({ where: { id: data.itemId } });
    if (!item) throw new NotFoundException('Item not found');

    let effectiveDate = new Date(data.effectiveFrom);
    // If effectiveFrom is passed as YYYY-MM-DD date string, combine with current time so exact timestamp is preserved
    if (data.effectiveFrom && data.effectiveFrom.length === 10) {
      const now = new Date();
      effectiveDate = new Date(`${data.effectiveFrom}T${now.toTimeString().split(' ')[0]}`);
    }

    return this.createEntry(createdBy, {
      itemId: data.itemId,
      costPrice: data.costPrice,
      sellingPrice: data.sellingPrice,
      effectiveFrom: effectiveDate,
      notes: data.notes,
    });
  }

  /**
   * Counts sales recorded after effectiveFrom date for an item.
   * Used by UI to notify user when creating a forward-facing price update.
   */
  async countSalesAfterDate(itemId: number, effectiveFrom: string) {
    const targetDate = new Date(effectiveFrom);
    const count = await this.prisma.salesReportItems.count({
      where: {
        itemId,
        salesReport: {
          saleDate: { gte: targetDate },
        },
      },
    });
    return { itemId, effectiveFrom, salesCount: count };
  }

  /**
   * Performs a retroactive price correction (Option A).
   * Updates sales report items where unitPrice equals the current wrong price (or costPrice for COST correction).
   * Logged in PriceCorrectionLog.
   */
  async correctPrice(
    correctedBy: number,
    data: {
      itemId: number;
      fieldCorrected: 'SELLING' | 'COST' | 'QTY';
      newPrice: number; // for QTY, this represents the new corrected quantity
      saleReportItemId?: number; // optional specific sale line item to correct quantity
    },
  ) {
    const item = await this.prisma.items.findUnique({ where: { id: data.itemId } });
    if (!item) throw new NotFoundException('Item not found');

    const currentPrice = await this.getEffectivePrice(data.itemId, new Date());
    const oldPrice = currentPrice
      ? (data.fieldCorrected === 'SELLING' ? currentPrice.sellingPrice : currentPrice.costPrice)
      : 0;

    return this.prisma.$transaction(async (tx) => {
      let recordsUpdated = 0;

      if (data.fieldCorrected === 'SELLING') {
        const updateRes = await tx.salesReportItems.updateMany({
          where: {
            itemId: data.itemId,
            unitPrice: new Prisma.Decimal(oldPrice),
          },
          data: {
            unitPrice: new Prisma.Decimal(data.newPrice),
          },
        });
        recordsUpdated = updateRes.count;

        const affectedItems = await tx.salesReportItems.findMany({
          where: {
            itemId: data.itemId,
            unitPrice: new Prisma.Decimal(data.newPrice),
          },
        });
        for (const item of affectedItems) {
          const newSubtotal = Number(data.newPrice) * item.quantity;
          await tx.salesReportItems.update({
            where: { id: item.id },
            data: { subtotal: new Prisma.Decimal(newSubtotal) },
          });
        }
      } else if (data.fieldCorrected === 'COST') {
        const updateRes = await tx.salesReportItems.updateMany({
          where: {
            itemId: data.itemId,
            costPrice: new Prisma.Decimal(oldPrice),
          },
          data: {
            costPrice: new Prisma.Decimal(data.newPrice),
          },
        });
        recordsUpdated = updateRes.count;
      } else if (data.fieldCorrected === 'QTY') {
        // Correcting quantity on a specific sale report item or inventory adjustment
        if (data.saleReportItemId) {
          const saleItem = await tx.salesReportItems.findUnique({ where: { id: data.saleReportItemId } });
          if (saleItem) {
            const oldQty = saleItem.quantity;
            const newQty = Math.max(0, Math.floor(data.newPrice));
            const newSubtotal = Number(saleItem.unitPrice) * newQty;

            await tx.salesReportItems.update({
              where: { id: data.saleReportItemId },
              data: {
                quantity: newQty,
                subtotal: new Prisma.Decimal(newSubtotal),
              },
            });
            recordsUpdated = 1;
          }
        } else {
          // Adjust warehouse quantity directly via movement
          const currentAgg = await tx.inventoryMovements.aggregate({
            where: { itemId: data.itemId, destinationId: null },
            _sum: { quantityChange: true },
          });
          const currentStock = currentAgg._sum.quantityChange || 0;
          const targetStock = Math.floor(data.newPrice);
          const diff = targetStock - currentStock;

          if (diff !== 0) {
            await tx.inventoryMovements.create({
              data: {
                itemId: data.itemId,
                type: 'ADJUSTMENT',
                quantityChange: diff,
                destinationId: null,
              },
            });
            recordsUpdated = 1;
          }
        }
      }

      // Record price history entry for SELLING or COST corrections
      if (data.fieldCorrected !== 'QTY') {
        await this.createEntry(
          correctedBy,
          {
            itemId: data.itemId,
            costPrice: data.fieldCorrected === 'COST' ? data.newPrice : (currentPrice?.costPrice ?? 0),
            sellingPrice: data.fieldCorrected === 'SELLING' ? data.newPrice : (currentPrice?.sellingPrice ?? 0),
            effectiveFrom: new Date(),
            notes: `CORRECTION (${data.fieldCorrected}): Adjusted from ${oldPrice} to ${data.newPrice}. ${recordsUpdated} sales records updated.`,
          },
          tx,
        );
      }

      // Audit log entry
      const log = await tx.priceCorrectionLog.create({
        data: {
          itemId: data.itemId,
          fieldCorrected: data.fieldCorrected,
          oldPrice: new Prisma.Decimal(oldPrice),
          newPrice: new Prisma.Decimal(data.newPrice),
          recordsUpdated,
          correctedBy,
        },
      });

      return {
        success: true,
        fieldCorrected: data.fieldCorrected,
        oldPrice,
        newPrice: data.newPrice,
        recordsUpdated,
        auditLogId: log.id,
      };
    });
  }

  /**
   * Returns price correction logs for an item.
   */
  async getCorrectionLogs(itemId: number) {
    return this.prisma.priceCorrectionLog.findMany({
      where: { itemId },
      include: {
        user: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
