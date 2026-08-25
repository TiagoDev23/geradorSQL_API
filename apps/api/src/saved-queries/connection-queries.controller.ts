import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';

import { CreateSavedQueryDto } from './dto/create-saved-query.dto';
import { SavedQueriesService } from './saved-queries.service';

/**
 * Consultas subordinadas a uma conexão. As demais operações usam o
 * identificador da própria consulta e ficam em SavedQueriesController.
 */
@Controller('connections/:connectionId/queries')
export class ConnectionQueriesController {
  constructor(private readonly savedQueriesService: SavedQueriesService) {}

  @Post()
  create(
    @Param('connectionId', new ParseUUIDPipe()) connectionId: string,
    @Body() dto: CreateSavedQueryDto,
  ) {
    return this.savedQueriesService.create(connectionId, dto);
  }

  @Get()
  findAll(@Param('connectionId', new ParseUUIDPipe()) connectionId: string) {
    return this.savedQueriesService.findAllByConnection(connectionId);
  }
}
