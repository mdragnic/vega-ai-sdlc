import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BankDataModule } from '../bank-data/bank-data.module.js';
import { GoalMonths } from './goal-months.js';
import { SavingSummaryController } from './saving-summary.controller.js';
import { SavingSummaryService } from './saving-summary.service.js';
import { SavingsGoal } from './savings-goal.entity.js';
import { SavingsGoalsController } from './savings-goals.controller.js';
import { SavingsGoalsService } from './savings-goals.service.js';

/**
 * The Goals reads and writes: the savings goals (#18, #58), Overview's current month and the Goals page's months (#60,
 * #123), and the Saving Summary's savings per day (#42, #59), both on one month range, `GoalMonths`.
 */
@Module({
  imports: [TypeOrmModule.forFeature([SavingsGoal]), BankDataModule],
  controllers: [SavingsGoalsController, SavingSummaryController],
  providers: [GoalMonths, SavingsGoalsService, SavingSummaryService],
})
export class GoalsModule {}
