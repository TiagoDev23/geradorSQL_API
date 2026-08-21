import { ConflictException, NotFoundException } from '@nestjs/common';

import { CryptoService } from '../common/crypto/crypto.service';
import { PrismaService } from '../database/prisma/prisma.service';
import { DatabaseConnectionsService } from './database-connections.service';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const CONNECTION_ID = '22222222-2222-4222-8222-222222222222';

function buildPrismaMock() {
  return {
    project: {
      findUnique: jest.fn(),
    },
    databaseConnection: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    savedQuery: {
      count: jest.fn(),
    },
  };
}

interface PrismaCallArgs {
  data: Record<string, unknown>;
  select: Record<string, unknown>;
}

/**
 * Recupera, de forma tipada, o objeto passado na primeira chamada do
 * mock. Evita o acesso a `any` que o mock do Jest devolve por padrao.
 */
function firstCallArgs(mock: jest.Mock): PrismaCallArgs {
  const calls = mock.mock.calls as unknown as PrismaCallArgs[][];

  return calls[0][0];
}

describe('DatabaseConnectionsService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let crypto: { encrypt: jest.Mock; decrypt: jest.Mock };
  let service: DatabaseConnectionsService;

  const baseDto = {
    name: 'Banco Demo',
    host: '127.0.0.1',
    databaseName: 'gerador_api_demo',
    username: 'demo',
    password: 'senha-em-texto-puro',
  };

  beforeEach(() => {
    prisma = buildPrismaMock();

    crypto = {
      encrypt: jest.fn(() => 'iv:tag:ciphertext'),
      decrypt: jest.fn(() => 'senha-em-texto-puro'),
    };

    service = new DatabaseConnectionsService(
      prisma as unknown as PrismaService,
      crypto as unknown as CryptoService,
    );

    prisma.project.findUnique.mockResolvedValue({
      id: PROJECT_ID,
    });

    prisma.databaseConnection.findUnique.mockResolvedValue(null);
  });

  describe('create', () => {
    it('cifra a senha antes de persistir e não grava texto puro', async () => {
      prisma.databaseConnection.create.mockResolvedValue({
        id: CONNECTION_ID,
      });

      await service.create(PROJECT_ID, baseDto);

      expect(crypto.encrypt).toHaveBeenCalledWith('senha-em-texto-puro');

      const { data } = firstCallArgs(prisma.databaseConnection.create);

      expect(data.passwordEncrypted).toBe('iv:tag:ciphertext');
      expect(data).not.toHaveProperty('password');
      expect(JSON.stringify(data)).not.toContain('senha-em-texto-puro');
    });

    it('não seleciona passwordEncrypted na resposta', async () => {
      prisma.databaseConnection.create.mockResolvedValue({
        id: CONNECTION_ID,
      });

      await service.create(PROJECT_ID, baseDto);

      const { select } = firstCallArgs(prisma.databaseConnection.create);

      expect(select).not.toHaveProperty('passwordEncrypted');
      expect(select.id).toBe(true);
    });

    it('aplica os padrões do schema quando os campos são omitidos', async () => {
      prisma.databaseConnection.create.mockResolvedValue({
        id: CONNECTION_ID,
      });

      await service.create(PROJECT_ID, baseDto);

      const { data } = firstCallArgs(prisma.databaseConnection.create);

      // Ausentes no data, para que o banco aplique os defaults.
      expect(data).not.toHaveProperty('port');
      expect(data).not.toHaveProperty('defaultSchema');
      expect(data).not.toHaveProperty('sslMode');
    });

    it('rejeita projeto inexistente', async () => {
      prisma.project.findUnique.mockResolvedValue(null);

      await expect(service.create(PROJECT_ID, baseDto)).rejects.toBeInstanceOf(
        NotFoundException,
      );

      expect(prisma.databaseConnection.create).not.toHaveBeenCalled();
    });

    it('rejeita nome já usado no mesmo projeto', async () => {
      prisma.databaseConnection.findUnique.mockResolvedValue({
        id: 'outra-conexao',
      });

      await expect(service.create(PROJECT_ID, baseDto)).rejects.toBeInstanceOf(
        ConflictException,
      );

      expect(prisma.databaseConnection.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    beforeEach(() => {
      prisma.databaseConnection.findUnique.mockResolvedValue({
        id: CONNECTION_ID,
        projectId: PROJECT_ID,
        name: 'Banco Demo',
      });

      prisma.databaseConnection.update.mockResolvedValue({
        id: CONNECTION_ID,
      });
    });

    it('mantém a credencial atual quando a senha é omitida', async () => {
      await service.update(CONNECTION_ID, { host: '10.0.0.5' });

      const { data } = firstCallArgs(prisma.databaseConnection.update);

      expect(crypto.encrypt).not.toHaveBeenCalled();
      expect(data).not.toHaveProperty('passwordEncrypted');
      expect(data.host).toBe('10.0.0.5');
    });

    it('cifra a nova senha quando informada', async () => {
      await service.update(CONNECTION_ID, {
        password: 'nova-senha',
      });

      expect(crypto.encrypt).toHaveBeenCalledWith('nova-senha');

      const { data } = firstCallArgs(prisma.databaseConnection.update);

      expect(data.passwordEncrypted).toBe('iv:tag:ciphertext');
      expect(data).not.toHaveProperty('password');
    });

    it('rejeita conexão inexistente', async () => {
      prisma.databaseConnection.findUnique.mockResolvedValue(null);

      await expect(
        service.update(CONNECTION_ID, { host: '10.0.0.5' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    beforeEach(() => {
      prisma.databaseConnection.findUnique.mockResolvedValue({
        id: CONNECTION_ID,
        projectId: PROJECT_ID,
      });
    });

    it('remove quando não há consultas salvas', async () => {
      prisma.savedQuery.count.mockResolvedValue(0);

      await service.remove(CONNECTION_ID);

      expect(prisma.databaseConnection.delete).toHaveBeenCalledWith({
        where: { id: CONNECTION_ID },
      });
    });

    it('recusa a remoção quando há consultas salvas', async () => {
      prisma.savedQuery.count.mockResolvedValue(2);

      await expect(service.remove(CONNECTION_ID)).rejects.toBeInstanceOf(
        ConflictException,
      );

      expect(prisma.databaseConnection.delete).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('rejeita conexão inexistente', async () => {
      prisma.databaseConnection.findUnique.mockResolvedValue(null);

      await expect(service.findOne(CONNECTION_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('não seleciona passwordEncrypted', async () => {
      prisma.databaseConnection.findUnique.mockResolvedValue({
        id: CONNECTION_ID,
      });

      await service.findOne(CONNECTION_ID);

      const { select } = firstCallArgs(prisma.databaseConnection.findUnique);

      expect(select).not.toHaveProperty('passwordEncrypted');
    });
  });
});
