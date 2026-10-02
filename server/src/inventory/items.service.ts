import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Items, Prisma, MovementType, PriceType } from '@prisma/client';

@Injectable()
export class ItemsService {
  constructor(private prisma: PrismaService) {}

  async create(
    createdBy: number,
    data: {
      name: string;
      description?: string;
      sku?: string;
      sellingPrice?: number;
      costPrice?: number;
      initialQuantity?: number;
    },
  ): Promise<Items> {
    const { name, description, sku, sellingPrice, costPrice, initialQuantity } = data;

    let finalSku = sku;
    if (!finalSku || finalSku.trim() === '') {
      const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
      finalSku = `SKU-${randomPart}`;
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const item = await tx.items.create({
          data: {
            name,
            description,
            sku: finalSku,
          },
        });

        if (sellingPrice !== undefined) {
          await tx.itemPrices.create({
            data: {
              itemId: item.id,
              price: sellingPrice,
              priceType: PriceType.SELLING,
            },
          });
        }

        if (costPrice !== undefined) {
          await tx.itemPrices.create({
            data: {
              itemId: item.id,
              price: costPrice,
              priceType: PriceType.COST,
            },
          });
        }

        // Also record initial ItemPriceHistory entry for new items
        if (sellingPrice !== undefined || costPrice !== undefined) {
          await tx.itemPriceHistory.create({
            data: {
              itemId: item.id,
              costPrice: new Prisma.Decimal(costPrice || 0),
              sellingPrice: new Prisma.Decimal(sellingPrice || 0),
              effectiveFrom: new Date(),
              notes: 'Initial product price',
              createdBy,
            },
          });
        }

        if (initialQuantity && initialQuantity > 0) {
          const unitCostVal = costPrice || 0;
          const subtotalVal = initialQuantity * unitCostVal;

          const purchase = await tx.purchases.create({
            data: {
              supplierName: 'Initial Product Setup',
              invoiceNumber: `INIT-${item.id}`,
              totalCost: new Prisma.Decimal(subtotalVal),
              userId: createdBy,
              items: {
                create: [
                  {
                    itemId: item.id,
                    quantity: initialQuantity,
                    unitCost: new Prisma.Decimal(unitCostVal),
                    subtotal: new Prisma.Decimal(subtotalVal),
                  },
                ],
              },
            },
          });

          await tx.inventoryMovements.create({
            data: {
              itemId: item.id,
              type: MovementType.PURCHASE,
              quantityChange: initialQuantity,
              destinationId: null, // warehouse
              referenceId: purchase.id,
              referenceType: 'Purchases',
            },
          });
        }

        return item;
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new BadRequestException('An item with this SKU already exists.');
      }
      throw error;
    }
  }

  async findAll(destinationId?: number): Promise<any[]> {
    const items = await this.prisma.items.findMany({
      where: { isActive: true },
    });

    const now = new Date();

    return Promise.all(
      items.map(async (item) => {
        // Warehouse stock (destinationId = null) vs Destination stock vs Total
        const warehouseStockAgg = await this.prisma.inventoryMovements.aggregate({
          where: { itemId: item.id, destinationId: null },
          _sum: { quantityChange: true },
        });

        let specificDestStock = 0;
        if (destinationId) {
          const destStockAgg = await this.prisma.inventoryMovements.aggregate({
            where: { itemId: item.id, destinationId },
            _sum: { quantityChange: true },
          });
          specificDestStock = destStockAgg._sum.quantityChange || 0;
        }

        // Active price from ItemPriceHistory where effectiveFrom <= now
        const priceHistoryRecord = await this.prisma.itemPriceHistory.findFirst({
          where: {
            itemId: item.id,
            effectiveFrom: { lte: now },
          },
          orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
        });

        return {
          ...item,
          sellingPrice: priceHistoryRecord ? Number(priceHistoryRecord.sellingPrice) : 0,
          costPrice: priceHistoryRecord ? Number(priceHistoryRecord.costPrice) : 0,
          warehouseStock: warehouseStockAgg._sum.quantityChange || 0,
          destinationStock: specificDestStock,
        };
      }),
    );
  }

  async findOne(id: number): Promise<any> {
    const item = await this.prisma.items.findUnique({
      where: { id },
    });
    if (!item) {
      throw new NotFoundException(`Item with ID ${id} not found`);
    }

    const warehouseStockAgg = await this.prisma.inventoryMovements.aggregate({
      where: { itemId: id, destinationId: null },
      _sum: { quantityChange: true },
    });

    const now = new Date();
    const priceHistoryRecord = await this.prisma.itemPriceHistory.findFirst({
      where: {
        itemId: id,
        effectiveFrom: { lte: now },
      },
      orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
    });

    return {
      ...item,
      sellingPrice: priceHistoryRecord ? Number(priceHistoryRecord.sellingPrice) : 0,
      costPrice: priceHistoryRecord ? Number(priceHistoryRecord.costPrice) : 0,
      warehouseStock: warehouseStockAgg._sum.quantityChange || 0,
    };
  }

  async updatePrices(id: number, data: { sellingPrice?: number; costPrice?: number }): Promise<any> {
    const { sellingPrice, costPrice } = data;
    return this.prisma.$transaction(async (tx) => {
      if (sellingPrice !== undefined) {
        await tx.itemPrices.create({
          data: {
            itemId: id,
            price: sellingPrice,
            priceType: PriceType.SELLING,
          },
        });
      }
      if (costPrice !== undefined) {
        await tx.itemPrices.create({
          data: {
            itemId: id,
            price: costPrice,
            priceType: PriceType.COST,
          },
        });
      }
      return this.findOne(id);
    });
  }

  async remove(id: number): Promise<Items> {
    return this.prisma.items.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
