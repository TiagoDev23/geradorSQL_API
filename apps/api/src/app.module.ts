import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { OwnershipModule } from './common/ownership/ownership.module';
import { RequestLogsModule } from './request-logs/request-logs.module';
import { PrismaModule } from './database/prisma/prisma.module';
import { DatabaseConnectionsModule } from './database-connections/database-connections.module';
import { DatabaseIntrospectionModule } from './database-introspection/database-introspection.module';
import { EndpointsModule } from './endpoints/endpoints.module';
import { HealthModule } from './health/health.module';
import { OpenapiModule } from './openapi/openapi.module';
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
    AuthModule,
    OwnershipModule,
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
    OpenapiModule,
  ],

  controllers: [AppController],

  providers: [
    AppService,

    // Guard global: tudo exige JWT, salvo o que estiver marcado com
    // @Public — auth, health e o runtime.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
