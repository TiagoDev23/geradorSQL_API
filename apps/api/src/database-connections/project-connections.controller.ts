import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';

import { CurrentUserId } from '../auth/current-user.decorator';
import { OwnershipService } from '../common/ownership/ownership.service';
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
    private readonly ownership: OwnershipService,
  ) {}

  @Post()
  async create(
    @CurrentUserId() userId: string,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() dto: CreateDatabaseConnectionDto,
  ) {
    await this.ownership.assertProject(projectId, userId);

    return this.databaseConnectionsService.create(projectId, dto);
  }

  @Get()
  async findAll(
    @CurrentUserId() userId: string,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
  ) {
    await this.ownership.assertProject(projectId, userId);

    return this.databaseConnectionsService.findAllByProject(projectId);
  }
}
