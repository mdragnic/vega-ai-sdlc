import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import { ensureDataDirs, loadEnvFile, readConfig } from './config/config.js';

// Loopback only: the browser reaches the API through the Vite proxy (#73), so nothing else needs it,
// and the test-only clock route never becomes reachable from the network.
const host = '127.0.0.1';
const port = 3000;

loadEnvFile();
const config = readConfig();
ensureDataDirs(config);

const app = await NestFactory.create(AppModule.forRoot(config));
configureApp(app);
await app.listen(port, host);
