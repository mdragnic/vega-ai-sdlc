import { type DynamicModule, Module } from '@nestjs/common';

import type { AppConfig } from '../config/config.js';
import { PhotoStore } from './photo-store.js';
import { ProfileController } from './profile.controller.js';
import { UsersService } from './users.service.js';

/** The users and their profile (US-18), with the profile photos' folder from the config (#76, task 029). */
@Module({})
export class UsersModule {
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: UsersModule,
      controllers: [ProfileController],
      providers: [UsersService, { provide: PhotoStore, useFactory: () => new PhotoStore(config.uploadsDir) }],
      exports: [UsersService],
    };
  }
}
