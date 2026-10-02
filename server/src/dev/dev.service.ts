import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role, UserStatus, DestinationType, PriceType, MovementType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class DevService {
  constructor(private readonly prisma: PrismaService) {}

  async seedDemoData(): Promise<{ message: string }> {
    // 1. Create Default Users (Password: 123456)
    const passwordHash = await bcrypt.hash('123456', 10);

    await this.prisma.user.upsert({
      where: { phone: '0911000000' },
      update: { role: Role.ADMIN, status: UserStatus.APPROVED },
      create: {
        phone: '0911000000',
        email: 'admin@limat.com',
        name: 'Admin User',
        password: passwordHash,
        role: Role.ADMIN,
        status: UserStatus.APPROVED,
      },
    });

    await this.prisma.user.upsert({
      where: { phone: '0922000000' },
      update: { role: Role.STOCK, status: UserStatus.APPROVED },
      create: {
        phone: '0922000000',
        email: 'stock@limat.com',
        name: 'Stock Manager',
        password: passwordHash,
        role: Role.STOCK,
        status: UserStatus.APPROVED,
      },
    });

    await this.prisma.user.upsert({
      where: { phone: '0933000000' },
      update: { role: Role.SELLER, status: UserStatus.APPROVED },
      create: {
        phone: '0933000000',
        email: 'seller@limat.com',
        name: 'Shop Seller',
        password: passwordHash,
        role: Role.SELLER,
        status: UserStatus.APPROVED,
      },
    });

    // 2. Create Stock Destinations
    let shopDest = await this.prisma.stockDestination.findFirst({
      where: { type: DestinationType.SHOP },
    });
    if (!shopDest) {
      shopDest = await this.prisma.stockDestination.create({
        data: {
          name: 'Main Shop',
          type: DestinationType.SHOP,
          notes: 'Main permanent retail shop',
        },
      });
    }

    let eventDest = await this.prisma.stockDestination.findFirst({
      where: { type: DestinationType.EVENT_WINDOW },
    });
    if (!eventDest) {
      eventDest = await this.prisma.stockDestination.create({
        data: {
          name: 'Event Stand 1',
          type: DestinationType.EVENT_WINDOW,
          notes: 'Temporary event booth/table',
        },
      });
    }

    // 3. Create Sample Items with Dual Prices & Initial Warehouse Stock
    const sampleItems = [
      { name: 'Soft Drink (Coca-Cola)', sku: 'ITEM-COKE', costPrice: 25, sellingPrice: 40, initialStock: 500 },
      { name: 'Water (500ml)', sku: 'ITEM-WATER', costPrice: 10, sellingPrice: 20, initialStock: 1000 },
      { name: 'T-Shirt (Limat Edition)', sku: 'ITEM-TSHIRT', costPrice: 200, sellingPrice: 450, initialStock: 100 },
      { name: 'Cap (Branded)', sku: 'ITEM-CAP', costPrice: 80, sellingPrice: 200, initialStock: 150 },
    ];

    for (const itemData of sampleItems) {
      let dbItem = await this.prisma.items.findUnique({ where: { sku: itemData.sku } });
      if (!dbItem) {
        dbItem = await this.prisma.items.create({
          data: {
            name: itemData.name,
            sku: itemData.sku,
          },
        });

        // Add prices
        await this.prisma.itemPrices.createMany({
          data: [
            { itemId: dbItem.id, price: itemData.sellingPrice, priceType: PriceType.SELLING },
            { itemId: dbItem.id, price: itemData.costPrice, priceType: PriceType.COST },
          ],
        });

        // Add initial warehouse stock
        await this.prisma.inventoryMovements.create({
          data: {
            itemId: dbItem.id,
            type: MovementType.PURCHASE,
            quantityChange: itemData.initialStock,
            destinationId: null, // warehouse
          },
        });
      }
    }

    return { message: 'Demo data seeded successfully (Admin: 0911000000, Stock: 0922000000, Seller: 0933000000 | Pass: 123456)' };
  }

  async resetAllInventoryStock(): Promise<{ message: string; count: number }> {
    const items = await this.prisma.items.findMany({
      where: { isActive: true },
    });

    let resetCount = 0;

    for (const item of items) {
      const stockAgg = await this.prisma.inventoryMovements.aggregate({
        where: { itemId: item.id },
        _sum: { quantityChange: true },
      });
      
      const currentStock = stockAgg._sum.quantityChange || 0;
      
      if (currentStock !== 0) {
        await this.prisma.inventoryMovements.create({
          data: {
            itemId: item.id,
            type: MovementType.ADJUSTMENT,
            quantityChange: -currentStock,
          },
        });
        resetCount++;
      }
    }

    return { 
      message: `Successfully reset stock to 0 for ${resetCount} items.`, 
      count: resetCount 
    };
  }
}