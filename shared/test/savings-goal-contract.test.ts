import { describe, expect, it } from 'vitest';

import {
  goalMessages,
  goalMonthSchema,
  goalPresentSchema,
  goalTargetSchema,
  savingsGoalFormSchema,
  savingsGoalRequestSchema,
  savingsGoalResponseSchema,
  savingsGoalsContract,
  savingsGoalSchema,
} from '../src/index.js';

const usd = (cents: number) => ({ cents, currency: 'USD' });

/** $1,000,000,000.00, the largest goal amount (#31). */
const MAX_CENTS = 100_000_000_000;

/** The issues of a failed parse as `field: message`, one per field. */
function fieldErrors(result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) {
  expect(result.success).toBe(false);
  return result.error!.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
}

// T1, AC7 and AC12: the amount rules once, reported on the field itself (#31, #74, #85, #108 a).
describe('goalTargetSchema', () => {
  it.each([
    ['1 cent', usd(1)],
    ['$20,000.00', usd(2_000_000)],
    ['the maximum, $1,000,000,000.00', usd(MAX_CENTS)],
  ])('accepts %s', (_case, money) => {
    expect(goalTargetSchema.parse(money)).toEqual(money);
  });

  it.each([
    ['0', usd(0), goalMessages.targetPositive],
    ['one cent above the maximum', usd(MAX_CENTS + 1), goalMessages.targetMax],
    ['a negative amount', usd(-1), goalMessages.invalidAmount],
    ['cents that are not whole', usd(1.5), goalMessages.invalidAmount],
    ['cents past the safe integers', usd(Number.MAX_SAFE_INTEGER + 2), goalMessages.invalidAmount],
    ['cents as text', { cents: '2000000', currency: 'USD' }, goalMessages.invalidAmount],
    ['another currency', { cents: 2_000_000, currency: 'EUR' }, goalMessages.invalidAmount],
    ['no currency', { cents: 2_000_000 }, goalMessages.invalidAmount],
    ['a number for money', 2_000_000, goalMessages.invalidAmount],
    ['nothing', undefined, goalMessages.invalidAmount],
  ])('rejects %s with one message on the field itself', (_case, money, message) => {
    expect(fieldErrors(goalTargetSchema.safeParse(money))).toEqual([`: ${message}`]);
  });

  it('drops unknown keys of the amount', () => {
    expect(goalTargetSchema.parse({ cents: 100, currency: 'USD', userId: 7 })).toEqual(usd(100));
  });
});

describe('goalPresentSchema', () => {
  it.each([
    ['0', usd(0)],
    ['$16,250.00', usd(1_625_000)],
    ['the maximum', usd(MAX_CENTS)],
  ])('accepts %s', (_case, money) => {
    expect(goalPresentSchema.parse(money)).toEqual(money);
  });

  it.each([
    ['one cent above the maximum', usd(MAX_CENTS + 1), goalMessages.presentMax],
    ['a negative amount', usd(-1), goalMessages.invalidAmount],
    ['cents that are not whole', usd(1.5), goalMessages.invalidAmount],
    ['another currency', { cents: 0, currency: 'EUR' }, goalMessages.invalidAmount],
    ['nothing', undefined, goalMessages.invalidAmount],
  ])('rejects %s with one message on the field itself', (_case, money, message) => {
    expect(fieldErrors(goalPresentSchema.safeParse(money))).toEqual([`: ${message}`]);
  });
});

describe('goalMonthSchema', () => {
  it.each(['2026-10', '2026-01', '2026-12', '2029-01'])('accepts %j', (month) => {
    expect(goalMonthSchema.parse(month)).toBe(month);
  });

  it.each(['2026-13', '2026-00', '2026-1', '2026-10-01', 'Oct, 2026', '', 202610])('rejects %j', (month) => {
    expect(goalMonthSchema.safeParse(month).success).toBe(false);
  });
});

describe('savingsGoalRequestSchema', () => {
  const body = { month: '2026-10', target: usd(2_500_050), present: usd(0) };

  it('accepts the month, the Target and the Present', () => {
    expect(savingsGoalRequestSchema.parse(body)).toEqual(body);
  });

  it('drops unknown keys, so a userId in the body has no effect', () => {
    expect(savingsGoalRequestSchema.parse({ ...body, userId: 2, id: 9 })).toEqual(body);
  });

  it('accepts a Present above the Target (#31)', () => {
    expect(savingsGoalRequestSchema.parse({ ...body, present: usd(3_000_000) }).present).toEqual(usd(3_000_000));
  });

  it('reports each field once, with its first failing rule', () => {
    expect(
      fieldErrors(savingsGoalRequestSchema.safeParse({ month: '2026-13', target: usd(0), present: usd(-5) })),
    ).toEqual([
      `month: ${goalMessages.invalidMonth}`,
      `target: ${goalMessages.targetPositive}`,
      `present: ${goalMessages.invalidAmount}`,
    ]);
  });

  it.each([
    ['month', { target: usd(1), present: usd(0) }],
    ['target', { month: '2026-10', present: usd(0) }],
    ['present', { month: '2026-10', target: usd(1) }],
  ])('rejects a body without %s', (field, partial) => {
    expect(fieldErrors(savingsGoalRequestSchema.safeParse(partial))).toHaveLength(1);
    expect(fieldErrors(savingsGoalRequestSchema.safeParse(partial))[0]).toMatch(new RegExp(`^${field}: `));
  });
});

