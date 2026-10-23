import { ensureDataDirs, loadEnvFile, readConfig } from '../config/config.js';
import { resetDatabase } from './reset-database.js';

// Run by the e2e web server before the backend starts (`npm run start:e2e`).
loadEnvFile();
const config = readConfig();
ensureDataDirs(config);
await resetDatabase(config);
