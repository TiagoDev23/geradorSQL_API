import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { isValidSlug, normalizeSlug } from '../common/slug';
import { PrismaService } from '../database/prisma/prisma.service';
import { QueryParameterType } from '../generated/prisma/enums';
import { assertReadOnlySelect } from '../saved-queries/sql-validator';
import { CreateEndpointDto } from './dto/create-endpoint.dto';
import { UpdateEndpointDto } from './dto/update-endpoint.dto';

/**
 * Campos devolvidos pela API. O SQL não aparece: o endpoint referencia a
 * consulta, não guarda cópia dela. Nada da conexão é exposto além do
 * identificador, para que nenhuma credencial transite.
 */
const ENDPOINT_FIELDS = {
  id: true,
  name: true,
  description: true,
  slug: true,
  version: true,
  isPublished: true,
  publishedAt: true,
  maxRows: true,
  projectId: true,
  savedQueryId: true,
  createdAt: true,
  updatedAt: true,

  project: {
    select: { slug: true },
  },

  savedQuery: {
    select: {
      id: true,
      name: true,
      description: true,
      connectionId: true,
      parameters: {
        select: {
          name: true,
          type: true,
          position: true,
          required: true,
          defaultValue: true,
        },
        orderBy: { position: 'asc' },
      },
    },
  },
} as const;

/** Formato devolvido pelo Prisma para o select acima. */
interface EndpointRecord {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  version: string;
  isPublished: boolean;
  publishedAt: Date | null;
  maxRows: number;
  projectId: string;
  savedQueryId: string;
  createdAt: Date;
  updatedAt: Date;
  project: { slug: string };
  savedQuery: {
    id: string;
    name: string;
    description: string | null;
    connectionId: string;
    parameters: {
      name: string;
      type: QueryParameterType;
      position: number;
      required: boolean;
      defaultValue: string | null;
    }[];
  };
}

@Injectable()
export class EndpointsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(projectId: string, dto: CreateEndpointDto) {
    await this.ensureProjectExists(projectId);
    await this.ensureSavedQueryUsable(projectId, dto.savedQueryId);

    const slug = this.resolveSlug(dto.slug, dto.name);
    const version = dto.version ?? 'v1';

    await this.ensureRouteAvailable(projectId, version, slug);

    const endpoint = await this.prisma.endpoint.create({
      data: {
        name: dto.name.trim(),
        slug,
        version,
        projectId,
        savedQueryId: dto.savedQueryId,

        ...(dto.description !== undefined && {
          description: dto.description.trim(),
        }),

        ...(dto.maxRows !== undefined && { maxRows: dto.maxRows }),
      },

      select: ENDPOINT_FIELDS,
    });

