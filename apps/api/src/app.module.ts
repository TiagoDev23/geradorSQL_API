import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { RequestLogsModule } from './request-logs/request-logs.module';
import { PrismaModule } from './database/prisma/prisma.module';
import { DatabaseConnectionsModule } from './database-connections/database-connections.module';
import { DatabaseIntrospectionModule } from './database-introspection/database-introspection.module';
import { EndpointsModule } from './endpoints/endpoints.module';
import { HealthModule } from './health/health.module';
import { ProjectsModule } from './projects/projects.module';
import { RuntimeModule } from './runtime/runtime.module';
import { SavedQueriesModule } from './saved-queries/saved-queries.module';
import { CryptoModule } from './common/crypto/crypto.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    PrismaModule,
    HealthModule,
    ProjectsModule,
    CryptoModule,
    DatabaseConnectionsModule,
    DatabaseIntrospectionModule,
    SavedQueriesModule,
    EndpointsModule,
    RuntimeModule,
    ApiKeysModule,
    RequestLogsModule,
  ],

  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
