import {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { PrismaService } from '../database/prisma/prisma.service';
import { generateApiKey, hashApiKey } from './api-key-token';
import { ApiKeysService } from './api-keys.service';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const OUTRO_PROJETO = '99999999-9999-4999-8999-999999999999';
const KEY_ID = '55555555-5555-4555-8555-555555555555';

function buildPrismaMock() {
  return {
    project: { findUnique: jest.fn() },
    apiKey: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
}

interface PrismaCallArgs {
  data: Record<string, unknown>;
  select: Record<string, unknown>;
  where: Record<string, unknown>;
}

function firstCallArgs(mock: jest.Mock): PrismaCallArgs {
  const calls = mock.mock.calls as unknown as PrismaCallArgs[][];

  return calls[0][0];
}

describe('api-key-token', () => {
  it('gera token com prefixo identificável e alta entropia', () => {
    const gerada = generateApiKey();

    expect(gerada.token.startsWith('gapi_')).toBe(true);
    expect(gerada.keyPrefix).toBe(gerada.token.slice(0, 13));
    expect(gerada.token.length).toBeGreaterThan(40);
  });

  it('gera tokens distintos a cada chamada', () => {
    expect(generateApiKey().token).not.toBe(generateApiKey().token);
  });

  it('o hash não permite recuperar o token', () => {
    const gerada = generateApiKey();

    expect(gerada.keyHash).not.toContain(gerada.token);
    expect(gerada.keyHash).toHaveLength(64);
  });

  it('o mesmo token produz sempre o mesmo hash', () => {
    const gerada = generateApiKey();

    expect(hashApiKey(gerada.token)).toBe(gerada.keyHash);
  });
});

describe('ApiKeysService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let service: ApiKeysService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    service = new ApiKeysService(prisma as unknown as PrismaService);

    prisma.project.findUnique.mockResolvedValue({ id: PROJECT_ID });
    prisma.apiKey.create.mockResolvedValue({
      id: KEY_ID,
      name: 'Chave',
      keyPrefix: 'gapi_abcd1234',
      projectId: PROJECT_ID,
      expiresAt: null,
      revokedAt: null,
      lastUsedAt: null,
      createdAt: new Date(),
    });
  });

  describe('create', () => {
    it('persiste apenas o hash, nunca o token', async () => {
      const resultado = await service.create(PROJECT_ID, { name: 'Chave' });

      const { data } = firstCallArgs(prisma.apiKey.create);

      expect(data.keyHash).toBeDefined();
      expect(data).not.toHaveProperty('token');
      expect(JSON.stringify(data)).not.toContain(resultado.token);
    });

    it('devolve o token completo somente na criação', async () => {
      const resultado = await service.create(PROJECT_ID, { name: 'Chave' });

      expect(resultado.token.startsWith('gapi_')).toBe(true);

      // As demais leituras não selecionam o hash nem o token.
      const { select } = firstCallArgs(prisma.apiKey.create);

      expect(select).not.toHaveProperty('keyHash');
    });

    it('rejeita projeto inexistente', async () => {
      prisma.project.findUnique.mockResolvedValue(null);

      await expect(
        service.create(PROJECT_ID, { name: 'Chave' }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prisma.apiKey.create).not.toHaveBeenCalled();
    });
  });

  describe('findAllByProject', () => {
    it('não seleciona o hash na listagem', async () => {
      prisma.apiKey.findMany.mockResolvedValue([]);

      await service.findAllByProject(PROJECT_ID);

      const { select } = firstCallArgs(prisma.apiKey.findMany);

      expect(select).not.toHaveProperty('keyHash');
      expect(select.keyPrefix).toBe(true);
    });
  });

  describe('revoke', () => {
    it('marca a data de revogação', async () => {
      prisma.apiKey.findUnique.mockResolvedValue({
        id: KEY_ID,
        revokedAt: null,
      });
      prisma.apiKey.update.mockResolvedValue({ id: KEY_ID });

      await service.revoke(KEY_ID);

      const { data } = firstCallArgs(prisma.apiKey.update);

      expect(data.revokedAt).toBeInstanceOf(Date);
    });

    it('não altera chave já revogada', async () => {
      prisma.apiKey.findUnique.mockResolvedValue({
        id: KEY_ID,
        revokedAt: new Date(),
      });

      await service.revoke(KEY_ID);

      expect(prisma.apiKey.update).not.toHaveBeenCalled();
    });
  });

  describe('authenticate', () => {
    function mockKey(overrides: Record<string, unknown> = {}) {
      prisma.apiKey.findUnique.mockResolvedValue({
        id: KEY_ID,
        projectId: PROJECT_ID,
        expiresAt: null,
        revokedAt: null,
        ...overrides,
      });
      prisma.apiKey.update.mockResolvedValue({});
    }

    it('aceita chave válida do próprio projeto', async () => {
      mockKey();

      await expect(
        service.authenticate('gapi_valida', PROJECT_ID),
      ).resolves.toEqual({ id: KEY_ID });
    });

    it('busca pelo hash, nunca pelo valor apresentado', async () => {
      mockKey();

      await service.authenticate('gapi_valida', PROJECT_ID);

      const { where } = firstCallArgs(prisma.apiKey.findUnique);

      expect(where.keyHash).toBe(hashApiKey('gapi_valida'));
      expect(JSON.stringify(where)).not.toContain('gapi_valida');
    });

    it('registra o último uso', async () => {
      mockKey();

      await service.authenticate('gapi_valida', PROJECT_ID);

      expect(prisma.apiKey.update).toHaveBeenCalled();
    });

    it.each([undefined, '', '   '])(
      'rejeita ausência de chave (%s)',
      async (valor) => {
        await expect(
          service.authenticate(valor, PROJECT_ID),
        ).rejects.toBeInstanceOf(UnauthorizedException);

        expect(prisma.apiKey.findUnique).not.toHaveBeenCalled();
      },
    );

    it('rejeita chave inexistente', async () => {
      prisma.apiKey.findUnique.mockResolvedValue(null);

      await expect(
        service.authenticate('gapi_inexistente', PROJECT_ID),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejeita chave revogada', async () => {
      mockKey({ revokedAt: new Date() });

      await expect(
        service.authenticate('gapi_valida', PROJECT_ID),
      ).rejects.toThrow(/revogada/);
    });

    it('rejeita chave expirada', async () => {
      mockKey({ expiresAt: new Date(Date.now() - 1000) });

      await expect(
        service.authenticate('gapi_valida', PROJECT_ID),
      ).rejects.toThrow(/expirada/);
    });

    it('aceita chave com expiração futura', async () => {
      mockKey({ expiresAt: new Date(Date.now() + 60_000) });

      await expect(
        service.authenticate('gapi_valida', PROJECT_ID),
      ).resolves.toEqual({ id: KEY_ID });
    });

    it('recusa chave válida de outro projeto', async () => {
      mockKey({ projectId: OUTRO_PROJETO });

      await expect(
        service.authenticate('gapi_valida', PROJECT_ID),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('nunca inclui a chave apresentada na mensagem de erro', async () => {
      prisma.apiKey.findUnique.mockResolvedValue(null);

      await expect(
        service.authenticate('gapi_segredo_do_cliente', PROJECT_ID),
      ).rejects.toThrow();

      const erro: unknown = await service
        .authenticate('gapi_segredo_do_cliente', PROJECT_ID)
        .catch((e: unknown) => e);

      expect((erro as Error).message).not.toContain('gapi_segredo_do_cliente');
    });
  });
});
