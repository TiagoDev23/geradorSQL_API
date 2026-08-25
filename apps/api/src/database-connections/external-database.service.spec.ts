import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';

import { CryptoService } from '../common/crypto/crypto.service';
import { PrismaService } from '../database/prisma/prisma.service';
import { ExternalDatabaseService } from './external-database.service';

/**
 * Instâncias criadas pelo construtor simulado do pg, para inspecionar
 * conexão e encerramento.
 */
const clients: {
  connect: jest.Mock;
  query: jest.Mock;
  end: jest.Mock;
  config: Record<string, unknown>;
}[] = [];

/** Quando verdadeiro, o próximo cliente criado falha ao conectar. */
let connectDeveFalhar = false;

// Substitui apenas o Client: o restante do módulo continua real,
// porque o adapter do Prisma depende de `pg.types`.
jest.mock('pg', () => ({
  ...jest.requireActual<Record<string, unknown>>('pg'),
  Client: jest.fn().mockImplementation((config: Record<string, unknown>) => {
    const falhar = connectDeveFalhar;

    const client = {
      config,
      connect: falhar
        ? jest.fn().mockRejectedValue(new Error('conexão recusada'))
        : jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue({ rows: [] }),
      end: jest.fn().mockResolvedValue(undefined),
    };

    clients.push(client);

    return client;
  }),
}));

const CONNECTION_ID = '22222222-2222-4222-8222-222222222222';

describe('ExternalDatabaseService', () => {
  let prisma: { databaseConnection: { findUnique: jest.Mock } };
  let crypto: { decrypt: jest.Mock };
  let service: ExternalDatabaseService;

  beforeEach(() => {
    clients.length = 0;
    connectDeveFalhar = false;

    prisma = { databaseConnection: { findUnique: jest.fn() } };
    crypto = { decrypt: jest.fn(() => 'senha-em-texto-puro') };

    service = new ExternalDatabaseService(
      prisma as unknown as PrismaService,
      crypto as unknown as CryptoService,
    );

    prisma.databaseConnection.findUnique.mockResolvedValue({
      id: CONNECTION_ID,
      host: '127.0.0.1',
      port: 5435,
      databaseName: 'gerador_api_demo',
      defaultSchema: 'public',
      username: 'demo',
      sslMode: 'DISABLE',
      passwordEncrypted: 'iv:tag:ciphertext',
    });
  });

  it('rejeita conexão inexistente sem abrir cliente', async () => {
    prisma.databaseConnection.findUnique.mockResolvedValue(null);

    await expect(
      service.run(CONNECTION_ID, () => Promise.resolve('nunca')),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(clients).toHaveLength(0);
  });

  it('decifra a credencial e a repassa ao driver', async () => {
    await service.run(CONNECTION_ID, () => Promise.resolve('ok'));

    expect(crypto.decrypt).toHaveBeenCalledWith('iv:tag:ciphertext');
    expect(clients[0].config.password).toBe('senha-em-texto-puro');
  });

  it('define timeout de conexão e de consulta', async () => {
    await service.run(CONNECTION_ID, () => Promise.resolve('ok'));

    expect(clients[0].config.connectionTimeoutMillis).toBe(5000);
    expect(clients[0].config.query_timeout).toBe(5000);
    expect(clients[0].config.statement_timeout).toBe(5000);
  });

  it('encerra o cliente em caso de sucesso', async () => {
    const resultado = await service.run(CONNECTION_ID, () =>
      Promise.resolve('ok'),
    );

    expect(resultado).toBe('ok');
    expect(clients[0].end).toHaveBeenCalledTimes(1);
  });

  it('encerra o cliente quando a operação falha', async () => {
    await expect(
      service.run(CONNECTION_ID, () => {
        throw new Error('erro na consulta');
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(clients[0].end).toHaveBeenCalledTimes(1);
  });

  it('encerra o cliente quando a conexão falha', async () => {
    connectDeveFalhar = true;

    const operacao = jest.fn();

    await expect(service.run(CONNECTION_ID, operacao)).rejects.toThrow(
      'Não foi possível conectar ao banco informado.',
    );

    // A operação não chega a rodar, mas o cliente é encerrado.
    expect(operacao).not.toHaveBeenCalled();
    expect(clients[0].end).toHaveBeenCalledTimes(1);
  });

  it('converte erro do PostgreSQL em mensagem genérica', async () => {
    await expect(
      service.run(CONNECTION_ID, () => {
        throw Object.assign(new Error('relation "x" does not exist'), {
          code: '42P01',
        });
      }),
    ).rejects.toThrow('Não foi possível consultar o banco informado.');
  });

  it('preserva exceções de domínio lançadas pela operação', async () => {
    await expect(
      service.run(CONNECTION_ID, () => {
        throw new NotFoundException('Tabela não encontrada.');
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
