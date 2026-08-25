import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';

import { RequestLogsService } from './request-logs.service';

@Controller('projects/:projectId')
export class ProjectLogsController {
  constructor(private readonly requestLogsService: RequestLogsService) {}

  @Get('logs')
  findLogs(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Query('take', new DefaultValuePipe(50), ParseIntPipe) take: number,
    @Query('skip', new DefaultValuePipe(0), ParseIntPipe) skip: number,
  ) {
    return this.requestLogsService.findByProject(projectId, take, skip);
  }

  @Get('metrics')
  metrics(@Param('projectId', new ParseUUIDPipe()) projectId: string) {
    return this.requestLogsService.metricsByProject(projectId);
  }
}
