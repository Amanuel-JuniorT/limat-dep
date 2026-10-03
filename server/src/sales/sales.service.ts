import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Transactions, TransactionType, MovementType, Prisma, PaymentMethod } from '@prisma/client';
import { StockService } from '../inventory/stock.service';
import { PricesService } from '../inventory/prices.service';

@Injectable()
export class SalesService {
  constructor(
    private prisma: PrismaService,
    private stockService: StockService,
    private pricesService: PricesService,
  ) {}

  async createSale(
    userId: number,
    items: { itemId: number; quantity: number }[],
    tipAmount?: number,
    paymentMethod: PaymentMethod = PaymentMethod.CASH,
    paymentDetails?: any,
  ): Promise<Transactions> {
    
    if (!userId) {
      console.error('[SalesService] Error: userId is undefined. Check JwtStrategy matching.');
      throw new BadRequestException('User identification failed. Please re-login.');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        let subtotal = 0;
        const transactionItemsData: Prisma.TransactionItemsCreateManyTransactionInput[] = [];

        for (const item of items) {
          const priceRecord = await this.pricesService.findCurrentPrice(item.itemId);
          if (!priceRecord) {
            throw new BadRequestException(`No active price found for item ID ${item.itemId}`);
          }

          const itemSubtotal = Number(priceRecord.price) * item.quantity;
          subtotal += itemSubtotal;

          transactionItemsData.push({
            itemId: item.itemId,
            quantity: item.quantity,
            unitPrice: priceRecord.price,
            subtotal: new Prisma.Decimal(itemSubtotal),
          });
        }

        const totalAmount = subtotal + (tipAmount || 0);

        const transaction = await tx.transactions.create({
          data: {
            type: TransactionType.SALE,
            subtotal: new Prisma.Decimal(subtotal),
            tipAmount: tipAmount ? new Prisma.Decimal(tipAmount) : null,
            totalAmount: new Prisma.Decimal(totalAmount),
            paymentMethod,
            paymentDetails: paymentDetails || null,
            userId,
            items: {
              create: transactionItemsData,
            },
          },
        });

        // Create inventory movements
        for (const item of items) {
          await tx.inventoryMovements.create({
            data: {
              itemId: item.itemId,
              type: MovementType.SALE,
              quantityChange: -item.quantity,
              referenceId: transaction.id,
              referenceType: 'Transactions',
            },
          });
        }

        return transaction;
      });
    } catch (error) {
      console.error('[SalesService] Transaction failed:', error);
      throw error;
    }
  }

  async createSpin(
    userId: number,
    spinResult: string,
    rewardItemId?: number,
    tipAmount?: number,
    paymentMethod: PaymentMethod = PaymentMethod.CASH,
    destinationId?: number,
  ): Promise<Transactions> {
    // Resolve the spin price from the destination if provided, otherwise default to 30
    let SPIN_PRICE = 30;
    if (destinationId) {
      const dest = await this.prisma.stockDestination.findUnique({ where: { id: destinationId } });
      if (dest?.spinPrice) {
        SPIN_PRICE = Number(dest.spinPrice);
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const totalAmount = SPIN_PRICE + (tipAmount || 0);
      
      const transaction = await tx.transactions.create({
        data: {
          type: TransactionType.SPIN,
          subtotal: new Prisma.Decimal(SPIN_PRICE),
          tipAmount: tipAmount ? new Prisma.Decimal(tipAmount) : null,
          totalAmount: new Prisma.Decimal(totalAmount),
          paymentMethod,
          userId,
          spinResult,
        },
      });

      if (rewardItemId) {
        await tx.inventoryMovements.create({
          data: {
            itemId: rewardItemId,
            type: MovementType.SPIN_REWARD,
            quantityChange: -1,
            referenceId: transaction.id,
            referenceType: 'Transactions',
          },
        });
      }

      return transaction;
    });
  }

  async findCurrentPrice(itemId: number): Promise<any> {
    return this.pricesService.findCurrentPrice(itemId);
  }

  async findAll(userId?: number): Promise<Transactions[]> {
    return this.prisma.transactions.findMany({
      where: userId ? { userId } : {},
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: {
            item: true,
          },
        },
        user: {
          select: {
            name: true,
          },
        },
      },
    });
  }
}
