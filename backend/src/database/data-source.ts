import { DataSource } from 'typeorm';

import { ensureDataDirs, loadEnvFile, readConfig } from '../config/config.js';
import { databaseOptions } from './database-options.js';

// Used by the TypeORM CLI from dist/ (`npm run migrate`, `npm run migration:generate`).
loadEnvFile();
const config = readConfig();
ensureDataDirs(config);

export default new DataSource(databaseOptions(config));
