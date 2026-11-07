import { describe, expect, it } from 'vitest';
import type { z } from 'zod';

import {
  countryCallingCodes,
  phoneCountryCodeSchema,
  phoneNumberSchema,
  profileContract,
  profileMessages,
  profileSchema,
  profileUpdateRequestSchema,
} from '../src/index.js';

/** The messages a value fails with, one per issue; empty when it passes. */
function messages(schema: z.ZodType, value: unknown): string[] {
  const result = schema.safeParse(value);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

/** Field name to messages, as the backend's field errors show them. */
function fieldMessages(schema: z.ZodType, value: unknown): Record<string, string[]> {
  const result = schema.safeParse(value);
  const fields: Record<string, string[]> = {};
  for (const issue of result.success ? [] : result.error.issues) {
    (fields[issue.path.join('.')] ??= []).push(issue.message);
  }
  return fields;
}

const digits = 'Phone Number can only contain digits';
const tooLong = 'Phone Number must be at most 15 digits';

// Task 028 T1: the Phone Number (#33, #126 c as answered): trimmed, spaces and hyphens removed, then empty (no number)
// or 1 to 15 digits; the output digits only.
describe('phoneNumberSchema', () => {
  it.each([
    ['empty', '', ''],
    ['only spaces', '  ', ''],
    ['a hyphen between spaces', ' - ', ''],
    ['digits', '5154758868', '5154758868'],
    ['111’s sample, with a space', '51547 58868', '5154758868'],
    ['a hyphen inside', '5154-758868', '5154758868'],
    ['a hyphen and a space', '064-123 4567', '0641234567'],
    ['15 digits with spaces between them', '1 2 3 4 5 6 7 8 9 0 1 2 3 4 5', '123456789012345'],
    ['spaces around digits', ' 123 ', '123'],
    ['one digit', '7', '7'],
  ])('accepts %s, the output %j', (_case, value, output) => {
    expect(phoneNumberSchema.parse(value)).toBe(output);
  });

  it.each([
    ['a letter', '12a', digits],
    ['a plus', '+381', digits],
    ['a dot', '064.123', digits],
    ['a slash', '064/123', digits],
    ['a no-break space inside', '064\u00A0123', digits],
    ['a tab inside', '064\t123', digits],
    ['16 digits', '1234567890123456', tooLong],
    ['16 digits with hyphens', '1234-5678-9012-3456', tooLong],
  ])('rejects %s with only its message', (_case, value, message) => {
    expect(messages(phoneNumberSchema, value)).toEqual([message]);
  });

  it('names its texts', () => {
    expect(profileMessages.phoneDigits).toBe(digits);
    expect(profileMessages.phoneMax).toBe(tooLong);
  });
});

// Task 028 T1: the country code is one of the list (#43, #126 d), anything else "Choose a country code".
describe('phoneCountryCodeSchema', () => {
  it('accepts every listed code as it is', () => {
    for (const code of countryCallingCodes) expect(phoneCountryCodeSchema.parse(code)).toBe(code);
  });

  it.each(['+0', '880', '+1234', '+880 ', '', '+800'])('rejects %j with "Choose a country code"', (value) => {
    expect(messages(phoneCountryCodeSchema, value)).toEqual(['Choose a country code']);
  });
});

const valid = { fullName: 'Tanzir Rahman', username: 'tanzir.rahman', phoneCountryCode: '+880', phoneNumber: '' };

// Task 028 T1: the request of `PATCH /api/profile`: exactly the four editable fields, all required, the shared rules.
describe('profileUpdateRequestSchema', () => {
  it('gives the trimmed values, the number digits only', () => {
    expect(
      profileUpdateRequestSchema.parse({
        fullName: '  New Name  ',
        username: ' new.name ',
        phoneCountryCode: '+880',
        phoneNumber: ' 51547-58868 ',
      }),
    ).toEqual({ fullName: 'New Name', username: 'new.name', phoneCountryCode: '+880', phoneNumber: '5154758868' });
  });

  it('drops every key that is not one of the four', () => {
    expect(
      profileUpdateRequestSchema.parse({
        ...valid,
        email: 'other@example.com',
        password: 'abcdef12',
        passwordHash: 'x',
        id: 1,
        userId: 2,
        photoUrl: '/x.png',
      }),
    ).toEqual(valid);
  });

  it('gives each failing field its first message', () => {
    expect(
      fieldMessages(profileUpdateRequestSchema, {
        fullName: 'A\tB',
        username: 'Marko',
        phoneCountryCode: '880',
        phoneNumber: '12a',
      }),
    ).toEqual({
      fullName: ['Name cannot contain tabs or line breaks'],
      username: ['Username can only contain lowercase letters, numbers, dots and underscores'],
      phoneCountryCode: ['Choose a country code'],
      phoneNumber: [digits],
    });
  });

  it('requires every part: a missing one fails under its field', () => {
    expect(Object.keys(fieldMessages(profileUpdateRequestSchema, {})).toSorted()).toEqual([
      'fullName',
      'phoneCountryCode',
      'phoneNumber',
      'username',
    ]);
    expect(fieldMessages(profileUpdateRequestSchema, {}).username).toEqual(['Username is required']);
  });

  it('refuses a part sent twice (an array) under its field', () => {
    expect(Object.keys(fieldMessages(profileUpdateRequestSchema, { ...valid, username: ['a.b.c', 'd.e.f'] }))).toEqual([
      'username',
    ]);
  });
});

// Task 028 T1 (#126 a's condition): the profile response shows any stored name; its keys are the five fields. Task 030
// T1: and `hasPassword` (#2).
describe('profileSchema', () => {
  const stored = {
    fullName: 'Tanzir Rahman',
    email: 'tanzir@example.com',
    username: 'tanzir',
    phoneCountryCode: '+1',
    hasPassword: true,
  };

  it.each([
    ['a tab', 'A\tB'],
    ['only a zero-width space', '\u200B'],
    ['101 letters', 'a'.repeat(101)],
  ])('accepts a stored Full name with %s, unchanged', (_case, fullName) => {
    const profile = { ...stored, fullName, phoneNumber: '' };

    expect(profileSchema.parse(profile)).toEqual(profile);
  });

  // Changed by task 029 (#128 c): the five fields, and `photoUpdatedAt` only when a photo is stored. Task 030: and
  // `hasPassword`.
  it('has the six keys without a photo and seven with one', () => {
    const withoutPhoto = { ...stored, phoneNumber: '' };
    const withPhoto = { ...withoutPhoto, photoUpdatedAt: '2026-10-22T10:00:00.000Z' };

    expect(Object.keys(profileSchema.shape).toSorted()).toEqual([
      'email',
      'fullName',
      'hasPassword',
      'phoneCountryCode',
      'phoneNumber',
      'photoUpdatedAt',
      'username',
    ]);
    expect(Object.keys(profileSchema.parse(withoutPhoto)).toSorted()).toEqual([
      'email',
      'fullName',
      'hasPassword',
      'phoneCountryCode',
      'phoneNumber',
      'username',
    ]);
    expect(profileSchema.parse(withPhoto)).toEqual(withPhoto);
    expect(profileSchema.safeParse({ ...withoutPhoto, photoUpdatedAt: '2026-10-22 10:00' }).success).toBe(false);
  });

  // Task 030 T1 (#2): whether the user has a password, so the Security tab knows to show its section.
  it.each([true, false])('gives hasPassword %s as it is', (hasPassword) => {
    expect(profileSchema.parse({ ...stored, phoneNumber: '', hasPassword }).hasPassword).toBe(hasPassword);
  });

  it.each([
    ['missing', undefined],
    ['a string', 'true'],
    ['a number', 1],
    ['null', null],
  ])('refuses hasPassword %s', (_case, hasPassword) => {
    expect(fieldMessages(profileSchema, { ...stored, phoneNumber: '', hasPassword })).toHaveProperty(['hasPassword']);
  });
});

// Task 029 T2: the request's optional photo, by the shared photo rule (#74, #76); without it, task 028's request.
/** A PNG's signature and a byte, named .jpg: the rule reads only the first bytes. */
const png = () => new File([Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])], 'x.jpg');

