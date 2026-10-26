import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SavingsGoal } from './savings-goal.entity.js';
import { SavingsGoalsController } from './savings-goals.controller.js';
import { SavingsGoalsService } from './savings-goals.service.js';

/** The savings goals (#18, #58): the Overview Goals card's month for now; the Goals page later. */
@Module({
  imports: [TypeOrmModule.forFeature([SavingsGoal])],
  controllers: [SavingsGoalsController],
  providers: [SavingsGoalsService],
})
export class GoalsModule {}
