import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DestinationType } from '@prisma/client';

@Injectable()
export class DestinationsService {
  constructor(private prisma: PrismaService) {}

  async create(data: { name: string; type: DestinationType; notes?: string }) {
    return this.prisma.stockDestination.create({
      data,
    });
  }

  async findAll() {
    return this.prisma.stockDestination.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findActive() {
    return this.prisma.stockDestination.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async update(id: number, data: { name?: string; notes?: string; isActive?: boolean }) {
    const dest = await this.prisma.stockDestination.findUnique({ where: { id } });
    if (!dest) throw new NotFoundException('Destination not found');
    return this.prisma.stockDestination.update({
      where: { id },
      data,
    });
  }
}