describe('profileUpdateRequestSchema photo', () => {
  it('gives the photo with its detected type next to the four fields', async () => {
    const photo = png();

    expect(await profileUpdateRequestSchema.parseAsync({ ...valid, photo })).toEqual({
      ...valid,
      photo: { file: photo, mimeType: 'image/png' },
    });
  });

  it('leaves the photo out when none is sent', async () => {
    expect(await profileUpdateRequestSchema.parseAsync(valid)).toEqual(valid);
    expect('photo' in (await profileUpdateRequestSchema.parseAsync(valid))).toBe(false);
  });

  it.each<[string, unknown]>([
    ['a string', 'data:image/png;base64,iVBORw0KGgo='],
    ['two values (a text part and a file part)', ['x', png()]],
    ['two files', [png(), png()]],
    ['a file that is not an image', new File(['hello'], 'x.png', { type: 'image/png' })],
  ])('fails under photo for %s, with the rule’s text', async (_case, photo) => {
    const result = await profileUpdateRequestSchema.safeParseAsync({ ...valid, photo });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => [issue.path.join('.'), issue.message])).toEqual([
      ['photo', 'Photo must be a JPG or PNG file'],
    ]);
  });

  it('answers every failing field at once, the photo with the text fields', async () => {
    const result = await profileUpdateRequestSchema.safeParseAsync({ ...valid, username: 'Ab', photo: 'x' });

    expect(result.error?.issues.map((issue) => issue.path.join('.')).toSorted()).toEqual(['photo', 'username']);
  });
});

// Task 028 T1: the two endpoints exist once in the contract (#74), the update multipart (#76). Task 029 T2: the update's
// one file part, `photo`, and the photo's read, a file, not JSON.
describe('profileContract', () => {
  it('declares the read and the multipart update of /profile', () => {
    expect(profileContract.get).toMatchObject({ method: 'GET', path: '/profile', request: undefined });
    expect(profileContract.get.response).toBe(profileSchema);
    expect(profileContract.update).toMatchObject({ method: 'PATCH', path: '/profile', encoding: 'multipart' });
    expect(profileContract.update.request).toBe(profileUpdateRequestSchema);
    expect(profileContract.update.response).toBe(profileSchema);
    expect('encoding' in profileContract.get).toBe(false);
  });

  it('names the update’s one file part photo', () => {
    expect(profileContract.update.filePart).toBe('photo');
    expect('filePart' in profileContract.get).toBe(false);
  });

  it('declares GET /profile/photo with no body, no query, no parameters, answering a file', () => {
    expect(profileContract.photo).toMatchObject({
      method: 'GET',
      path: '/profile/photo',
      request: undefined,
      responseEncoding: 'file',
    });
    expect('query' in profileContract.photo).toBe(false);
    expect('params' in profileContract.photo).toBe(false);
    expect('responseEncoding' in profileContract.get).toBe(false);
  });
});
