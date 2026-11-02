import type { INestApplication } from '@nestjs/common';
import * as shared from '@finebank/shared';

/** Every contract entry of the shared API (#74): each exported `...Contract` object's entries. */
export const contractEntries = Object.entries(shared)
  .filter(([name]) => name.endsWith('Contract'))
  .flatMap(([, contract]) => Object.values(contract as Record<string, shared.ContractEntry>));

type RouteLayer = { route?: { path: string; methods: Record<string, boolean> } };

/** The routes the app has registered on Express, as `METHOD /path`, read from its router. */
export function registeredRoutes(app: INestApplication): string[] {
  const express = app.getHttpAdapter().getInstance() as { router: { stack: RouteLayer[] } };
  return express.router.stack
    .flatMap(({ route }) =>
      route === undefined
        ? []
        : Object.keys(route.methods)
            .filter((method) => method !== '_all')
            .map((method) => `${method.toUpperCase()} ${route.path}`),
    )
    .toSorted();
}