    return this.toResponse(endpoint);
  }

  async findAllByProject(projectId: string) {
    await this.ensureProjectExists(projectId);

    const endpoints = await this.prisma.endpoint.findMany({
      where: { projectId },
      orderBy: [{ version: 'asc' }, { slug: 'asc' }],
      select: ENDPOINT_FIELDS,
    });

    return endpoints.map((endpoint) => this.toResponse(endpoint));
  }

  async findOne(id: string) {
    return this.toResponse(await this.loadEndpoint(id));
  }

  async update(id: string, dto: UpdateEndpointDto) {
    const current = await this.loadEndpoint(id);

    if (dto.savedQueryId !== undefined) {
      await this.ensureSavedQueryUsable(current.projectId, dto.savedQueryId);
    }

    const slug =
      dto.slug !== undefined ? this.resolveSlug(dto.slug) : current.slug;
    const version = dto.version ?? current.version;

    if (slug !== current.slug || version !== current.version) {
      await this.ensureRouteAvailable(current.projectId, version, slug, id);
    }

    const endpoint = await this.prisma.endpoint.update({
      where: { id },

      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),

        ...(dto.description !== undefined && {
          description: dto.description.trim(),
        }),

        ...(dto.slug !== undefined && { slug }),
        ...(dto.version !== undefined && { version }),
        ...(dto.maxRows !== undefined && { maxRows: dto.maxRows }),

        ...(dto.savedQueryId !== undefined && {
          savedQueryId: dto.savedQueryId,
        }),
      },

      select: ENDPOINT_FIELDS,
    });

    return this.toResponse(endpoint);
  }

  async remove(id: string) {
    const current = await this.loadEndpoint(id);

    // Remover um endpoint publicado derrubaria uma rota em uso e, por
    // cascata definida no schema, apagaria o histórico de requisições.
    // Despublicar primeiro torna a intenção explícita.
    if (current.isPublished) {
      throw new ConflictException('Despublique o endpoint antes de removê-lo.');
    }

    await this.prisma.endpoint.delete({ where: { id } });

    return { message: 'Endpoint removido com sucesso.' };
  }

  /**
   * Marca o endpoint como publicado. O runtime do M6 só executará
   * endpoints neste estado.
   */
  async publish(id: string) {
    const current = await this.loadEndpoint(id);

    // Revalida a consulta antes de expor a rota: o SQL foi verificado
    // ao ser gravado, mas as regras podem ter mudado desde então.
    const savedQuery = await this.prisma.savedQuery.findUnique({
      where: { id: current.savedQueryId },
      select: { sql: true },
    });

    if (!savedQuery) {
      throw new NotFoundException('Consulta associada não encontrada.');
    }

    assertReadOnlySelect(savedQuery.sql);

    const endpoint = await this.prisma.endpoint.update({
      where: { id },
      data: { isPublished: true, publishedAt: new Date() },
      select: ENDPOINT_FIELDS,
    });

    return this.toResponse(endpoint);
  }

  /**
   * `publishedAt` é preservado como registro da última publicação.
   */
  async unpublish(id: string) {
    await this.loadEndpoint(id);

    const endpoint = await this.prisma.endpoint.update({
      where: { id },
      data: { isPublished: false },
      select: ENDPOINT_FIELDS,
    });

    return this.toResponse(endpoint);
  }

  /**
   * Acrescenta a rota derivada e remove o objeto aninhado do projeto,
   * que só existe para compor essa rota.
   */
  private toResponse(endpoint: EndpointRecord) {
    const { project, ...rest } = endpoint;

    return {
      ...rest,
      projectSlug: project.slug,
      runtimePath: `/runtime/${project.slug}/${endpoint.version}/${endpoint.slug}`,
    };
  }

  private async loadEndpoint(id: string) {
    const endpoint = await this.prisma.endpoint.findUnique({
      where: { id },
      select: ENDPOINT_FIELDS,
    });

    if (!endpoint) {
      throw new NotFoundException('Endpoint não encontrado.');
    }

    return endpoint;
  }

  private resolveSlug(slug?: string, fallbackName?: string): string {
    const source = slug ?? fallbackName ?? '';
    const normalized = slug ? slug.trim() : normalizeSlug(source);

    if (!isValidSlug(normalized)) {
      throw new BadRequestException(
        'Não foi possível derivar um slug válido. Informe um slug com letras minúsculas, números e hífens.',
      );
    }

    return normalized;
  }

  private async ensureProjectExists(projectId: string): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });

    if (!project) {
      throw new NotFoundException('Projeto não encontrado.');
    }
  }

  /**
   * A consulta precisa existir e pertencer ao mesmo projeto do endpoint.
   * O vínculo é indireto: SavedQuery → DatabaseConnection → Project.
   */
  private async ensureSavedQueryUsable(
    projectId: string,
    savedQueryId: string,
  ): Promise<void> {
    const savedQuery = await this.prisma.savedQuery.findUnique({
      where: { id: savedQueryId },
      select: {
        sql: true,
        connection: {
          select: { projectId: true },
        },
      },
    });

    if (!savedQuery) {
      throw new NotFoundException('Consulta não encontrada.');
    }

    if (savedQuery.connection.projectId !== projectId) {
      throw new BadRequestException(
        'A consulta pertence a outro projeto e não pode ser publicada aqui.',
      );
    }

    assertReadOnlySelect(savedQuery.sql);
  }

  private async ensureRouteAvailable(
    projectId: string,
    version: string,
    slug: string,
    ignoredEndpointId?: string,
  ): Promise<void> {
    const existing = await this.prisma.endpoint.findUnique({
      where: {
        projectId_version_slug: { projectId, version, slug },
      },
      select: { id: true },
    });

    if (existing && existing.id !== ignoredEndpointId) {
      throw new ConflictException(
        `Já existe um endpoint em ${version}/${slug} neste projeto.`,
      );
    }
  }
}
