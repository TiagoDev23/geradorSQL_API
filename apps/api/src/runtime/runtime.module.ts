import { Module } from '@nestjs/common';

import { ApiKeysModule } from '../api-keys/api-keys.module';
import { DatabaseConnectionsModule } from '../database-connections/database-connections.module';
import { RequestLogsModule } from '../request-logs/request-logs.module';
import { RuntimeController } from './runtime.controller';
import { RuntimeService } from './runtime.service';

@Module({
  imports: [DatabaseConnectionsModule, ApiKeysModule, RequestLogsModule],
  controllers: [RuntimeController],
  providers: [RuntimeService],
})
export class RuntimeModule {}
