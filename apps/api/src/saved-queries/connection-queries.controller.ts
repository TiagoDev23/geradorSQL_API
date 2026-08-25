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
import { CreateSavedQueryDto } from './dto/create-saved-query.dto';
import { SavedQueriesService } from './saved-queries.service';

/**
 * Consultas subordinadas a uma conexão. As demais operações usam o
 * identificador da própria consulta e ficam em SavedQueriesController.
 */
@Controller('connections/:connectionId/queries')
export class ConnectionQueriesController {
  constructor(
    private readonly savedQueriesService: SavedQueriesService,
    private readonly ownership: OwnershipService,
  ) {}

  @Post()
  async create(
    @CurrentUserId() userId: string,
    @Param('connectionId', new ParseUUIDPipe()) connectionId: string,
    @Body() dto: CreateSavedQueryDto,
  ) {
    await this.ownership.assertConnection(connectionId, userId);

    return this.savedQueriesService.create(connectionId, dto);
  }

  @Get()
  async findAll(
    @CurrentUserId() userId: string,
    @Param('connectionId', new ParseUUIDPipe()) connectionId: string,
  ) {
    await this.ownership.assertConnection(connectionId, userId);

    return this.savedQueriesService.findAllByConnection(connectionId);
  }
}
