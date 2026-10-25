import { Module } from '@nestjs/common';

import { DEMO_DATASET, loadDemoDataset } from './demo-dataset.js';
import { DemoSeeder } from './demo-seeder.js';

/** The demo dataset, read and validated once when the app starts, and its seeder (#78). */
@Module({
  providers: [{ provide: DEMO_DATASET, useFactory: () => loadDemoDataset() }, DemoSeeder],
  exports: [DemoSeeder],
})
export class DemoModule {}
