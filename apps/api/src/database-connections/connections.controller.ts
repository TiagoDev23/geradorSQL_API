import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';

import { DatabaseConnectionsService } from './database-connections.service';
import { UpdateDatabaseConnectionDto } from './dto/update-database-connection.dto';

@Controller('connections')
export class ConnectionsController {
  constructor(
    private readonly databaseConnectionsService: DatabaseConnectionsService,
  ) {}

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.databaseConnectionsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateDatabaseConnectionDto,
  ) {
    return this.databaseConnectionsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.databaseConnectionsService.remove(id);
  }

  /**
   * Verificação de conectividade. Não altera estado, por isso responde
   * 200 em vez do 201 padrão do método POST no NestJS.
   */
  @Post(':id/test')
  @HttpCode(HttpStatus.OK)
  test(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.databaseConnectionsService.test(id);
  }
}
