import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';

import { CurrentUserId } from '../auth/current-user.decorator';
import { OwnershipService } from '../common/ownership/ownership.service';
import { OpenapiService } from './openapi.service';

/**
 * Rota administrativa: exige JWT e posse do projeto, como o restante do
 * control plane. A especificação descreve o runtime, que é autenticado
 * por API Key.
 */
@Controller('projects/:projectId')
export class ProjectOpenapiController {
  constructor(
    private readonly openapiService: OpenapiService,
    private readonly ownership: OwnershipService,
  ) {}

  @Get('openapi')
  async generate(
    @CurrentUserId() userId: string,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
  ) {
    await this.ownership.assertProject(projectId, userId);

    return this.openapiService.generateForProject(projectId);
  }
}
