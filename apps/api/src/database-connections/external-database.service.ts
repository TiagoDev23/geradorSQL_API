import {
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Client } from 'pg';

import { CryptoService } from '../common/crypto/crypto.service';
import { PrismaService } from '../database/prisma/prisma.service';
import { DatabaseSslMode } from '../generated/prisma/enums';

const CONNECTION_TIMEOUT_MS = 5000;
const QUERY_TIMEOUT_MS = 5000;

/**
 * Dados da conexão disponíveis para a operação executada, sem a
 * credencial.
 */
export interface ExternalConnectionInfo {
  id: string;
  host: string;
  port: number;
  databaseName: string;
  defaultSchema: string;
  username: string;
}

/**
 * Ponto único de acesso a bancos PostgreSQL externos. Concentra a
 * decifragem da credencial, os timeouts, o encerramento do cliente e a
 * conversão de erros do PostgreSQL em respostas seguras, de modo que os
 * módulos de negócio não repitam essas responsabilidades.
 */
@Injectable()
export class ExternalDatabaseService {
  private readonly logger = new Logger(ExternalDatabaseService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  /**
   * Abre uma conexão temporária, executa a operação e encerra o cliente
   * em qualquer cenário.
   */
  async run<T>(
    connectionId: string,
    operation: (
      client: Client,
      connection: ExternalConnectionInfo,
    ) => Promise<T>,
  ): Promise<T> {
    const connection = await this.prisma.databaseConnection.findUnique({
      where: {
        id: connectionId,
      },

      select: {
        id: true,
        host: true,
        port: true,
        databaseName: true,
        defaultSchema: true,
        username: true,
        sslMode: true,
        passwordEncrypted: true,
      },
    });

    if (!connection) {
      throw new NotFoundException('Conexão não encontrada.');
    }

    const client = new Client({
      host: connection.host,
      port: connection.port,
      database: connection.databaseName,
      user: connection.username,
      password: this.crypto.decrypt(connection.passwordEncrypted),

      // sslMode REQUIRE exige canal cifrado, sem validação de cadeia
      // de certificados, equivalente ao sslmode=require do PostgreSQL.
      ssl:
        connection.sslMode === DatabaseSslMode.REQUIRE
          ? { rejectUnauthorized: false }
          : false,

      connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
      query_timeout: QUERY_TIMEOUT_MS,
      statement_timeout: QUERY_TIMEOUT_MS,
      application_name: 'gerador-api',
    });

    const info: ExternalConnectionInfo = {
      id: connection.id,
      host: connection.host,
      port: connection.port,
      databaseName: connection.databaseName,
      defaultSchema: connection.defaultSchema,
      username: connection.username,
    };

    try {
      try {
        await client.connect();
      } catch (error) {
        this.logger.warn(
          `Falha ao conectar em ${connectionId}: ${describeError(error)}`,
        );

        throw new ServiceUnavailableException(
          'Não foi possível conectar ao banco informado.',
        );
      }

      try {
        return await operation(client, info);
      } catch (error) {
        // Erros de domínio da própria operação, como tabela
        // inexistente, devem chegar ao cliente preservados.
        if (error instanceof HttpException) {
          throw error;
        }

        this.logger.warn(
          `Falha ao consultar ${connectionId}: ${describeError(error)}`,
        );

        throw new ServiceUnavailableException(
          'Não foi possível consultar o banco informado.',
        );
      }
    } finally {
      await client.end().catch(() => undefined);
    }
  }
}

/**
 * Descrição técnica do erro para o log da aplicação. O detalhe nunca
 * chega ao cliente.
 */
function describeError(error: unknown): string {
  if (error instanceof Error) {
    const code = (error as { code?: string }).code;

    return code ? `${code} — ${error.message}` : error.message;
  }

  return 'erro desconhecido';
}
