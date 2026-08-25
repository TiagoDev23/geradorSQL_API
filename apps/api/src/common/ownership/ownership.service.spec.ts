import { NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../database/prisma/prisma.service';
import { OwnershipService } from './ownership.service';

const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const RECURSO = '11111111-1111-4111-8111-111111111111';

function buildPrismaMock() {
  return {
    project: { findFirst: jest.fn() },
    databaseConnection: { findFirst: jest.fn() },
    savedQuery: { findFirst: jest.fn() },
    endpoint: { findFirst: jest.fn() },
    apiKey: { findFirst: jest.fn() },
  };
}

interface WhereArgs {
  where: Record<string, unknown>;
}

function firstWhere(mock: jest.Mock): Record<string, unknown> {
  const calls = mock.mock.calls as unknown as WhereArgs[][];

  return calls[0][0].where;
}

describe('OwnershipService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let service: OwnershipService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    service = new OwnershipService(prisma as unknown as PrismaService);
  });

  /**
   * Cada recurso é verificado do mesmo jeito: o dono entra na condição
   * da consulta, e a ausência de resultado vira 404.
   */
  const casos = [
    {
      nome: 'projeto',
      mock: () => prisma.project.findFirst,
      chamar: () => service.assertProject(RECURSO, USER_A),
      whereEsperado: { id: RECURSO, ownerId: USER_A },
    },
    {
      nome: 'conexão',
      mock: () => prisma.databaseConnection.findFirst,
      chamar: () => service.assertConnection(RECURSO, USER_A),
      whereEsperado: { id: RECURSO, project: { ownerId: USER_A } },
    },
    {
      nome: 'consulta salva',
      mock: () => prisma.savedQuery.findFirst,
      chamar: () => service.assertSavedQuery(RECURSO, USER_A),
      whereEsperado: {
        id: RECURSO,
        connection: { project: { ownerId: USER_A } },
      },
    },
    {
      nome: 'endpoint',
      mock: () => prisma.endpoint.findFirst,
      chamar: () => service.assertEndpoint(RECURSO, USER_A),
      whereEsperado: { id: RECURSO, project: { ownerId: USER_A } },
    },
    {
      nome: 'API Key',
      mock: () => prisma.apiKey.findFirst,
      chamar: () => service.assertApiKey(RECURSO, USER_A),
      whereEsperado: { id: RECURSO, project: { ownerId: USER_A } },
    },
  ];

  for (const caso of casos) {
    describe(caso.nome, () => {
      it('permite acesso do dono', async () => {
        caso.mock().mockResolvedValue({ id: RECURSO });

        await expect(caso.chamar()).resolves.toBeUndefined();
      });

      it('inclui o dono na condição da consulta', async () => {
        caso.mock().mockResolvedValue({ id: RECURSO });

        await caso.chamar();

        expect(firstWhere(caso.mock())).toEqual(caso.whereEsperado);
      });

      it('recusa quando o recurso é de outro usuário', async () => {
        // O recurso existe, mas a consulta filtrada pelo dono não o
        // encontra.
        caso.mock().mockResolvedValue(null);

        await expect(caso.chamar()).rejects.toBeInstanceOf(NotFoundException);
      });

      it('usa 404, não 403, para não revelar a existência do recurso', async () => {
        caso.mock().mockResolvedValue(null);

        const erro: unknown = await caso.chamar().catch((e: unknown) => e);

        expect((erro as NotFoundException).getStatus()).toBe(404);
      });
    });
  }

  it('separa os usuários pela condição enviada ao banco', async () => {
    prisma.project.findFirst.mockResolvedValue(null);

    await expect(service.assertProject(RECURSO, USER_B)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(firstWhere(prisma.project.findFirst)).toEqual({
      id: RECURSO,
      ownerId: USER_B,
    });
  });
});
