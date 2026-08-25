import { Module } from '@nestjs/common';

import { DatabaseConnectionsModule } from '../database-connections/database-connections.module';
import { RuntimeController } from './runtime.controller';
import { RuntimeService } from './runtime.service';

@Module({
  imports: [DatabaseConnectionsModule],
  controllers: [RuntimeController],
  providers: [RuntimeService],
})
export class RuntimeModule {}
