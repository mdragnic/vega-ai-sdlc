import type { INestApplication } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

/** App-level settings shared by main.ts and the tests. */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  // Authenticated financial data never stays in a browser or proxy cache (task 016 gate). Set here once, before any
  // other middleware, the CSRF check and the routes, so every /api response carries it: errors and redirects too.
  app.use('/api', (_request: Request, response: Response, next: NextFunction) => {
    response.setHeader('Cache-Control', 'no-store');
    next();
  });
  // Nest's built-in CSRF protection (#75): Fetch Metadata with an Origin/Host fallback. Requests
  // that change data from another site get 403 before any route runs; GET, HEAD and OPTIONS pass.
  app.enableCsrfProtection();
}
