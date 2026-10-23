import type { INestApplication, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { type AppConfig, readConfig } from '../../src/config/config.js';

/** The real app on an in-memory database, plus test-only controllers. */
export async function createTestApp(
  options: { config?: Partial<AppConfig>; controllers?: Type[] } = {},
): Promise<INestApplication> {
  const config = { ...readConfig({ NODE_ENV: 'test' }), databaseFile: ':memory:', ...options.config };
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.forRoot(config)],
    controllers: options.controllers ?? [],
  }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app);
  await app.init();
  return app;
}
