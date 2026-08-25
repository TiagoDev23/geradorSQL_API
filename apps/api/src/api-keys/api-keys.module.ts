import { Module } from '@nestjs/common';

import { ApiKeysController } from './api-keys.controller';
import { ApiKeysService } from './api-keys.service';
import { ProjectApiKeysController } from './project-api-keys.controller';

@Module({
  controllers: [ProjectApiKeysController, ApiKeysController],
  providers: [ApiKeysService],
  exports: [ApiKeysService],
})
export class ApiKeysModule {}
