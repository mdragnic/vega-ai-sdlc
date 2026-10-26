import type { INestApplication, LoggerService, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';

import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { type AppConfig, readConfig } from '../../src/config/config.js';

/** A provider of the app replaced by a test value, such as a `GoogleClient` stub. */
export interface ProviderOverride {
  provide: string | symbol | Type;
  useValue: unknown;
}

/**
 * The real app on an in-memory database with every migration applied, plus test-only controllers and provider
 * overrides. Nothing is logged unless a logger is given.
 */
export async function createTestApp(
  options: {
    config?: Partial<AppConfig>;
    controllers?: Type[];
    overrides?: ProviderOverride[];
    logger?: LoggerService;
  } = {},
): Promise<INestApplication> {
  const config = { ...readConfig({ NODE_ENV: 'test' }), databaseFile: ':memory:', ...options.config };
  const builder = Test.createTestingModule({
    imports: [AppModule.forRoot(config)],
    controllers: options.controllers ?? [],
  });
  for (const { provide, useValue } of options.overrides ?? []) {
    builder.overrideProvider(provide).useValue(useValue);
  }
  const moduleRef = await builder.compile();
  await moduleRef.get(DataSource).runMigrations();
  const app = moduleRef.createNestApplication({ logger: options.logger ?? false });
  configureApp(app);
  await app.init();
  return app;
}
