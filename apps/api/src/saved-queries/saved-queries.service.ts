import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { ExternalDatabaseService } from '../database-connections/external-database.service';
import { PrismaService } from '../database/prisma/prisma.service';
import {
  CreateSavedQueryDto,
  QueryParameterDto,
} from './dto/create-saved-query.dto';
import {
  EXECUTION_DEFAULT_MAX_ROWS,
  EXECUTION_MAX_ROWS_LIMIT,
  ExecuteSavedQueryDto,
} from './dto/execute-saved-query.dto';
import { UpdateSavedQueryDto } from './dto/update-saved-query.dto';
import { executeQuery } from './query-execution';
import { assertReadOnlySelect, extractPlaceholders } from './sql-validator';

const PARAMETER_FIELDS = {
  id: true,
  name: true,
  description: true,
  type: true,
  position: true,
  required: true,
  defaultValue: true,
} as const;

const SAVED_QUERY_FIELDS = {
  id: true,
  name: true,
  description: true,
  sql: true,
  connectionId: true,
  createdAt: true,
  updatedAt: true,
} as const;

const SAVED_QUERY_WITH_PARAMETERS = {
  ...SAVED_QUERY_FIELDS,
  parameters: {
    select: PARAMETER_FIELDS,
    orderBy: { position: 'asc' },
  },
} as const;

