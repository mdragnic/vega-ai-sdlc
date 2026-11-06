import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    react(),
    // `?react` imports become inline SVG components; size comes from CSS, so width and height are dropped.
    svgr({ svgrOptions: { dimensions: false } }),
  ],
  // Scan every source file for dependencies at startup, not only those reachable from index.html,
  // so a module loaded later (the API client) does not make Vite re-bundle and reload the page.
  optimizeDeps: { entries: ['index.html', 'src/**/*.{ts,tsx}'] },
  server: {
    port: 5173,
    strictPort: true,
    // One origin for the browser: /api goes to the backend (#73).
    proxy: { '/api': 'http://127.0.0.1:3000' },
    fs: {
      // Setting `deny` replaces Vite's own list, so Vite 8.3.5's defaults are repeated here unchanged, and the backend's
      // data folder is added: the SQLite files and the profile photos are never served (task 029 security review). Vite
      // matches these against the file's absolute path, so the folder takes a leading `**/` (`backend/data/**` alone
      // matches nothing).
      deny: [
        '.env',
        '.env.*',
        '*.{crt,pem,key,p12,pfx,cer,der}',
        '.npmrc',
        '.yarnrc.yml',
        '**/.git/**',
        '**/backend/data/**',
      ],
    },
  },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.{ts,tsx}'],
    setupFiles: ['test/setup.ts'],
  },
});
