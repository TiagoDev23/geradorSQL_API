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
import { CreateEndpointDto } from './dto/create-endpoint.dto';
import { EndpointsService } from './endpoints.service';

@Controller('projects/:projectId/endpoints')
export class ProjectEndpointsController {
  constructor(
    private readonly endpointsService: EndpointsService,
    private readonly ownership: OwnershipService,
  ) {}

  @Post()
  async create(
    @CurrentUserId() userId: string,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() dto: CreateEndpointDto,
  ) {
    await this.ownership.assertProject(projectId, userId);

    // A consulta referenciada é validada pelo service como pertencente
    // ao mesmo projeto, o que impede publicar consulta de outro dono.
    return this.endpointsService.create(projectId, dto);
  }

  @Get()
  async findAll(
    @CurrentUserId() userId: string,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
  ) {
    await this.ownership.assertProject(projectId, userId);

    return this.endpointsService.findAllByProject(projectId);
  }
}
