import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';

import { CreateEndpointDto } from './dto/create-endpoint.dto';
import { EndpointsService } from './endpoints.service';

@Controller('projects/:projectId/endpoints')
export class ProjectEndpointsController {
  constructor(private readonly endpointsService: EndpointsService) {}

  @Post()
  create(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() dto: CreateEndpointDto,
  ) {
    return this.endpointsService.create(projectId, dto);
  }

  @Get()
  findAll(@Param('projectId', new ParseUUIDPipe()) projectId: string) {
    return this.endpointsService.findAllByProject(projectId);
  }
}
