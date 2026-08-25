import { Controller, Get, Headers, Param, Query } from '@nestjs/common';

import { Public } from '../auth/public.decorator';

import { RuntimeService } from './runtime.service';

/**
 * Rota única que atende todos os endpoints publicados. Não existe uma
 * rota por endpoint: o caminho é resolvido em tempo de requisição.
 *
 * A API Key trafega em cabeçalho, nunca na query string: URLs aparecem
 * em histórico de navegador, referer e logs de servidores intermediários.
 */
// @Public dispensa o JWT do control plane: o runtime é autenticado
// pela API Key, verificada dentro do serviço.
@Public()
@Controller('runtime')
export class RuntimeController {
  constructor(private readonly runtimeService: RuntimeService) {}

  @Get(':projectSlug/:version/:endpointSlug')
  execute(
    @Param('projectSlug') projectSlug: string,
    @Param('version') version: string,
    @Param('endpointSlug') endpointSlug: string,
    @Headers('x-api-key') apiKey: string | undefined,
    @Query() query: Record<string, unknown>,
  ) {
    return this.runtimeService.execute(
      projectSlug,
      version,
      endpointSlug,
      apiKey,
      query,
    );
  }
}
