import { Module } from '@nestjs/common';

import { ConnectionsController } from './connections.controller';
import { DatabaseConnectionsService } from './database-connections.service';
import { ExternalDatabaseService } from './external-database.service';
import { ProjectConnectionsController } from './project-connections.controller';

@Module({
  controllers: [ProjectConnectionsController, ConnectionsController],
  providers: [DatabaseConnectionsService, ExternalDatabaseService],
  exports: [DatabaseConnectionsService, ExternalDatabaseService],
})
export class DatabaseConnectionsModule {}
