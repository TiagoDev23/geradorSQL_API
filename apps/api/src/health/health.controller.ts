import { Controller, Get } from '@nestjs/common';

import { Public } from '../auth/public.decorator';

import { PrismaService } from '../database/prisma/prisma.service';

@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  health() {
    return {
      status: 'ok',
      service: 'meu-gerador-de-api',
    };
  }

  @Get('database')
  async databaseHealth() {
    await this.prisma.$queryRaw`SELECT 1`;

    return {
      status: 'ok',
      database: 'connected',
    };
  }
}
