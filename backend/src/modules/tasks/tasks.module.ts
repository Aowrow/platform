import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { ComfyuiModule } from '../comfyui/comfyui.module';
import { AssetsModule } from '../assets/assets.module';

@Module({
  imports: [ComfyuiModule, AssetsModule],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService]
})
export class TasksModule {}
