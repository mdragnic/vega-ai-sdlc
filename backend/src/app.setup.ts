import type { INestApplication } from '@nestjs/common';

/** App-level settings shared by main.ts and the tests. */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  // Nest's built-in CSRF protection (#75): Fetch Metadata with an Origin/Host fallback. Requests
  // that change data from another site get 403 before any route runs; GET, HEAD and OPTIONS pass.
  app.enableCsrfProtection();
}
