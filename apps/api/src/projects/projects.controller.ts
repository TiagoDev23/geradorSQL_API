import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';

import { CurrentUserId } from '../auth/current-user.decorator';
import { OwnershipService } from '../common/ownership/ownership.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectsService } from './projects.service';

@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly ownership: OwnershipService,
  ) {}

  @Post()
  create(@CurrentUserId() userId: string, @Body() dto: CreateProjectDto) {
    // O dono vem do token, nunca do corpo da requisição.
    return this.projectsService.create(userId, dto);
  }

  @Get()
  findAll(@CurrentUserId() userId: string) {
    return this.projectsService.findAll(userId);
  }

  @Get(':id')
  async findOne(
    @CurrentUserId() userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.ownership.assertProject(id, userId);

    return this.projectsService.findOne(id);
  }

  @Patch(':id')
  async update(
    @CurrentUserId() userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    await this.ownership.assertProject(id, userId);

    return this.projectsService.update(id, dto);
  }

  @Delete(':id')
  async remove(
    @CurrentUserId() userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.ownership.assertProject(id, userId);

    return this.projectsService.remove(id);
  }
}
