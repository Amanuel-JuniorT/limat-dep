import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClosedDatesService {
  constructor(private prisma: PrismaService) {}

  async create(userId: number, data: { date: string; destinationId: number; reason?: string }) {
    const { date, destinationId, reason } = data;
    const dateObj = new Date(date);

    const existing = await this.prisma.closedDate.findFirst({
      where: {
        destinationId,
        date: dateObj,
      },
    });

    if (existing) {
      throw new BadRequestException('This date is already marked as closed for this destination');
    }

    return this.prisma.closedDate.create({
      data: {
        destinationId,
        date: dateObj,
        reason,
        userId,
      },
      include: {
        destination: true,
        user: { select: { id: true, email: true, name: true, role: true } },
      },
    });
  }

  async findAll(destinationId?: number) {
    const where: any = {};
    if (destinationId) where.destinationId = destinationId;

    return this.prisma.closedDate.findMany({
      where,
      include: {
        destination: true,
        user: { select: { id: true, email: true, name: true, role: true } },
      },
      orderBy: { date: 'desc' },
    });
  }

  async remove(id: number) {
    const item = await this.prisma.closedDate.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Closed date record not found');
    return this.prisma.closedDate.delete({ where: { id } });
  }
}
