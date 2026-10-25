// `npm run migration:generate -- <Name>`: generates src/database/migrations/<timestamp>-<Name>.ts
// from the compiled data source in dist/ (no ts-node, see docs on TypeORM and ESM).
import { spawnSync } from 'node:child_process';

const name = process.argv[2];
if (!name || !/^[A-Za-z][A-Za-z0-9]*$/.test(name)) {
  console.error('Usage: npm run migration:generate -- <Name>   (letters and digits, e.g. CreateUsers)');
  process.exit(1);
}

const result = spawnSync(
  'npx',
  [
    'typeorm',
    'migration:generate',
    `src/database/migrations/${name}`,
    '-d',
    'dist/database/data-source.js',
    '--pretty',
  ],
  { stdio: 'inherit', shell: process.platform === 'win32' },
);
if (result.status === 0) {
  // Migrations are listed as classes (database-options.ts), so a new file runs only once listed.
  console.log(`Next: add the new ${name} class to src/database/migrations/index.ts, then run npm run format.`);
}
process.exit(result.status ?? 1);
