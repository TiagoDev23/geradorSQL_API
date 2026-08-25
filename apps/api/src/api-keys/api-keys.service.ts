import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { PrismaService } from '../database/prisma/prisma.service';
import { generateApiKey, hashApiKey } from './api-key-token';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

/**
 * Metadados seguros. `keyHash` é deliberadamente omitido: mesmo sendo
 * um hash, expô-lo permitiria testar chaves candidatas offline.
 */
const API_KEY_FIELDS = {
  id: true,
  name: true,
  keyPrefix: true,
  projectId: true,
  expiresAt: true,
  revokedAt: true,
  lastUsedAt: true,
  createdAt: true,
} as const;

@Injectable()
export class ApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Único momento em que o valor completo da chave existe fora do
   * cliente. Ele não é persistido nem pode ser recuperado depois.
   */
  async create(projectId: string, dto: CreateApiKeyDto) {
    await this.ensureProjectExists(projectId);

    const generated = generateApiKey();

    const apiKey = await this.prisma.apiKey.create({
      data: {
        name: dto.name.trim(),
        keyPrefix: generated.keyPrefix,
        keyHash: generated.keyHash,
        projectId,

        ...(dto.expiresAt !== undefined && {
          expiresAt: new Date(dto.expiresAt),
        }),
      },

      select: API_KEY_FIELDS,
    });

    return {
      ...apiKey,
      token: generated.token,
      warning: 'Guarde esta chave: ela não poderá ser exibida novamente.',
    };
  }

  async findAllByProject(projectId: string) {
    await this.ensureProjectExists(projectId);

    return this.prisma.apiKey.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      select: API_KEY_FIELDS,
    });
  }

  async findOne(id: string) {
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { id },
      select: API_KEY_FIELDS,
    });

    if (!apiKey) {
      throw new NotFoundException('API Key não encontrada.');
    }

    return apiKey;
  }

  /** Revogar é preferível a excluir: preserva o histórico de uso. */
  async revoke(id: string) {
    const current = await this.findOne(id);

    if (current.revokedAt) {
      return current;
    }

    return this.prisma.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
      select: API_KEY_FIELDS,
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    await this.prisma.apiKey.delete({ where: { id } });

    return { message: 'API Key removida com sucesso.' };
  }

  /**
   * Autentica uma chave apresentada no runtime e confere o escopo.
   *
   * A busca é feita pelo hash, nunca pelo valor apresentado, e a chave
   * completa não aparece em exceção nem em log.
   */
  async authenticate(rawKey: string | undefined, projectId: string) {
    if (!rawKey || rawKey.trim().length === 0) {
      throw new UnauthorizedException('API Key não informada.');
    }

    const apiKey = await this.prisma.apiKey.findUnique({
      where: { keyHash: hashApiKey(rawKey.trim()) },
      select: {
        id: true,
        projectId: true,
        expiresAt: true,
        revokedAt: true,
      },
    });

    if (!apiKey) {
      throw new UnauthorizedException('API Key inválida.');
    }

    if (apiKey.revokedAt) {
      throw new UnauthorizedException('API Key revogada.');
    }

    if (apiKey.expiresAt && apiKey.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('API Key expirada.');
    }

    // A chave é válida, mas pertence a outro projeto: é uma questão de
    // permissão, não de identificação, por isso 403 e não 401.
    if (apiKey.projectId !== projectId) {
      throw new ForbiddenException(
        'Esta API Key não tem acesso a este projeto.',
      );
    }

    // Registro de uso; uma falha aqui não deve impedir a requisição.
    await this.prisma.apiKey
      .update({
        where: { id: apiKey.id },
        data: { lastUsedAt: new Date() },
      })
      .catch(() => undefined);

    return { id: apiKey.id };
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
}
