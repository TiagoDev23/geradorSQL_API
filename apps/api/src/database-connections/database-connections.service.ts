import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { CryptoService } from '../common/crypto/crypto.service';
import { PrismaService } from '../database/prisma/prisma.service';
import { CreateDatabaseConnectionDto } from './dto/create-database-connection.dto';
import { UpdateDatabaseConnectionDto } from './dto/update-database-connection.dto';
import { ExternalDatabaseService } from './external-database.service';

/**
 * Campos expostos pela API. `passwordEncrypted` é deliberadamente
 * omitido: a credencial cifrada nunca deve sair da aplicação.
 */
const CONNECTION_PUBLIC_FIELDS = {
  id: true,
  name: true,
  host: true,
  port: true,
  databaseName: true,
  defaultSchema: true,
  username: true,
  sslMode: true,
  projectId: true,
  createdAt: true,
  updatedAt: true,
} as const;

interface ConnectionTestRow {
  database: string;
  user: string;
  version: string;
}

@Injectable()
export class DatabaseConnectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly externalDatabase: ExternalDatabaseService,
  ) {}

  async create(projectId: string, dto: CreateDatabaseConnectionDto) {
    await this.ensureProjectExists(projectId);

    const name = dto.name.trim();

    await this.ensureNameAvailable(projectId, name);

    return this.prisma.databaseConnection.create({
      data: {
        name,
        host: dto.host.trim(),
        databaseName: dto.databaseName.trim(),
        username: dto.username.trim(),
        passwordEncrypted: this.crypto.encrypt(dto.password),
        projectId,

        ...(dto.port !== undefined && { port: dto.port }),

        ...(dto.defaultSchema !== undefined && {
          defaultSchema: dto.defaultSchema.trim(),
        }),

        ...(dto.sslMode !== undefined && {
          sslMode: dto.sslMode,
        }),
      },

      select: CONNECTION_PUBLIC_FIELDS,
    });
  }

  async findAllByProject(projectId: string) {
    await this.ensureProjectExists(projectId);

    return this.prisma.databaseConnection.findMany({
      where: {
        projectId,
      },

      orderBy: {
        createdAt: 'desc',
      },

      select: CONNECTION_PUBLIC_FIELDS,
    });
  }

  async findOne(id: string) {
    const connection = await this.prisma.databaseConnection.findUnique({
      where: {
        id,
      },

      select: CONNECTION_PUBLIC_FIELDS,
    });

    if (!connection) {
      throw new NotFoundException('Conexão não encontrada.');
    }

    return connection;
  }

  async update(id: string, dto: UpdateDatabaseConnectionDto) {
    const connection = await this.findOne(id);

    let name: string | undefined;

    if (dto.name !== undefined) {
      name = dto.name.trim();

      await this.ensureNameAvailable(connection.projectId, name, id);
    }

    return this.prisma.databaseConnection.update({
      where: {
        id,
      },

      data: {
        ...(name !== undefined && { name }),

        ...(dto.host !== undefined && {
          host: dto.host.trim(),
        }),

        ...(dto.port !== undefined && { port: dto.port }),

        ...(dto.databaseName !== undefined && {
          databaseName: dto.databaseName.trim(),
        }),

        ...(dto.defaultSchema !== undefined && {
          defaultSchema: dto.defaultSchema.trim(),
        }),

        ...(dto.username !== undefined && {
          username: dto.username.trim(),
        }),

        ...(dto.password !== undefined && {
          passwordEncrypted: this.crypto.encrypt(dto.password),
        }),

        ...(dto.sslMode !== undefined && {
          sslMode: dto.sslMode,
        }),
      },

      select: CONNECTION_PUBLIC_FIELDS,
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    const savedQueries = await this.prisma.savedQuery.count({
      where: {
        connectionId: id,
      },
    });

    // O schema define onDelete: Restrict entre SavedQuery e
    // DatabaseConnection. A verificação explícita permite devolver
    // uma mensagem clara em vez de um erro de integridade.
    if (savedQueries > 0) {
      throw new ConflictException(
        'A conexão possui consultas salvas e não pode ser removida.',
      );
    }

    await this.prisma.databaseConnection.delete({
      where: {
        id,
      },
    });

    return {
      message: 'Conexão removida com sucesso.',
    };
  }

  /**
   * Verifica a conectividade executando uma consulta mínima no banco
   * externo. A abertura e o encerramento do cliente ficam a cargo do
   * ExternalDatabaseService.
   */
  async test(id: string) {
    const startedAt = Date.now();

    const row = await this.externalDatabase.run(id, async (client) => {
      const result = await client.query<ConnectionTestRow>(
        'SELECT current_database() AS database, current_user AS "user", version() AS version',
      );

      return result.rows[0];
    });

    return {
      success: true,
      database: row.database,
      user: row.user,
      serverVersion: row.version,
      durationMs: Date.now() - startedAt,
    };
  }

  private async ensureProjectExists(projectId: string): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: {
        id: projectId,
      },

      select: {
        id: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Projeto não encontrado.');
    }
  }

  private async ensureNameAvailable(
    projectId: string,
    name: string,
    ignoredConnectionId?: string,
  ): Promise<void> {
    const existingConnection = await this.prisma.databaseConnection.findUnique({
      where: {
        projectId_name: {
          projectId,
          name,
        },
      },

      select: {
        id: true,
      },
    });

    if (existingConnection && existingConnection.id !== ignoredConnectionId) {
      throw new ConflictException(
        `Já existe uma conexão com o nome "${name}" neste projeto.`,
      );
    }
  }
}
