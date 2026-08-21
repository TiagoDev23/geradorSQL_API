import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';

import { DatabaseIntrospectionService } from './database-introspection.service';

@Controller('connections/:id')
export class DatabaseIntrospectionController {
  constructor(
    private readonly introspectionService: DatabaseIntrospectionService,
  ) {}

  @Get('schemas')
  listSchemas(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.introspectionService.listSchemas(id);
  }

  @Get('tables')
  listTables(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('schema') schema?: string,
  ) {
    return this.introspectionService.listTables(id, schema);
  }

  @Get('tables/:schema/:table')
  describeTable(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('schema') schema: string,
    @Param('table') table: string,
  ) {
    return this.introspectionService.describeTable(id, schema, table);
  }
}
