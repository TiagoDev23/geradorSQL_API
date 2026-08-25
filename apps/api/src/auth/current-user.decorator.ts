import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { AuthenticatedRequest } from './jwt-auth.guard';

/** Identificador do usuário autenticado, extraído do token. */
export const CurrentUserId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    return request.user.sub;
  },
);
