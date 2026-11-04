import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  type CategoryLimitRequest,
  type CategoryLimitResponse,
  type CategoryLimitsResponse,
  expenseCategorySchema,
  type Money,
} from '@finebank/shared';
import type { Repository } from 'typeorm';

import { CategoryLimit } from './category-limit.entity.js';

/** Integer cents in USD, the only currency (#11, #96). */
const usd = (cents: number): Money => ({ cents, currency: 'USD' });

/**
 * The spending limits of the signed-in user only, one per category for every month (#32): every query is keyed on the
 * user from the session (#39, #46). No month, so no clock and no zone.
 */
@Injectable()
export class CategoryLimitsService {
  constructor(@InjectRepository(CategoryLimit) private readonly limits: Repository<CategoryLimit>) {}

  /**
   * The six categories in the designed order (#56, #61), each with the user's limit, or `limit: null` without a row
   * (#85, #125 a). One query keyed on the user; a read never writes a row.
   */
  async list(userId: number): Promise<CategoryLimitsResponse> {
    const rows = await this.limits.findBy({ userId });
    const byCategory = new Map(rows.map((row) => [row.category, row.limitCents]));
    return {
      limits: expenseCategorySchema.options.map((category) => {
        const cents = byCategory.get(category);
        return { category, limit: cents === undefined ? null : usd(cents) };
      }),
    };
  }

  /**
   * Creates or updates the limit of the category the request names (#31, #125 b). One statement, keyed on the table's
   * unique user and category: it inserts the row, or on that conflict updates the limit, so a category never gets a
   * second row. SQLite has one connection, so no transaction stays open around it while other requests run. The amount
   * rules are the request schema's and the table's CHECK (#31).
   */
  async save(userId: number, request: CategoryLimitRequest): Promise<CategoryLimitResponse> {
    const { category } = request;
    await this.limits.upsert(
      { userId, category, limitCents: request.limit.cents },
      { conflictPaths: ['userId', 'category'], skipUpdateIfNoValuesChanged: false },
    );
    const row = await this.limits.findOneByOrFail({ userId, category });
    return { category: row.category, limit: usd(row.limitCents) };
  }
}
