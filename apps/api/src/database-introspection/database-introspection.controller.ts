import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';

import { CurrentUserId } from '../auth/current-user.decorator';
import { OwnershipService } from '../common/ownership/ownership.service';
import { DatabaseIntrospectionService } from './database-introspection.service';

@Controller('connections/:id')
export class DatabaseIntrospectionController {
  constructor(
    private readonly introspectionService: DatabaseIntrospectionService,
    private readonly ownership: OwnershipService,
  ) {}

  @Get('schemas')
  async listSchemas(
    @CurrentUserId() userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    // A posse é conferida antes de abrir a conexão externa.
    await this.ownership.assertConnection(id, userId);

    return this.introspectionService.listSchemas(id);
  }

  @Get('tables')
  async listTables(
    @CurrentUserId() userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('schema') schema?: string,
  ) {
    await this.ownership.assertConnection(id, userId);

    return this.introspectionService.listTables(id, schema);
  }

  @Get('tables/:schema/:table')
  async describeTable(
    @CurrentUserId() userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('schema') schema: string,
    @Param('table') table: string,
  ) {
    await this.ownership.assertConnection(id, userId);

    return this.introspectionService.describeTable(id, schema, table);
  }
}
