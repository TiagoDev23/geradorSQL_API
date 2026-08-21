import { Module } from '@nestjs/common';

import { ConnectionsController } from './connections.controller';
import { DatabaseConnectionsService } from './database-connections.service';
import { ProjectConnectionsController } from './project-connections.controller';

@Module({
  controllers: [ProjectConnectionsController, ConnectionsController],
  providers: [DatabaseConnectionsService],
  exports: [DatabaseConnectionsService],
})
export class DatabaseConnectionsModule {}
