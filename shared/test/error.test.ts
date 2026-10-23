import { describe, expect, it } from 'vitest';

import { errorResponseSchema } from '../src/index.js';

// T4: the one error shape every endpoint returns (#74).
describe('errorResponseSchema', () => {
  it('accepts a message only', () => {
    expect(errorResponseSchema.parse({ message: 'Not found' })).toEqual({ message: 'Not found' });
  });

  it('accepts a message with field errors', () => {
    const body = { message: 'Validation failed', fieldErrors: { email: 'Email is required' } };

    expect(errorResponseSchema.parse(body)).toEqual(body);
  });

  it('rejects a body without a message', () => {
    expect(errorResponseSchema.safeParse({ fieldErrors: { email: 'Email is required' } }).success).toBe(false);
  });
});