@Injectable()
export class SavedQueriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly externalDatabase: ExternalDatabaseService,
  ) {}

  async create(connectionId: string, dto: CreateSavedQueryDto) {
    await this.ensureConnectionExists(connectionId);

    const name = dto.name.trim();

    await this.ensureNameAvailable(connectionId, name);

    const sql = dto.sql.trim();
    const parameters = dto.parameters ?? [];

    assertReadOnlySelect(sql);
    this.assertParametersMatchSql(sql, parameters);

    return this.prisma.savedQuery.create({
      data: {
        name,
        sql,
        connectionId,

        ...(dto.description !== undefined && {
          description: dto.description.trim(),
        }),

        parameters: {
          create: parameters.map((parameter) => ({
            name: parameter.name.trim(),
            type: parameter.type,
            position: parameter.position,

            ...(parameter.description !== undefined && {
              description: parameter.description.trim(),
            }),

            ...(parameter.required !== undefined && {
              required: parameter.required,
            }),

            ...(parameter.defaultValue !== undefined && {
              defaultValue: parameter.defaultValue,
            }),
          })),
        },
      },

      select: SAVED_QUERY_WITH_PARAMETERS,
    });
  }

  async findAllByConnection(connectionId: string) {
    await this.ensureConnectionExists(connectionId);

    return this.prisma.savedQuery.findMany({
      where: { connectionId },
      orderBy: { createdAt: 'desc' },
      select: SAVED_QUERY_WITH_PARAMETERS,
    });
  }

  async findOne(id: string) {
    const savedQuery = await this.prisma.savedQuery.findUnique({
      where: { id },
      select: SAVED_QUERY_WITH_PARAMETERS,
    });

    if (!savedQuery) {
      throw new NotFoundException('Consulta não encontrada.');
    }

    return savedQuery;
  }

  async update(id: string, dto: UpdateSavedQueryDto) {
    const current = await this.findOne(id);

    let name: string | undefined;

    if (dto.name !== undefined) {
      name = dto.name.trim();

      await this.ensureNameAvailable(current.connectionId, name, id);
    }

    const sql = dto.sql !== undefined ? dto.sql.trim() : current.sql;

    if (dto.sql !== undefined) {
      assertReadOnlySelect(sql);
    }

    // O SQL e os parâmetros formam um par: alterar um dos dois obriga a
    // revalidar a correspondência com o conjunto que ficará gravado.
    const parameters =
      dto.parameters ??
      current.parameters.map((parameter) => ({
        name: parameter.name,
        type: parameter.type,
        position: parameter.position,
        required: parameter.required,
        defaultValue: parameter.defaultValue ?? undefined,
        description: parameter.description ?? undefined,
      }));

    this.assertParametersMatchSql(sql, parameters);

    return this.prisma.savedQuery.update({
      where: { id },

      data: {
        ...(name !== undefined && { name }),

        ...(dto.description !== undefined && {
          description: dto.description.trim(),
        }),

        ...(dto.sql !== undefined && { sql }),

        // Substituição integral: remover e recriar mantém as posições
        // consistentes sem exigir diferenciação item a item.
        ...(dto.parameters !== undefined && {
          parameters: {
            deleteMany: {},
            create: dto.parameters.map((parameter) => ({
              name: parameter.name.trim(),
              type: parameter.type,
              position: parameter.position,

              ...(parameter.description !== undefined && {
                description: parameter.description.trim(),
              }),

              ...(parameter.required !== undefined && {
                required: parameter.required,
              }),

              ...(parameter.defaultValue !== undefined && {
                defaultValue: parameter.defaultValue,
              }),
            })),
          },
        }),
      },

      select: SAVED_QUERY_WITH_PARAMETERS,
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    const endpoints = await this.prisma.endpoint.count({
      where: { savedQueryId: id },
    });

    // O schema define onDelete: Restrict entre Endpoint e SavedQuery.
    if (endpoints > 0) {
      throw new ConflictException(
        'A consulta possui endpoints associados e não pode ser removida.',
      );
    }

    await this.prisma.savedQuery.delete({ where: { id } });

    return { message: 'Consulta removida com sucesso.' };
  }

  /**
   * Executa a consulta no banco externo com valores parametrizados e
   * devolve um resultado limitado.
   */
  async execute(id: string, dto: ExecuteSavedQueryDto) {
    const savedQuery = await this.findOne(id);

    const maxRows = Math.min(
      dto.maxRows ?? EXECUTION_DEFAULT_MAX_ROWS,
      EXECUTION_MAX_ROWS_LIMIT,
    );

    return executeQuery(this.externalDatabase, {
      sql: savedQuery.sql,
      connectionId: savedQuery.connectionId,
      parameters: savedQuery.parameters.map((parameter) => ({
        name: parameter.name,
        type: parameter.type,
        position: parameter.position,
        required: parameter.required,
        defaultValue: parameter.defaultValue,
      })),
      received: dto.parameters ?? {},
      maxRows,
    });
  }

  /**
   * Verifica que cada marcador do SQL tem um parâmetro correspondente e
   * vice-versa, e que nomes e posições não se repetem.
   */
  private assertParametersMatchSql(
    sql: string,
    parameters: Pick<QueryParameterDto, 'name' | 'position'>[],
  ): void {
    const placeholders = extractPlaceholders(sql);

    const names = new Set<string>();
    const positions = new Set<number>();

    for (const parameter of parameters) {
      const name = parameter.name.trim();

      if (names.has(name)) {
        throw new BadRequestException(
          `O parâmetro "${name}" está declarado mais de uma vez.`,
        );
      }

      if (positions.has(parameter.position)) {
        throw new BadRequestException(
          `A posição ${parameter.position} está declarada mais de uma vez.`,
        );
      }

      names.add(name);
      positions.add(parameter.position);
    }

    for (const placeholder of placeholders) {
      if (!positions.has(placeholder)) {
        throw new BadRequestException(
          `A consulta usa o marcador $${placeholder}, mas nenhum parâmetro foi declarado nessa posição.`,
        );
      }
    }

    for (const position of positions) {
      if (!placeholders.includes(position)) {
        throw new BadRequestException(
          `Existe um parâmetro na posição ${position}, mas a consulta não usa o marcador $${position}.`,
        );
      }
    }
  }

  private async ensureConnectionExists(connectionId: string): Promise<void> {
    const connection = await this.prisma.databaseConnection.findUnique({
      where: { id: connectionId },
      select: { id: true },
    });

    if (!connection) {
      throw new NotFoundException('Conexão não encontrada.');
    }
  }

  private async ensureNameAvailable(
    connectionId: string,
    name: string,
    ignoredQueryId?: string,
  ): Promise<void> {
    const existing = await this.prisma.savedQuery.findUnique({
      where: {
        connectionId_name: { connectionId, name },
      },
      select: { id: true },
    });

    if (existing && existing.id !== ignoredQueryId) {
      throw new ConflictException(
        `Já existe uma consulta com o nome "${name}" nesta conexão.`,
      );
    }
  }
}
