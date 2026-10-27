import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Bill } from './bill.entity.js';
import { BillsController } from './bills.controller.js';
import { BillsService } from './bills.service.js';

/** The bills (#28, #41): the Overview Upcoming Bill card for now; the Bills page later (task 023). */
@Module({
  imports: [TypeOrmModule.forFeature([Bill])],
  controllers: [BillsController],
  providers: [BillsService],
})
export class BillsModule {}
