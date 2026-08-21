import { Module } from '@nestjs/common';

import { DatabaseConnectionsModule } from '../database-connections/database-connections.module';
import { DatabaseIntrospectionController } from './database-introspection.controller';
import { DatabaseIntrospectionService } from './database-introspection.service';

@Module({
  imports: [DatabaseConnectionsModule],
  controllers: [DatabaseIntrospectionController],
  providers: [DatabaseIntrospectionService],
  exports: [DatabaseIntrospectionService],
})
export class DatabaseIntrospectionModule {}
