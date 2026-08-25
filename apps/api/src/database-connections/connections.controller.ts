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

import { CurrentUserId } from '../auth/current-user.decorator';
import { OwnershipService } from '../common/ownership/ownership.service';
import { DatabaseConnectionsService } from './database-connections.service';
import { UpdateDatabaseConnectionDto } from './dto/update-database-connection.dto';

@Controller('connections')
export class ConnectionsController {
  constructor(
    private readonly databaseConnectionsService: DatabaseConnectionsService,
    private readonly ownership: OwnershipService,
  ) {}

  @Get(':id')
  async findOne(
    @CurrentUserId() userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.ownership.assertConnection(id, userId);

    return this.databaseConnectionsService.findOne(id);
  }

  @Patch(':id')
  async update(
    @CurrentUserId() userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateDatabaseConnectionDto,
  ) {
    await this.ownership.assertConnection(id, userId);

    return this.databaseConnectionsService.update(id, dto);
  }

  @Delete(':id')
  async remove(
    @CurrentUserId() userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.ownership.assertConnection(id, userId);

    return this.databaseConnectionsService.remove(id);
  }

  /**
   * Verificação de conectividade. Não altera estado, por isso responde
   * 200 em vez do 201 padrão do método POST no NestJS.
   *
   * A posse é conferida antes de abrir qualquer conexão externa.
   */
  @Post(':id/test')
  @HttpCode(HttpStatus.OK)
  async test(
    @CurrentUserId() userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.ownership.assertConnection(id, userId);

    return this.databaseConnectionsService.test(id);
  }
}
