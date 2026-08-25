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

import { UpdateEndpointDto } from './dto/update-endpoint.dto';
import { EndpointsService } from './endpoints.service';

@Controller('endpoints')
export class EndpointsController {
  constructor(private readonly endpointsService: EndpointsService) {}

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.endpointsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateEndpointDto,
  ) {
    return this.endpointsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.endpointsService.remove(id);
  }

  /** Alterna o estado de publicação; responde 200 por não criar recurso. */
  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  publish(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.endpointsService.publish(id);
  }

  @Post(':id/unpublish')
  @HttpCode(HttpStatus.OK)
  unpublish(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.endpointsService.unpublish(id);
  }
}
