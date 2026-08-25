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
import { ExecuteSavedQueryDto } from './dto/execute-saved-query.dto';
import { UpdateSavedQueryDto } from './dto/update-saved-query.dto';
import { SavedQueriesService } from './saved-queries.service';

@Controller('queries')
export class SavedQueriesController {
  constructor(
    private readonly savedQueriesService: SavedQueriesService,
    private readonly ownership: OwnershipService,
  ) {}

  @Get(':id')
  async findOne(
    @CurrentUserId() userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.ownership.assertSavedQuery(id, userId);

    return this.savedQueriesService.findOne(id);
  }

  @Patch(':id')
  async update(
    @CurrentUserId() userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateSavedQueryDto,
  ) {
    await this.ownership.assertSavedQuery(id, userId);

    return this.savedQueriesService.update(id, dto);
  }

  @Delete(':id')
  async remove(
    @CurrentUserId() userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.ownership.assertSavedQuery(id, userId);

    return this.savedQueriesService.remove(id);
  }

  /**
   * Execução de teste. Não altera estado, por isso responde 200 em vez
   * do 201 padrão do método POST no NestJS.
   */
  @Post(':id/execute')
  @HttpCode(HttpStatus.OK)
  async execute(
    @CurrentUserId() userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ExecuteSavedQueryDto,
  ) {
    await this.ownership.assertSavedQuery(id, userId);

    return this.savedQueriesService.execute(id, dto);
  }
}
