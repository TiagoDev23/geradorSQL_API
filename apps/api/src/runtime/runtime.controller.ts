import { Controller, Get, Param, Query } from '@nestjs/common';

import { RuntimeService } from './runtime.service';

/**
 * Rota única que atende todos os endpoints publicados. Não existe uma
 * rota por endpoint: o caminho é resolvido em tempo de requisição.
 */
@Controller('runtime')
export class RuntimeController {
  constructor(private readonly runtimeService: RuntimeService) {}

  @Get(':projectSlug/:version/:endpointSlug')
  execute(
    @Param('projectSlug') projectSlug: string,
    @Param('version') version: string,
    @Param('endpointSlug') endpointSlug: string,
    @Query() query: Record<string, unknown>,
  ) {
    return this.runtimeService.execute(
      projectSlug,
      version,
      endpointSlug,
      query,
    );
  }
}
