import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './modules/health/health.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { AssetsModule } from './modules/assets/assets.module';
import { SystemModule } from './modules/system/system.module';
import { ComfyuiModule } from './modules/comfyui/comfyui.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { FeaturesModule } from './modules/features/features.module';
import { StorageModule } from './modules/storage/storage.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    StorageModule,
    HealthModule,
    FeaturesModule,
    TasksModule,
    AssetsModule,
    SystemModule,
    ComfyuiModule
  ]
})
export class AppModule {}
