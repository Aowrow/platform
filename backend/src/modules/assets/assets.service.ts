import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AssetsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.assets.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }
}
