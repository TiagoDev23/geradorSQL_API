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

import { CurrentUserId } from '../auth/current-user.decorator';
import { OwnershipService } from '../common/ownership/ownership.service';
import { ApiKeysService } from './api-keys.service';

/**
 * Gerenciamento das chaves, protegido por JWT. O uso da chave no
 * runtime continua sem JWT.
 */
@Controller('api-keys')
export class ApiKeysController {
  constructor(
    private readonly apiKeysService: ApiKeysService,
    private readonly ownership: OwnershipService,
  ) {}

  @Get(':id')
  async findOne(
    @CurrentUserId() userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.ownership.assertApiKey(id, userId);

    return this.apiKeysService.findOne(id);
  }

  @Post(':id/revoke')
  @HttpCode(HttpStatus.OK)
  async revoke(
    @CurrentUserId() userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.ownership.assertApiKey(id, userId);

    return this.apiKeysService.revoke(id);
  }

  @Delete(':id')
  async remove(
    @CurrentUserId() userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.ownership.assertApiKey(id, userId);

    return this.apiKeysService.remove(id);
  }
}
