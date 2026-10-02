import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private pool: Pool;

  constructor() {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
    const adapter = new PrismaPg(pool);
    super({ adapter });
    this.pool = pool;
  }

  async onModuleInit() {
    await this.$connect();
    await this.seedDefaults();
  }

  private async seedDefaults() {
    try {
      const userCount = await this.user.count();
      if (userCount === 0) {
        const hashedPassword = await bcrypt.hash('password', 10);
        await this.user.create({
          data: {
            name: 'System Admin',
            phone: '0900000000',
            password: hashedPassword,
            role: 'ADMIN',
            status: 'APPROVED',
          },
        });
        console.log('Seeded default admin user: 0900000000 / password');
      }

      const destCount = await this.stockDestination.count();
      if (destCount === 0) {
        await this.stockDestination.createMany({
          data: [
            { name: 'Main Shop', type: 'SHOP', isActive: true, notes: 'Default Permanent Shop' },
            { name: 'Event Table A', type: 'EVENT_WINDOW', isActive: true, notes: 'Default Event Window' },
          ],
        });
        console.log('Seeded default destinations (Main Shop & Event Table A)');
      }
    } catch (err) {
      console.error('Error seeding defaults:', err);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }
}
