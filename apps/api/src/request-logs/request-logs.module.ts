import { Module } from '@nestjs/common';

import { ProjectLogsController } from './project-logs.controller';
import { RequestLogsService } from './request-logs.service';

@Module({
  controllers: [ProjectLogsController],
  providers: [RequestLogsService],
  exports: [RequestLogsService],
})
export class RequestLogsModule {}
