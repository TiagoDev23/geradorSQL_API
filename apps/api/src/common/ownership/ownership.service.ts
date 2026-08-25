import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../database/prisma/prisma.service';

/**
 * Verificação de posse dos recursos do control plane.
 *
 * Tudo pertence a um usuário através do projeto:
 *
 *   User → Project → DatabaseConnection → SavedQuery → Endpoint
 *                 → ApiKey → RequestLog
 *
 * Cada método faz uma consulta que já inclui o dono na condição, de modo
 * que "não existe" e "não é seu" se resolvem no mesmo lugar.
 *
 * A resposta é sempre 404, nunca 403: devolver "proibido" confirmaria a
 * existência do recurso de outro usuário.
 */
@Injectable()
export class OwnershipService {
  constructor(private readonly prisma: PrismaService) {}

  async assertProject(projectId: string, userId: string): Promise<void> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, ownerId: userId },
      select: { id: true },
    });

    if (!project) {
      throw new NotFoundException('Projeto não encontrado.');
    }
  }

  async assertConnection(connectionId: string, userId: string): Promise<void> {
    const connection = await this.prisma.databaseConnection.findFirst({
      where: { id: connectionId, project: { ownerId: userId } },
      select: { id: true },
    });

    if (!connection) {
      throw new NotFoundException('Conexão não encontrada.');
    }
  }

  async assertSavedQuery(savedQueryId: string, userId: string): Promise<void> {
    const savedQuery = await this.prisma.savedQuery.findFirst({
      where: {
        id: savedQueryId,
        connection: { project: { ownerId: userId } },
      },
      select: { id: true },
    });

    if (!savedQuery) {
      throw new NotFoundException('Consulta não encontrada.');
    }
  }

  async assertEndpoint(endpointId: string, userId: string): Promise<void> {
    const endpoint = await this.prisma.endpoint.findFirst({
      where: { id: endpointId, project: { ownerId: userId } },
      select: { id: true },
    });

    if (!endpoint) {
      throw new NotFoundException('Endpoint não encontrado.');
    }
  }

  async assertApiKey(apiKeyId: string, userId: string): Promise<void> {
    const apiKey = await this.prisma.apiKey.findFirst({
      where: { id: apiKeyId, project: { ownerId: userId } },
      select: { id: true },
    });

    if (!apiKey) {
      throw new NotFoundException('API Key não encontrada.');
    }
  }
}
