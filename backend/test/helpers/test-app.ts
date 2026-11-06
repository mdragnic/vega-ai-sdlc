import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { INestApplication, LoggerService, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';

import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { type AppConfig, readConfig } from '../../src/config/config.js';
import { PhotoStore } from '../../src/users/photo-store.js';

/** A provider of the app replaced by a test value, such as a `GoogleClient` stub. */
export interface ProviderOverride {
  provide: string | symbol | Type;
  useValue: unknown;
}

/**
 * The real app on an in-memory database with every migration applied, plus test-only controllers and provider
 * overrides. Nothing is logged unless a logger is given. Its uploads folder is a temporary folder of its own, removed
 * when the app closes (task 029), unless the config names one: tests never share or leave photos.
 */
export async function createTestApp(
  options: {
    config?: Partial<AppConfig>;
    controllers?: Type[];
    overrides?: ProviderOverride[];
    logger?: LoggerService;
  } = {},
): Promise<INestApplication> {
  const ownFolder =
    options.config?.uploadsDir === undefined ? mkdtempSync(join(tmpdir(), 'finebank-uploads-')) : undefined;
  const config = {
    ...readConfig({ NODE_ENV: 'test' }),
    databaseFile: ':memory:',
    ...(ownFolder === undefined ? {} : { uploadsDir: ownFolder }),
    ...options.config,
  };
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
  if (ownFolder !== undefined) {
    const close = app.close.bind(app);
    app.close = async () => {
      await close();
      rmSync(ownFolder, { recursive: true, force: true });
    };
  }
  return app;
}

/** The uploads folder the app's photo store writes to. */
export const uploadsFolderOf = (app: INestApplication): string => app.get(PhotoStore).folder;
