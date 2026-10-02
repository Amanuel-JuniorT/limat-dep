import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Purchases, MovementType, Prisma } from '@prisma/client';
import { ItemPriceHistoryService } from '../item-price-history/item-price-history.service';

@Injectable()
export class PurchasesService {
  constructor(
    private prisma: PrismaService,
    private priceHistory: ItemPriceHistoryService,
  ) {}

  async create(
    userId: number,
    data: {
      supplierName?: string;
      invoiceNumber?: string;
      items: {
        itemId: number;
        quantity: number;
        unitCost: number;
        /** Optional: update the selling price from this intake */
        newSellingPrice?: number;
        /** Required when newSellingPrice is provided */
        effectiveFrom?: string;
        /** Optional note for the price change */
        priceNote?: string;
      }[];
    },
  ): Promise<Purchases> {
    return this.prisma.$transaction(async (tx) => {
      let totalCost = 0;
      const purchaseItemsData: Prisma.PurchaseItemsCreateManyPurchaseInput[] = [];

      for (const item of data.items) {
        const subtotal = item.quantity * item.unitCost;
        totalCost += subtotal;

        purchaseItemsData.push({
          itemId: item.itemId,
          quantity: item.quantity,
          unitCost: new Prisma.Decimal(item.unitCost),
          subtotal: new Prisma.Decimal(subtotal),
        });
      }

      const purchase = await tx.purchases.create({
        data: {
          supplierName: data.supplierName,
          invoiceNumber: data.invoiceNumber,
          totalCost: new Prisma.Decimal(totalCost),
          userId,
          items: {
            create: purchaseItemsData,
          },
        },
      });

      // Create inventory movements (warehouse stock increase)
      for (const item of data.items) {
        await tx.inventoryMovements.create({
          data: {
            itemId: item.itemId,
            type: MovementType.PURCHASE,
            quantityChange: item.quantity,
            referenceId: purchase.id,
            referenceType: 'Purchases',
          },
        });
      }

      // Create price history entries for items where cost or selling price changed
      for (const item of data.items) {
        const activePrice = await this.priceHistory.getEffectivePrice(item.itemId, new Date());
        
        // Target selling price: either explicitly provided or current active selling price (or unitCost as fallback)
        const targetSellingPrice = item.newSellingPrice !== undefined
          ? item.newSellingPrice
          : (activePrice?.sellingPrice ?? item.unitCost);

        const targetCostPrice = item.unitCost;
        let effectiveFromDate = new Date();
        if (item.effectiveFrom) {
          if (item.effectiveFrom.length === 10) {
            const now = new Date();
            effectiveFromDate = new Date(`${item.effectiveFrom}T${now.toTimeString().split(' ')[0]}`);
          } else {
            effectiveFromDate = new Date(item.effectiveFrom);
          }
        }

        const costChanged = !activePrice || Number(activePrice.costPrice) !== targetCostPrice;
        const sellingChanged = !activePrice || Number(activePrice.sellingPrice) !== targetSellingPrice;

        if (costChanged || sellingChanged) {
          await this.priceHistory.createEntry(
            userId,
            {
              itemId: item.itemId,
              costPrice: targetCostPrice,
              sellingPrice: targetSellingPrice,
              effectiveFrom: effectiveFromDate,
              notes: item.priceNote || `Intake price update (Cost: ${targetCostPrice}, Selling: ${targetSellingPrice})`,
              purchaseId: purchase.id,
            },
            tx,
          );
        }
      }

      return purchase;
    });
  }

  async findAll() {
    return this.prisma.purchases.findMany({
      include: {
        user: { select: { id: true, name: true, role: true } },
        items: {
          include: {
            item: { select: { id: true, name: true, sku: true } },
          },
        },
        priceHistory: {
          include: {
            item: { select: { id: true, name: true, sku: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    return this.prisma.purchases.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, role: true } },
        items: {
          include: {
            item: { select: { id: true, name: true, sku: true } },
          },
        },
        priceHistory: {
          include: {
            item: { select: { id: true, name: true, sku: true } },
          },
        },
      },
    });
  }

  async calculateAverageCost(itemId: number): Promise<number> {
    const aggregations = await this.prisma.purchaseItems.aggregate({
      where: { itemId },
      _sum: {
        quantity: true,
        subtotal: true,
      },
    });

    const totalQuantity = aggregations._sum.quantity || 0;
    const totalCost = Number(aggregations._sum.subtotal) || 0;

    return totalQuantity > 0 ? totalCost / totalQuantity : 0;
  }

  /**
   * Corrects the quantities/costs of an intake batch (and adjusts inventory movements)
   */
  async updateIntake(
    purchaseId: number,
    userId: number,
    data: {
      supplierName?: string;
      invoiceNumber?: string;
      items: {
        purchaseItemId: number;
        quantity: number;
        unitCost: number;
      }[];
    },
  ) {
    const purchase = await this.prisma.purchases.findUnique({
      where: { id: purchaseId },
      include: { items: true },
    });
    if (!purchase) throw new Error('Intake record not found');

    return this.prisma.$transaction(async (tx) => {
      let totalCost = 0;

      for (const updatedItem of data.items) {
        const existingItem = purchase.items.find((i) => i.id === updatedItem.purchaseItemId);
        if (!existingItem) continue;

        const newQty = Math.max(0, updatedItem.quantity);
        const newCost = updatedItem.unitCost;
        const newSubtotal = newQty * newCost;
        totalCost += newSubtotal;

        const qtyDiff = newQty - existingItem.quantity;

        // 1. Update PurchaseItems record
        await tx.purchaseItems.update({
          where: { id: existingItem.id },
          data: {
            quantity: newQty,
            unitCost: new Prisma.Decimal(newCost),
            subtotal: new Prisma.Decimal(newSubtotal),
          },
        });

        // 2. Adjust InventoryMovements PURCHASE record
        const movement = await tx.inventoryMovements.findFirst({
          where: {
            referenceId: purchaseId,
            referenceType: 'Purchases',
            itemId: existingItem.itemId,
          },
        });

        if (movement) {
          await tx.inventoryMovements.update({
            where: { id: movement.id },
            data: { quantityChange: newQty },
          });
        } else if (qtyDiff !== 0) {
          await tx.inventoryMovements.create({
            data: {
              itemId: existingItem.itemId,
              type: MovementType.PURCHASE,
              quantityChange: newQty,
              referenceId: purchaseId,
              referenceType: 'Purchases',
              destinationId: null,
            },
          });
        }
      }

      // Update total cost on Purchase record
      return tx.purchases.update({
        where: { id: purchaseId },
        data: {
          supplierName: data.supplierName,
          invoiceNumber: data.invoiceNumber,
          totalCost: new Prisma.Decimal(totalCost),
        },
        include: {
          items: { include: { item: true } },
          user: { select: { id: true, name: true, role: true } },
        },
      });
    });
  }
}
