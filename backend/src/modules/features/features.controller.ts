import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { FeaturesService } from './features.service';
import { TasksService } from '../tasks/tasks.service';
import { CreateFeatureTaskDto } from './dto/create-feature-task.dto';

@Controller('features')
export class FeaturesController {
  constructor(
    private readonly featuresService: FeaturesService,
    private readonly tasksService: TasksService
  ) {}

  @Get()
  findAll() {
    return this.featuresService.findAll();
  }

  @Get(':code')
  findOne(@Param('code') code: string) {
    return this.featuresService.findOne(code);
  }

  @Post(':code/tasks')
  createTask(@Param('code') code: string, @Body() dto: CreateFeatureTaskDto) {
    return this.tasksService.createForFeature(code, dto);
  }
}