// T2, AC6, AC7 and AC10: the popup's two texts to the request amounts, through the same rules (#64, #84, #108 a).
/** The popup's two texts through the form schema. */
const parse = (target: string, present: string) => savingsGoalFormSchema.safeParse({ target, present });

describe('savingsGoalFormSchema', () => {
  it.each([
    ['0.01', '', usd(1), usd(0)],
    ['1000000000', '', usd(MAX_CENTS), usd(0)],
    ['25000.5', '', usd(2_500_050), usd(0)],
    ['500', '', usd(50_000), usd(0)],
    ['20000', '25000', usd(2_000_000), usd(2_500_000)],
    ['20000', '.', usd(2_000_000), usd(0)],
    ['20000', '1000000000', usd(2_000_000), usd(MAX_CENTS)],
  ])('reads Target %j and Present %j as integer cents in USD', (target, present, targetMoney, presentMoney) => {
    expect(parse(target, present)).toEqual({ success: true, data: { target: targetMoney, present: presentMoney } });
  });

  it.each([
    ['', goalMessages.targetRequired],
    ['.', goalMessages.targetRequired],
    ['0', goalMessages.targetPositive],
    ['0.00', goalMessages.targetPositive],
    ['1000000000.01', goalMessages.targetMax],
    // Too long for exact cents: far above the maximum.
    ['99999999999999999999', goalMessages.targetMax],
  ])('rejects Target %j with its message', (target, message) => {
    expect(fieldErrors(parse(target, ''))).toEqual([`target: ${message}`]);
  });

  it.each([
    ['1000000000.01', goalMessages.presentMax],
    ['99999999999999999999', goalMessages.presentMax],
  ])('rejects Present %j with its message', (present, message) => {
    expect(fieldErrors(parse('20000', present))).toEqual([`present: ${message}`]);
  });

  it('reports both fields at once', () => {
    expect(fieldErrors(parse('', '1000000000.01'))).toEqual([
      `target: ${goalMessages.targetRequired}`,
      `present: ${goalMessages.presentMax}`,
    ]);
  });

  it.each(['1,000', '$5', '-5', 'abc', '1.234', ' 5'])('rejects text no amount field lets stand: %j', (text) => {
    expect(fieldErrors(parse(text, ''))).toEqual([`target: ${goalMessages.invalidAmount}`]);
  });
});

// T3, AC11: the current goal, or none (#58, #85).
describe('savingsGoalResponseSchema', () => {
  const goal = { target: usd(2_000_000), present: usd(1_625_000), progress: 0.8125 };

  it.each([
    ['a goal', { month: '2026-10', goal }],
    ['no goal', { month: '2026-10', goal: null }],
    ['progress 0', { month: '2026-10', goal: { ...goal, present: usd(0), progress: 0 } }],
    ['progress 1', { month: '2026-10', goal: { ...goal, present: usd(2_500_000), progress: 1 } }],
  ])('accepts %s', (_case, body) => {
    expect(savingsGoalResponseSchema.parse(body)).toEqual(body);
  });

  it.each([
    ['progress below 0', { month: '2026-10', goal: { ...goal, progress: -0.1 } }],
    ['progress above 1', { month: '2026-10', goal: { ...goal, progress: 1.1 } }],
    ['a float amount', { month: '2026-10', goal: { ...goal, present: usd(16_250.5) } }],
    ['no goal key', { month: '2026-10' }],
    ['no month', { goal }],
    ['a month that does not exist', { month: '2026-13', goal }],
  ])('rejects %s', (_case, body) => {
    expect(savingsGoalResponseSchema.safeParse(body).success).toBe(false);
  });

  it('builds the goal from savingsGoalSchema', () => {
    expect(savingsGoalSchema.parse(goal)).toEqual(goal);
  });
});

describe('savingsGoalsContract', () => {
  it('reads the current goal with GET /savings-goals/current and no body', () => {
    expect(savingsGoalsContract.current).toMatchObject({
      method: 'GET',
      path: '/savings-goals/current',
      request: undefined,
    });
    expect(savingsGoalsContract.current.response).toBe(savingsGoalResponseSchema);
  });

  it('saves with PUT /savings-goals, the request schema and the same response', () => {
    expect(savingsGoalsContract.save).toMatchObject({ method: 'PUT', path: '/savings-goals' });
    expect(savingsGoalsContract.save.request).toBe(savingsGoalRequestSchema);
    expect(savingsGoalsContract.save.response).toBe(savingsGoalResponseSchema);
  });
});

describe('goalMessages', () => {
  it('holds the texts of #108 a and d', () => {
    expect(goalMessages).toEqual({
      targetRequired: 'Target Amount is required',
      targetPositive: 'Target Amount must be greater than $0.00',
      targetMax: 'Target Amount must be at most $1,000,000,000.00',
      presentMax: 'Present Amount must be at most $1,000,000,000.00',
      invalidAmount: 'Enter a valid amount',
      invalidMonth: 'Enter a valid month',
      monthEnded: 'This month has ended. Reload the page to see the current month.',
    });
  });
});
