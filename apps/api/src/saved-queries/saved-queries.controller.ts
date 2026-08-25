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

import { ExecuteSavedQueryDto } from './dto/execute-saved-query.dto';
import { UpdateSavedQueryDto } from './dto/update-saved-query.dto';
import { SavedQueriesService } from './saved-queries.service';

@Controller('queries')
export class SavedQueriesController {
  constructor(private readonly savedQueriesService: SavedQueriesService) {}

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.savedQueriesService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateSavedQueryDto,
  ) {
    return this.savedQueriesService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.savedQueriesService.remove(id);
  }

  /**
   * Execução de teste. Não altera estado, por isso responde 200 em vez
   * do 201 padrão do método POST no NestJS.
   */
  @Post(':id/execute')
  @HttpCode(HttpStatus.OK)
  execute(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ExecuteSavedQueryDto,
  ) {
    return this.savedQueriesService.execute(id, dto);
  }
}
