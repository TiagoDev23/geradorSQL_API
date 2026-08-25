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
import { UpdateEndpointDto } from './dto/update-endpoint.dto';
import { EndpointsService } from './endpoints.service';

@Controller('endpoints')
export class EndpointsController {
  constructor(
    private readonly endpointsService: EndpointsService,
    private readonly ownership: OwnershipService,
  ) {}

  @Get(':id')
  async findOne(
    @CurrentUserId() userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.ownership.assertEndpoint(id, userId);

    return this.endpointsService.findOne(id);
  }

  @Patch(':id')
  async update(
    @CurrentUserId() userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateEndpointDto,
  ) {
    await this.ownership.assertEndpoint(id, userId);

    return this.endpointsService.update(id, dto);
  }

  @Delete(':id')
  async remove(
    @CurrentUserId() userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.ownership.assertEndpoint(id, userId);

    return this.endpointsService.remove(id);
  }

  /** Alterna o estado de publicação; responde 200 por não criar recurso. */
  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  async publish(
    @CurrentUserId() userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.ownership.assertEndpoint(id, userId);

    return this.endpointsService.publish(id);
  }

  @Post(':id/unpublish')
  @HttpCode(HttpStatus.OK)
  async unpublish(
    @CurrentUserId() userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.ownership.assertEndpoint(id, userId);

    return this.endpointsService.unpublish(id);
  }
}
