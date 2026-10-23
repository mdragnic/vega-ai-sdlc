import type { INestApplication } from '@nestjs/common';

/** App-level settings shared by main.ts and the tests. */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
}
