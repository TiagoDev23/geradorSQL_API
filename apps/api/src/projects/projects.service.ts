import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../database/prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ownerId: string, dto: CreateProjectDto) {
    const slug = this.normalizeSlug(dto.slug ?? dto.name);

    await this.ensureSlugAvailable(slug);

    return this.prisma.project.create({
      data: {
        name: dto.name.trim(),
        slug,
        description: dto.description?.trim(),
        ownerId,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        ownerId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /** Lista apenas os projetos do usuário autenticado. */
  async findAll(ownerId: string) {
    return this.prisma.project.findMany({
      where: {
        ownerId,
      },

      orderBy: {
        createdAt: 'desc',
      },

      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        ownerId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findOne(id: string) {
    const project = await this.prisma.project.findUnique({
      where: {
        id,
      },

      include: {
        _count: {
          select: {
            connections: true,
            endpoints: true,
            apiKeys: true,
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Projeto não encontrado.');
    }

    return project;
  }

  async update(id: string, dto: UpdateProjectDto) {
    await this.findOne(id);

    let slug: string | undefined;

    if (dto.slug) {
      slug = this.normalizeSlug(dto.slug);

      await this.ensureSlugAvailable(slug, id);
    }

    return this.prisma.project.update({
      where: {
        id,
      },

      data: {
        ...(dto.name !== undefined && {
          name: dto.name.trim(),
        }),

        ...(slug !== undefined && {
          slug,
        }),

        ...(dto.description !== undefined && {
          description: dto.description.trim(),
        }),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    await this.prisma.project.delete({
      where: {
        id,
      },
    });

    return {
      message: 'Projeto removido com sucesso.',
    };
  }

  private normalizeSlug(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private async ensureSlugAvailable(
    slug: string,
    ignoredProjectId?: string,
  ): Promise<void> {
    const existingProject = await this.prisma.project.findUnique({
      where: {
        slug,
      },

      select: {
        id: true,
      },
    });

    if (existingProject && existingProject.id !== ignoredProjectId) {
      throw new ConflictException(`Já existe um projeto com o slug "${slug}".`);
    }
  }
}
