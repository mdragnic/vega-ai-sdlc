import { Module } from '@nestjs/common';

import { ProfileController } from './profile.controller.js';
import { UsersService } from './users.service.js';

@Module({
  controllers: [ProfileController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
