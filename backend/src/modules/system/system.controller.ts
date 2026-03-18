import { Controller, Get } from '@nestjs/common';
import { SystemService } from './system.service';

@Controller('system/configs')
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  @Get()
  getConfigs() {
    return this.systemService.getConfigs();
  }
}
