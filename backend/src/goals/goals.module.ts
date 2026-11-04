import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BankDataModule } from '../bank-data/bank-data.module.js';
import { SavingsGoal } from './savings-goal.entity.js';
import { SavingsGoalsController } from './savings-goals.controller.js';
import { SavingsGoalsService } from './savings-goals.service.js';

/** The savings goals (#18, #58): Overview's current month, and the Goals page's months (#60, #123). */
@Module({
  imports: [TypeOrmModule.forFeature([SavingsGoal]), BankDataModule],
  controllers: [SavingsGoalsController],
  providers: [SavingsGoalsService],
})
export class GoalsModule {}
