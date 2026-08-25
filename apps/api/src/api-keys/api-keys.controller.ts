import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';

import { ApiKeysService } from './api-keys.service';

@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.apiKeysService.findOne(id);
  }

  @Post(':id/revoke')
  @HttpCode(HttpStatus.OK)
  revoke(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.apiKeysService.revoke(id);
  }

  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.apiKeysService.remove(id);
  }
}
