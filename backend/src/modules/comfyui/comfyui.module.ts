import { Module } from '@nestjs/common';
import { ComfyuiService } from './comfyui.service';

@Module({
  providers: [ComfyuiService],
  exports: [ComfyuiService]
})
export class ComfyuiModule {}
