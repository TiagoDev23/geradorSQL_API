import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

import { AuthenticatedRequest, JwtAuthGuard } from './jwt-auth.guard';

const USER_ID = '11111111-1111-4111-8111-111111111111';

function buildContext(headers: Record<string, string> = {}) {
  const request = { headers } as unknown as AuthenticatedRequest;

  return {
    request,
    context: {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => undefined,
      getClass: () => undefined,
    } as unknown as ExecutionContext,
  };
}

describe('JwtAuthGuard', () => {
  let jwt: { verifyAsync: jest.Mock };
  let reflector: { getAllAndOverride: jest.Mock };
  let guard: JwtAuthGuard;

  beforeEach(() => {
    jwt = { verifyAsync: jest.fn().mockResolvedValue({ sub: USER_ID }) };
    reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };

    guard = new JwtAuthGuard(
      jwt as unknown as JwtService,
      reflector as unknown as Reflector,
    );
  });

  it('libera rota marcada como pública sem verificar token', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);

    const { context } = buildContext();

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(jwt.verifyAsync).not.toHaveBeenCalled();
  });

  it('aceita token válido e disponibiliza o usuário na requisição', async () => {
    const { context, request } = buildContext({
      authorization: 'Bearer token-valido',
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({ sub: USER_ID });
  });

  it('aceita o esquema Bearer sem diferenciar maiúsculas', async () => {
    const { context } = buildContext({ authorization: 'bearer token-valido' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('rejeita requisição sem cabeçalho de autorização', async () => {
    const { context } = buildContext();

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejeita esquema diferente de Bearer', async () => {
    const { context } = buildContext({ authorization: 'Basic abc123' });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejeita token inválido sem detalhar o motivo', async () => {
    jwt.verifyAsync.mockRejectedValue(new Error('jwt expired'));

    const { context } = buildContext({ authorization: 'Bearer token-ruim' });

    const erro: unknown = await guard
      .canActivate(context)
      .catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(UnauthorizedException);
    expect((erro as Error).message).not.toContain('expired');
  });

  it('não aceita token vindo fora do cabeçalho', async () => {
    // Um token na query string não deve autenticar: URLs vazam em
    // histórico, referer e logs intermediários.
    const { context } = buildContext();

    const requisicao = context
      .switchToHttp()
      .getRequest<Record<string, unknown>>();

    requisicao.query = { token: 'token-valido' };

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
