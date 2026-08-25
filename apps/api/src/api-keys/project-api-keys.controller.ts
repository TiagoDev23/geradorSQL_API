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
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

@Controller('projects/:projectId/api-keys')
export class ProjectApiKeysController {
  constructor(
    private readonly apiKeysService: ApiKeysService,
    private readonly ownership: OwnershipService,
  ) {}

  @Post()
  async create(
    @CurrentUserId() userId: string,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() dto: CreateApiKeyDto,
  ) {
    await this.ownership.assertProject(projectId, userId);

    return this.apiKeysService.create(projectId, dto);
  }

  @Get()
  async findAll(
    @CurrentUserId() userId: string,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
  ) {
    await this.ownership.assertProject(projectId, userId);

    return this.apiKeysService.findAllByProject(projectId);
  }
}
