/**
 * The one place E2E time and zone are fixed (#80). FIXED_NOW is the "What a first login
 * shows" date in docs/spec/demo-data.md; the backend clock starts at the same instant.
 */
export const FIXED_NOW = '2026-10-22T10:00:00Z';
export const TIME_ZONE = 'Europe/Belgrade';

export const VIEWPORT = { width: 1440, height: 1024 } as const;
export const FRONTEND_URL = 'http://localhost:5173';
export const BACKEND_PORT = 3000;
export const FRONTEND_PORT = 5173;
