import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';

import { DatabaseConnectionsService } from './database-connections.service';
import { CreateDatabaseConnectionDto } from './dto/create-database-connection.dto';

/**
 * Rotas de conexões subordinadas a um projeto. A criação e a listagem
 * dependem do projeto; as demais operações usam o identificador da
 * própria conexão e ficam em ConnectionsController.
 */
@Controller('projects/:projectId/connections')
export class ProjectConnectionsController {
  constructor(
    private readonly databaseConnectionsService: DatabaseConnectionsService,
  ) {}

  @Post()
  create(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() dto: CreateDatabaseConnectionDto,
  ) {
    return this.databaseConnectionsService.create(projectId, dto);
  }

  @Get()
  findAll(@Param('projectId', new ParseUUIDPipe()) projectId: string) {
    return this.databaseConnectionsService.findAllByProject(projectId);
  }
}
