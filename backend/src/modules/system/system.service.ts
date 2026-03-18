import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SystemService {
  constructor(private readonly prisma: PrismaService) {}

  async getConfigs() {
    return this.prisma.system_configs.findMany({
      orderBy: { configKey: 'asc' }
    });
  }
}
