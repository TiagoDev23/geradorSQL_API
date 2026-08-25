import { Module } from '@nestjs/common';

import { DatabaseConnectionsModule } from '../database-connections/database-connections.module';
import { ConnectionQueriesController } from './connection-queries.controller';
import { SavedQueriesController } from './saved-queries.controller';
import { SavedQueriesService } from './saved-queries.service';

@Module({
  imports: [DatabaseConnectionsModule],
  controllers: [ConnectionQueriesController, SavedQueriesController],
  providers: [SavedQueriesService],
  exports: [SavedQueriesService],
})
export class SavedQueriesModule {}
