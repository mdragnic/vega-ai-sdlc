import { Body, Controller, Get, Put } from '@nestjs/common';
import {
  type CategoryLimitRequest,
  type CategoryLimitResponse,
  type CategoryLimitsResponse,
  categoryLimitsContract,
} from '@finebank/shared';

import { CurrentUser } from '../auth/current-user.decorator.js';
import { CategoryLimitsService } from './category-limits.service.js';

/**
 * `/api/category-limits`: the signed-in user's spending limit per category, one value for every month (#32). Behind the
 * session guard, the write guard on the save (#119) and Nest's CSRF protection (#75); the user comes from the session
 * only (#39, #46).
 */
@Controller()
export class CategoryLimitsController {
  constructor(private readonly limits: CategoryLimitsService) {}

  /** The six categories in the designed order with their limits, `null` without one (#61, #125 a). */
  @Get(categoryLimitsContract.list.path)
  list(@CurrentUser() userId: number): Promise<CategoryLimitsResponse> {
    return this.limits.list(userId);
  }

  /**
   * 200 with the saved category and limit; 400 with field errors from the shared rules before anything is stored (#31,
   * #108 a; "Enter a valid category").
   */
  @Put(categoryLimitsContract.save.path)
  save(
    @CurrentUser() userId: number,
    @Body({ schema: categoryLimitsContract.save.request }) body: CategoryLimitRequest,
  ): Promise<CategoryLimitResponse> {
    return this.limits.save(userId, body);
  }
}
