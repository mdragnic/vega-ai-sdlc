import type { INestApplication, LoggerService, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';

import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { type AppConfig, readConfig } from '../../src/config/config.js';

/**
 * The real app on an in-memory database with every migration applied, plus test-only controllers.
 * Nothing is logged unless a logger is given.
 */
export async function createTestApp(
  options: { config?: Partial<AppConfig>; controllers?: Type[]; logger?: LoggerService } = {},
): Promise<INestApplication> {
  const config = { ...readConfig({ NODE_ENV: 'test' }), databaseFile: ':memory:', ...options.config };
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.forRoot(config)],
    controllers: options.controllers ?? [],
  }).compile();
  await moduleRef.get(DataSource).runMigrations();
  const app = moduleRef.createNestApplication({ logger: options.logger ?? false });
  configureApp(app);
  await app.init();
  return app;
}
