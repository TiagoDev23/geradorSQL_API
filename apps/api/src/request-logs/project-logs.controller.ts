import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';

import { CurrentUserId } from '../auth/current-user.decorator';
import { OwnershipService } from '../common/ownership/ownership.service';
import { RequestLogsService } from './request-logs.service';

@Controller('projects/:projectId')
export class ProjectLogsController {
  constructor(
    private readonly requestLogsService: RequestLogsService,
    private readonly ownership: OwnershipService,
  ) {}

  @Get('logs')
  async findLogs(
    @CurrentUserId() userId: string,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Query('take', new DefaultValuePipe(50), ParseIntPipe) take: number,
    @Query('skip', new DefaultValuePipe(0), ParseIntPipe) skip: number,
  ) {
    await this.ownership.assertProject(projectId, userId);

    return this.requestLogsService.findByProject(projectId, take, skip);
  }

  @Get('metrics')
  async metrics(
    @CurrentUserId() userId: string,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
  ) {
    await this.ownership.assertProject(projectId, userId);

    return this.requestLogsService.metricsByProject(projectId);
  }
}
