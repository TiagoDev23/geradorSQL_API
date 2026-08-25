import { Module } from '@nestjs/common';

import { EndpointsController } from './endpoints.controller';
import { EndpointsService } from './endpoints.service';
import { ProjectEndpointsController } from './project-endpoints.controller';

@Module({
  controllers: [ProjectEndpointsController, EndpointsController],
  providers: [EndpointsService],
  exports: [EndpointsService],
})
export class EndpointsModule {}
