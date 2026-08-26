import { Module } from '@nestjs/common';

import { OpenapiService } from './openapi.service';
import { ProjectOpenapiController } from './project-openapi.controller';

@Module({
  controllers: [ProjectOpenapiController],
  providers: [OpenapiService],
  exports: [OpenapiService],
})
export class OpenapiModule {}
