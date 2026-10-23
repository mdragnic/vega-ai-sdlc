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
  },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.{ts,tsx}'],
    setupFiles: ['test/setup.ts'],
  },
});
