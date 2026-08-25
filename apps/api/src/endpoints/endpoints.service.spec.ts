import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../database/prisma/prisma.service';
import { EndpointsService } from './endpoints.service';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const OUTRO_PROJETO = '99999999-9999-4999-8999-999999999999';
const QUERY_ID = '33333333-3333-4333-8333-333333333333';
const ENDPOINT_ID = '44444444-4444-4444-8444-444444444444';

const SQL_VALIDO =
  'SELECT * FROM meteorologia.observacoes WHERE estacao_id = $1';

function buildPrismaMock() {
  return {
    project: { findUnique: jest.fn() },
    savedQuery: { findUnique: jest.fn() },
    endpoint: {
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

/** Registro devolvido pelo Prisma no formato do select do service. */
function endpointRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: ENDPOINT_ID,
    name: 'Observações recentes',
    description: null,
    slug: 'observacoes-recentes',
    version: 'v1',
    isPublished: false,
    publishedAt: null,
    maxRows: 1000,
    projectId: PROJECT_ID,
    savedQueryId: QUERY_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
    project: { slug: 'clima-demo' },
    savedQuery: {
      id: QUERY_ID,
      name: 'Observações por estação',
      description: null,
      connectionId: 'conexao',
      parameters: [],
    },
    ...overrides,
  };
}

describe('EndpointsService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let service: EndpointsService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    service = new EndpointsService(prisma as unknown as PrismaService);

    prisma.project.findUnique.mockResolvedValue({ id: PROJECT_ID });

    prisma.savedQuery.findUnique.mockResolvedValue({
      sql: SQL_VALIDO,
      connection: { projectId: PROJECT_ID },
    });

    prisma.endpoint.findUnique.mockResolvedValue(null);
    prisma.endpoint.create.mockResolvedValue(endpointRecord());
  });

  describe('create', () => {
    it('cria endpoint referenciando a consulta, sem copiar o SQL', async () => {
      await service.create(PROJECT_ID, {
        name: 'Observações recentes',
        savedQueryId: QUERY_ID,
      });

      const { data, select } = firstCallArgs(prisma.endpoint.create);

      expect(data.savedQueryId).toBe(QUERY_ID);
      expect(data).not.toHaveProperty('sql');
      expect(JSON.stringify(data)).not.toContain('SELECT');
      expect(select).not.toHaveProperty('sql');
    });

    it('deriva o slug do nome quando não informado', async () => {
      await service.create(PROJECT_ID, {
        name: 'Observações Recentes',
        savedQueryId: QUERY_ID,
      });

      const { data } = firstCallArgs(prisma.endpoint.create);

      expect(data.slug).toBe('observacoes-recentes');
    });

    it('aplica v1 como versão padrão', async () => {
      await service.create(PROJECT_ID, {
        name: 'Teste',
        savedQueryId: QUERY_ID,
      });

      const { data } = firstCallArgs(prisma.endpoint.create);

      expect(data.version).toBe('v1');
    });

    it('deixa o banco aplicar o maxRows padrão quando omitido', async () => {
      await service.create(PROJECT_ID, {
        name: 'Teste',
        savedQueryId: QUERY_ID,
      });

      const { data } = firstCallArgs(prisma.endpoint.create);

      expect(data).not.toHaveProperty('maxRows');
    });

    it('devolve a rota futura derivada do projeto, versão e slug', async () => {
      const resultado = await service.create(PROJECT_ID, {
        name: 'Observações recentes',
        savedQueryId: QUERY_ID,
      });

      expect(resultado.runtimePath).toBe(
        '/runtime/clima-demo/v1/observacoes-recentes',
      );
      expect(resultado.projectSlug).toBe('clima-demo');
    });

    it('rejeita projeto inexistente', async () => {
      prisma.project.findUnique.mockResolvedValue(null);

      await expect(
        service.create(PROJECT_ID, {
          name: 'Teste',
          savedQueryId: QUERY_ID,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prisma.endpoint.create).not.toHaveBeenCalled();
    });

    it('rejeita consulta inexistente', async () => {
      prisma.savedQuery.findUnique.mockResolvedValue(null);

      await expect(
        service.create(PROJECT_ID, {
          name: 'Teste',
          savedQueryId: QUERY_ID,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejeita consulta pertencente a outro projeto', async () => {
      prisma.savedQuery.findUnique.mockResolvedValue({
        sql: SQL_VALIDO,
        connection: { projectId: OUTRO_PROJETO },
      });

      await expect(
        service.create(PROJECT_ID, {
          name: 'Teste',
          savedQueryId: QUERY_ID,
        }),
      ).rejects.toThrow(/outro projeto/);

      expect(prisma.endpoint.create).not.toHaveBeenCalled();
    });

    it('rejeita consulta cujo SQL deixou de ser somente leitura', async () => {
      prisma.savedQuery.findUnique.mockResolvedValue({
        sql: 'DELETE FROM meteorologia.observacoes',
        connection: { projectId: PROJECT_ID },
      });

      await expect(
        service.create(PROJECT_ID, {
          name: 'Teste',
          savedQueryId: QUERY_ID,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejeita rota já ocupada no mesmo projeto e versão', async () => {
      prisma.endpoint.findUnique.mockResolvedValue({ id: 'outro' });

      await expect(
        service.create(PROJECT_ID, {
          name: 'Observações recentes',
          savedQueryId: QUERY_ID,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejeita nome do qual não se deriva slug válido', async () => {
      await expect(
        service.create(PROJECT_ID, {
          name: '///',
          savedQueryId: QUERY_ID,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('findAllByProject', () => {
    it('lista os endpoints com a rota derivada', async () => {
      prisma.endpoint.findMany.mockResolvedValue([endpointRecord()]);

      const resultado = await service.findAllByProject(PROJECT_ID);

      expect(resultado).toHaveLength(1);
      expect(resultado[0].runtimePath).toBe(
        '/runtime/clima-demo/v1/observacoes-recentes',
      );
    });

    it('rejeita projeto inexistente', async () => {
      prisma.project.findUnique.mockResolvedValue(null);

      await expect(service.findAllByProject(PROJECT_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('findOne', () => {
    it('não expõe o SQL nem credenciais da conexão', async () => {
      prisma.endpoint.findUnique.mockResolvedValue(endpointRecord());

      const resultado = await service.findOne(ENDPOINT_ID);
      const serializado = JSON.stringify(resultado);

      expect(serializado).not.toContain('sql');
      expect(serializado).not.toContain('password');
      expect(resultado.savedQuery.connectionId).toBe('conexao');
    });

    it('rejeita endpoint inexistente', async () => {
      await expect(service.findOne(ENDPOINT_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    beforeEach(() => {
      prisma.endpoint.findUnique.mockResolvedValue(endpointRecord());
      prisma.endpoint.update.mockResolvedValue(endpointRecord());
    });

    it('atualiza o nome sem tocar na rota', async () => {
      await service.update(ENDPOINT_ID, { name: 'Novo nome' });

      const { data } = firstCallArgs(prisma.endpoint.update);

      expect(data.name).toBe('Novo nome');
      expect(data).not.toHaveProperty('slug');
      expect(data).not.toHaveProperty('version');
    });

    it('verifica disponibilidade ao mudar a versão', async () => {
      prisma.endpoint.findUnique
        .mockResolvedValueOnce(endpointRecord())
        .mockResolvedValueOnce({ id: 'outro' });

      await expect(
        service.update(ENDPOINT_ID, { version: 'v2' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejeita reapontar para consulta de outro projeto', async () => {
      prisma.savedQuery.findUnique.mockResolvedValue({
        sql: SQL_VALIDO,
        connection: { projectId: OUTRO_PROJETO },
      });

      await expect(
        service.update(ENDPOINT_ID, { savedQueryId: QUERY_ID }),
      ).rejects.toThrow(/outro projeto/);
    });

    it('rejeita endpoint inexistente', async () => {
      prisma.endpoint.findUnique.mockResolvedValue(null);

      await expect(
        service.update(ENDPOINT_ID, { name: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it('remove endpoint não publicado', async () => {
      prisma.endpoint.findUnique.mockResolvedValue(endpointRecord());

      await service.remove(ENDPOINT_ID);

      expect(prisma.endpoint.delete).toHaveBeenCalledWith({
        where: { id: ENDPOINT_ID },
      });
    });

    it('recusa remover endpoint publicado', async () => {
      prisma.endpoint.findUnique.mockResolvedValue(
        endpointRecord({ isPublished: true }),
      );

      await expect(service.remove(ENDPOINT_ID)).rejects.toBeInstanceOf(
        ConflictException,
      );

      expect(prisma.endpoint.delete).not.toHaveBeenCalled();
    });

    it('rejeita endpoint inexistente', async () => {
      prisma.endpoint.findUnique.mockResolvedValue(null);

      await expect(service.remove(ENDPOINT_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('publish', () => {
    beforeEach(() => {
      prisma.endpoint.findUnique.mockResolvedValue(endpointRecord());
      prisma.endpoint.update.mockResolvedValue(
        endpointRecord({ isPublished: true, publishedAt: new Date() }),
      );
    });

    it('marca como publicado e registra a data', async () => {
      const resultado = await service.publish(ENDPOINT_ID);

      const { data } = firstCallArgs(prisma.endpoint.update);

      expect(data.isPublished).toBe(true);
      expect(data.publishedAt).toBeInstanceOf(Date);
      expect(resultado.isPublished).toBe(true);
    });

    it('revalida o SQL da consulta antes de publicar', async () => {
      prisma.savedQuery.findUnique.mockResolvedValue({
        sql: 'DROP TABLE referencia.estados',
      });

      await expect(service.publish(ENDPOINT_ID)).rejects.toBeInstanceOf(
        BadRequestException,
      );

      expect(prisma.endpoint.update).not.toHaveBeenCalled();
    });

    it('preserva publishedAt ao despublicar', async () => {
      prisma.endpoint.update.mockResolvedValue(endpointRecord());

      await service.unpublish(ENDPOINT_ID);

      const { data } = firstCallArgs(prisma.endpoint.update);

      expect(data.isPublished).toBe(false);
      expect(data).not.toHaveProperty('publishedAt');
    });
  });
});
