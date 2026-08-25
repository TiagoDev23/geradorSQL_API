import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

import { IS_PUBLIC_KEY } from './public.decorator';

/** Conteúdo mínimo do token: apenas o que a aplicação precisa. */
export interface JwtPayload {
  sub: string;
}

export type AuthenticatedRequest = Request & { user: JwtPayload };

/**
 * Guard global do control plane. Rotas marcadas com @Public ficam de
 * fora — entre elas o runtime, que é autenticado por API Key e não por
 * JWT.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException('Token de acesso não informado.');
    }

    try {
      request.user = await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch {
      // O motivo — expirado, assinatura inválida, malformado — não é
      // detalhado ao cliente.
      throw new UnauthorizedException('Token de acesso inválido.');
    }

    return true;
  }
}

/** O token vem apenas do cabeçalho; nunca da URL ou da query string. */
function extractBearerToken(header: string | undefined): string | undefined {
  if (!header) {
    return undefined;
  }

  const [scheme, token] = header.split(' ');

  return scheme?.toLowerCase() === 'bearer' && token ? token : undefined;
}
