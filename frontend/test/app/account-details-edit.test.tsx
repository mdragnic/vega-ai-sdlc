import type { CurrentUser } from '@finebank/shared';
import { focusManager } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import inputStyles from '../../src/components/Input/Input.module.css';
import {
  accountDetails,
  accountHistory,
  accountsBackend,
  demoAccountDetails,
  type DetailsWrite,
  me,
  renderApp,
  signedInDefaults,
  signedInUser,
  today,
  updateAccountDetails,
} from '../support/app';

const server = setupServer(...signedInDefaults());

/** Every request under `/api` sent: its method and path with the query. */
let sent: string[] = [];

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
beforeEach(() => {
  sent = [];
  server.events.on('request:start', ({ request }) => {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) sent.push(`${request.method} ${url.pathname}${url.search}`);
  });
});
afterEach(() => {
  server.resetHandlers();
  server.events.removeAllListeners();
  vi.restoreAllMocks();
  focusManager.setFocused(undefined);
});
afterAll(() => server.close());

const usd = (cents: number) => ({ cents, currency: 'USD' as const });

/**
 * Account Details at `path` signed in, with `handlers` first (the demo by default), once "Edit Details" and the history
 * show. In StrictMode, as the app runs in development and e2e.
 */
async function openAccount(path = '/balances/2', ...handlers: Parameters<typeof server.use>) {
  server.use(me.signedIn(), today.answers(), ...handlers);
  const view = renderApp(path, undefined, { strict: true });
  await within(await screen.findByRole('region', { name: 'Account Details' })).findByRole('button', {
    name: 'Edit Details',
  });
  await within(screen.getByRole('region', { name: 'Transactions History' })).findByRole('table');
  return view;
}

const detailsRegion = () => screen.getByRole('region', { name: 'Account Details' });
const historyRegion = () => screen.getByRole('region', { name: 'Transactions History' });
const editButton = () => within(detailsRegion()).getByRole('button', { name: 'Edit Details' });
const queryEditButton = () => within(detailsRegion()).queryByRole('button', { name: 'Edit Details' });
const bankName = () => within(detailsRegion()).getByRole('textbox', { name: 'Bank Name' });
const branchName = () => within(detailsRegion()).getByRole('textbox', { name: 'Branch Name' });
const accountType = () => within(detailsRegion()).getByRole('combobox', { name: 'Account Type' });
const saveButton = () => within(detailsRegion()).getByRole('button', { name: 'Save' });
const cancelButton = () => within(detailsRegion()).getByRole('button', { name: 'Cancel' });
const removeButton = () => within(detailsRegion()).getByRole('button', { name: 'Remove' });
const loadMore = () => within(historyRegion()).getByRole('button', { name: 'Load More' });
const search = () => screen.getByRole('searchbox', { name: 'Search' });
const patches = () => sent.filter((request) => request.startsWith('PATCH '));

/** Each label of the details card with its value, in reading order (view mode, and the read-only values in edit mode). */
const readOut = () =>
  within(detailsRegion())
    .getAllByRole('term')
    .map((term) => [term.textContent, term.nextElementSibling?.textContent]);

/** Checking's details as shown (task 021 AC2). */
const checkingReadOut = [
  ['Bank Name', 'AB Bank Ltd'],
  ['Account Type', 'Checking'],
  ['Balance', '$33,362.48'],
  ['Branch Name', 'Park Street Branch'],
  ['Account Number', '**** **** **** 7310'],
];

/** The border box around an `Input` field: red while it shows an error (#87 b). */
const fieldBox = (field: HTMLElement) => field.parentElement!;

/** Replaces a field's text, as a paste, so a tab or a space reaches it as typed. */
async function replaceText(user: ReturnType<typeof renderApp>['user'], field: HTMLElement, text: string) {
  await user.clear(field);
  if (text) {
    await user.click(field);
    await user.paste(text);
  }
}

/** Opens the Account Type list and picks `label`. */
async function chooseType(user: ReturnType<typeof renderApp>['user'], label: string) {
  await user.click(accountType());
  await user.click(await screen.findByRole('option', { name: label }));
  await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
}

/** Edit mode by a click on "Edit Details". */
async function edit(user: ReturnType<typeof renderApp>['user']) {
  await user.click(editButton());
  await waitFor(() => expect(bankName()).toHaveFocus());
}

const refocusWindow = () =>
  act(() => {
    focusManager.setFocused(false);
    focusManager.setFocused(true);
  });

/** Gives the app time to act on an answer it might act on wrongly. */
const settle = () => new Promise((done) => setTimeout(done, 50));

/** Records every text added under `document.body` from now on, until `stop` is called. */
function recordAddedText() {
  const texts: string[] = [];
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) texts.push(node.textContent ?? '');
      if (mutation.type === 'characterData') texts.push(mutation.target.textContent ?? '');
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  return {
    texts,
    stop: () => {
      for (const mutation of observer.takeRecords()) {
        for (const node of mutation.addedNodes) texts.push(node.textContent ?? '');
      }
      observer.disconnect();
    },
  };
}

// T12: AC1, AC2 and AC16, "Edit Details" and edit mode (#26, #60, #87).
describe('"Edit Details"', () => {
  // Task 032 (#133, #134 c): "Remove" after it is a button shown disabled, where it was hidden visual-only text.
  it('is a button between the search field and "Remove", then "Load More", in the Tab order; "Remove" shown disabled', async () => {
    const { user } = await openAccount();

    search().focus();
    await user.tab();
    expect(editButton()).toHaveFocus();
    await user.tab();
    expect(removeButton()).toHaveFocus();
    await user.tab();
    expect(loadMore()).toHaveFocus();
    expect(removeButton()).toHaveAttribute('aria-disabled', 'true');
    expect(removeButton()).toHaveAccessibleDescription('Not available');
  });

  it('opens edit mode on a click: the fields prefilled and named by their labels, focus in Bank Name, no request', async () => {
    const { user } = await openAccount();
    const before = sent.length;

    await user.click(editButton());

    await waitFor(() => expect(bankName()).toHaveFocus());
    expect(bankName()).toHaveValue('AB Bank Ltd');
    expect(branchName()).toHaveValue('Park Street Branch');
    expect(accountType()).toHaveTextContent('Checking');
    expect(readOut()).toEqual([
      ['Balance', '$33,362.48'],
      ['Account Number', '**** **** **** 7310'],
    ]);
    expect(saveButton()).toHaveAttribute('type', 'submit');
    expect(cancelButton()).toBeInTheDocument();
    expect(queryEditButton()).toBeNull();
    // Task 032 (#134 c): in edit mode too, "Remove" is a button shown disabled, where it was hidden and inert.
    expect(removeButton()).toHaveAttribute('type', 'button');
    expect(removeButton()).toHaveAttribute('aria-disabled', 'true');
    expect(removeButton()).toHaveAccessibleDescription('Not available');
    expect(removeButton().closest('[aria-hidden="true"], [inert]')).toBeNull();
    expect(sent.slice(before)).toEqual([]);
  });

  it.each([
    ['Enter', '{Enter}'],
    ['Space', ' '],
  ])('opens edit mode with %s on the button, focus in Bank Name', async (_key, keys) => {
    const { user } = await openAccount();
    search().focus();
    await user.tab();

    await user.keyboard(keys);

    await waitFor(() => expect(bankName()).toHaveFocus());
    expect(saveButton()).toBeInTheDocument();
  });

  it('lists the five types in order with the current one selected; a choice closes the list and shows', async () => {
    const { user } = await openAccount();
    await edit(user);

    await user.click(accountType());

    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Credit Card',
      'Checking',
      'Savings',
      'Investment',
      'Loan',
    ]);
    expect(screen.getByRole('option', { name: 'Checking' })).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByRole('option', { name: 'Savings' }));
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
    await waitFor(() => expect(accountType()).toHaveTextContent('Savings'));
  });

  it('closes only the list on Escape with the list open: edit mode stays, focus back on the select', async () => {
    const { user } = await openAccount();
    await edit(user);
    await user.click(accountType());
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
    await waitFor(() => expect(accountType()).toHaveFocus());
    expect(bankName()).toHaveValue('AB Bank Ltd');
    expect(saveButton()).toBeInTheDocument();
    expect(queryEditButton()).toBeNull();
  });

  it('focuses the select on a click on its "Account Type" label, the list staying closed', async () => {
    const { user } = await openAccount();
    await edit(user);

    await user.click(within(detailsRegion()).getByText('Account Type', { selector: 'label' }));

    expect(accountType()).toHaveFocus();
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  // Task 032 (#134 c): "Remove" after Cancel.
  it('tabs Bank Name, Account Type, Branch Name, Save, Cancel, "Remove", then "Load More"', async () => {
    const { user } = await openAccount();
    await edit(user);

    for (const next of [accountType, branchName, saveButton, cancelButton, removeButton, loadMore]) {
      await user.tab();
      expect(next()).toHaveFocus();
    }
  });

  it('does nothing on a click, Enter or Space on "Remove" in edit mode: the form kept, focus on it', async () => {
    const { user, url } = await openAccount();
    await edit(user);
    await user.clear(bankName());
    await user.type(bankName(), 'Typed Bank');
    const before = sent.length;

    await user.click(removeButton());
    await user.keyboard('{Enter}');
    await user.keyboard(' ');

    expect(url()).toBe('/balances/2');
    expect(removeButton()).toHaveFocus();
    expect(bankName()).toHaveValue('Typed Bank');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(sent.slice(before)).toEqual([]);
  });
});

/** A long name: 101 letters. */
const letters101 = 'B'.repeat(101);
/** A letter beyond the BMP: one code point, two UTF-16 code units. */
const doubleStruck = '\u{1D538}';
const family = '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}';

/** Names the shared rule refuses, as a field can hold them, with the rule's message for the field (#120 b). */
const invalidNames: [string, string, (field: string) => string][] = [
  ['empty', '', (field) => `${field} is required`],
  ['three spaces', '   ', (field) => `${field} is required`],
  ['a no-break and an ideographic space', '\u00A0\u3000', (field) => `${field} is required`],
  ['a zero-width space', '\u200B', (field) => `${field} is required`],
  ['two soft hyphens', '\u00AD\u00AD', (field) => `${field} is required`],
  ['a tab inside', 'AB\tBank', (field) => `${field} cannot contain tabs or line breaks`],
  ['101 letters', letters101, (field) => `${field} must be at most 100 characters`],
  ['101 letters beyond the BMP', doubleStruck.repeat(101), (field) => `${field} must be at most 100 characters`],
  ['96 letters and a family emoji', 'B'.repeat(96) + family, (field) => `${field} must be at most 100 characters`],
];

// T13: AC3 and AC16, the shared rule in the form: nothing sent, the message under the field (#6, #87 b, #95 a, #120 b).
describe('the form’s rules', () => {
  it.each(invalidNames)(
    'refuses a Bank Name %s on Save: the message under it, red, focused, nothing sent',
    async (_c, text, message) => {
      const { user } = await openAccount();
      await edit(user);
      await replaceText(user, bankName(), text);

      await user.click(saveButton());

      await waitFor(() => expect(bankName()).toHaveAccessibleDescription(message('Bank Name')));
      expect(bankName()).toHaveAttribute('aria-invalid', 'true');
      expect(fieldBox(bankName())).toHaveClass(inputStyles.invalid!);
      expect(bankName()).toHaveFocus();
      expect(branchName()).not.toHaveAttribute('aria-invalid');
      expect(within(detailsRegion()).getAllByText(message('Bank Name'))).toHaveLength(1);
      await settle();
      expect(patches()).toEqual([]);
    },
  );

  it.each(invalidNames)(
    'refuses a Branch Name %s on Enter in it: the message under it, focused',
    async (_c, text, message) => {
      const { user } = await openAccount();
      await edit(user);
      await replaceText(user, branchName(), text);

      await user.click(branchName());
      await user.keyboard('{Enter}');

      await waitFor(() => expect(branchName()).toHaveAccessibleDescription(message('Branch Name')));
      expect(fieldBox(branchName())).toHaveClass(inputStyles.invalid!);
      expect(branchName()).toHaveFocus();
      expect(bankName()).not.toHaveAttribute('aria-invalid');
      await settle();
      expect(patches()).toEqual([]);
    },
  );

  it('shows one message under each field when both fail, focus on Bank Name, the first', async () => {
    const { user } = await openAccount();
    await edit(user);
    await replaceText(user, bankName(), '   ');
    await replaceText(user, branchName(), letters101);

    await user.click(saveButton());

    await waitFor(() => expect(bankName()).toHaveAccessibleDescription('Bank Name is required'));
    expect(branchName()).toHaveAccessibleDescription('Branch Name must be at most 100 characters');
    expect(bankName()).toHaveFocus();
    await settle();
    expect(patches()).toEqual([]);
  });

  it.each([
    ['100 letters', 'B'.repeat(100), 'B'.repeat(100)],
    ['100 letters beyond the BMP', doubleStruck.repeat(100), doubleStruck.repeat(100)],
    ['a letter with a caron', 'Šabac', 'Šabac'],
    ['CJK letters', '銀行', '銀行'],
    ['spaces around a name, sent trimmed', '  AB Bank Ltd  ', 'AB Bank Ltd'],
  ])('accepts %s and sends it', async (_case, text, stored) => {
    const backend = accountsBackend();
    const { user } = await openAccount('/balances/2', ...backend.handlers);
    await edit(user);
    await replaceText(user, bankName(), text);
    await replaceText(user, branchName(), `  ${text} `);

    await user.click(saveButton());

    await waitFor(() => expect(backend.writes).toHaveLength(1));
    expect(backend.writes[0]!.body).toEqual({ bankName: stored, branchName: stored, accountType: 'checking' });
  });
});

// T14: AC4 and AC16, the save in flight, then view mode with the response's values (#6, #26, #119).
describe('a save', () => {
  it('sends one PATCH with the three trimmed fields and both headers, locks the form, then shows view mode', async () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
      ...new Intl.DateTimeFormat().resolvedOptions(),
      timeZone: 'Europe/Belgrade',
    });
    const backend = accountsBackend();
    backend.hold();
    const { user } = await openAccount('/balances/2', ...backend.handlers);
    await edit(user);
    await replaceText(user, bankName(), '  Nordic Bank  ');
    await replaceText(user, branchName(), 'Harbour Branch ');
    await chooseType(user, 'Savings');

    await user.click(saveButton());

    await waitFor(() => expect(backend.writes).toHaveLength(1));
    expect(backend.writes[0]).toEqual({
      accountId: '2',
      body: { bankName: 'Nordic Bank', branchName: 'Harbour Branch', accountType: 'savings' },
      expectedUser: signedInUser.email,
      zone: 'Europe/Belgrade',
    } satisfies DetailsWrite);
    expect(patches()).toEqual(['PATCH /api/accounts/2']);
    // The loading pattern (#6): busy, its name kept, focus kept.
    await waitFor(() => expect(saveButton()).toHaveAttribute('aria-busy', 'true'));
    expect(saveButton()).toHaveAttribute('aria-disabled', 'true');
    expect(saveButton()).toHaveAccessibleName('Save');
    expect(saveButton()).toHaveFocus();
    // Locked: the fields read-only, the select disabled, Cancel and Escape doing nothing, one request.
    expect(bankName()).toHaveAttribute('readonly');
    expect(branchName()).toHaveAttribute('readonly');
    expect(accountType()).toBeDisabled();
    await user.click(saveButton());
    await user.type(bankName(), 'x');
    await user.keyboard('{Enter}');
    await user.click(cancelButton());
    await user.keyboard('{Escape}');
    await settle();
    expect(bankName()).toHaveValue('  Nordic Bank  ');
    expect(backend.writes).toHaveLength(1);
    expect(queryEditButton()).toBeNull();

    backend.release();

    await waitFor(() => expect(editButton()).toHaveFocus());
    expect(readOut()).toEqual([
      ['Bank Name', 'Nordic Bank'],
      ['Account Type', 'Savings'],
      ['Balance', '$33,362.48'],
      ['Branch Name', 'Harbour Branch'],
      ['Account Number', '**** **** **** 7310'],
    ]);
    expect(within(detailsRegion()).queryByRole('textbox')).toBeNull();
    // The details come from the response: not asked for again.
    await settle();
    expect(sent.filter((request) => request === 'GET /api/accounts/2')).toHaveLength(1);
  });

  it('saves with Enter in Branch Name, then shows the stored values when edited again', async () => {
    const backend = accountsBackend();
    const { user } = await openAccount('/balances/2', ...backend.handlers);
    await edit(user);
    await replaceText(user, branchName(), 'Harbour Branch');

    await user.click(branchName());
    await user.keyboard('{Enter}');

    await waitFor(() => expect(editButton()).toHaveFocus());
    expect(backend.writes.map((write) => write.body)).toEqual([
      { bankName: 'AB Bank Ltd', branchName: 'Harbour Branch', accountType: 'checking' },
    ]);
    await user.click(editButton());
    await waitFor(() => expect(bankName()).toHaveFocus());
    expect(branchName()).toHaveValue('Harbour Branch');
  });
});

// T15: AC5 and AC12, a failed save (#6, #97 a, #119).
describe('a failed save', () => {
  it.each([
    ['a 500', updateAccountDetails.fails],
    ['a network failure', updateAccountDetails.networkError],
  ])(
    'keeps the typed values after %s, "Something went wrong." above Save, focus on Save, no retry',
    async (_case, failure) => {
      const writes: DetailsWrite[] = [];
      const { user } = await openAccount('/balances/2', failure(writes));
      await edit(user);
      await replaceText(user, bankName(), 'Nordic Bank');
      await chooseType(user, 'Loan');

      await user.click(saveButton());

      expect(await within(detailsRegion()).findByRole('alert')).toHaveTextContent('Something went wrong.');
      expect(saveButton()).toHaveFocus();
      expect(saveButton()).not.toHaveAttribute('aria-busy');
      expect(bankName()).toHaveValue('Nordic Bank');
      expect(accountType()).toHaveTextContent('Loan');
      expect(bankName()).not.toHaveAttribute('readonly');
      await settle();
      expect(writes).toHaveLength(1);

      await user.click(saveButton());

      await waitFor(() => expect(writes).toHaveLength(2));
    },
  );

  it('moves focus to Save after a failure that started with Enter in a field', async () => {
    const { user } = await openAccount('/balances/2', updateAccountDetails.fails());
    await edit(user);

    await user.keyboard('{Enter}');

    expect(await within(detailsRegion()).findByRole('alert')).toHaveTextContent('Something went wrong.');
    await waitFor(() => expect(saveButton()).toHaveFocus());
  });

  it('shows a 400’s field errors under their fields, with no message above Save', async () => {
    const { user } = await openAccount(
      '/balances/2',
      updateAccountDetails.fieldErrors({ bankName: 'Bank Name is required', branchName: 'Branch Name is required' }),
    );
    await edit(user);

    await user.click(saveButton());

    await waitFor(() => expect(bankName()).toHaveAccessibleDescription('Bank Name is required'));
    expect(branchName()).toHaveAccessibleDescription('Branch Name is required');
    expect(within(detailsRegion()).queryByRole('alert')).toBeNull();
    expect(saveButton()).toHaveFocus();
  });

  it('opens Balances on a 404', async () => {
    const { user, url } = await openAccount('/balances/2', updateAccountDetails.notFound());
    await edit(user);

    await user.click(saveButton());

    expect(await screen.findByRole('region', { name: 'Balances' })).toBeInTheDocument();
    expect(url()).toBe('/balances');
  });

  it('shows the guard’s 409, asks for the session once, then shows the signed-in user (Balances)', async () => {
    const otherUser: CurrentUser = { fullName: 'Ada Lovelace', email: 'ada@example.com', username: 'ada' };
    const writes: DetailsWrite[] = [];
    const { user, url } = await openAccount('/balances/2', updateAccountDetails.otherUser(writes));
    await edit(user);
    await replaceText(user, bankName(), 'Nordic Bank');
    const { promise: meHeld, resolve: releaseMe } = Promise.withResolvers<void>();
    server.use(
      http.get('*/api/auth/me', async () => {
        await meHeld;
        return HttpResponse.json(otherUser);
      }),
      accountDetails.notFound(),
      accountHistory.notFound(),
    );
    const meBefore = sent.filter((request) => request === 'GET /api/auth/me').length;

    await user.click(saveButton());

    expect(await within(detailsRegion()).findByRole('alert')).toHaveTextContent(
      'Another user is signed in. Nothing was saved.',
    );
    expect(writes.map((write) => write.expectedUser)).toEqual([signedInUser.email]);
    await waitFor(() => expect(sent.filter((request) => request === 'GET /api/auth/me')).toHaveLength(meBefore + 1));
    releaseMe();
    expect(await screen.findByRole('region', { name: 'Balances' })).toBeInTheDocument();
    expect(url()).toBe('/balances');
    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.queryByText('Tanzir Rahman')).toBeNull();
  });
});

/** Changes every field and the type. */
async function changeAll(user: ReturnType<typeof renderApp>['user']) {
  await replaceText(user, bankName(), 'Discarded Bank');
  await replaceText(user, branchName(), 'Discarded Branch');
  await chooseType(user, 'Investment');
}

// T16: AC2 and AC6, Cancel and Escape discard (#26).
describe('Cancel and Escape', () => {
  it('discards on Cancel: view mode with the stored values, nothing sent, focus on "Edit Details"', async () => {
    const { user } = await openAccount();
    await edit(user);
    await changeAll(user);

    await user.click(cancelButton());

    await waitFor(() => expect(editButton()).toHaveFocus());
    expect(readOut()).toEqual(checkingReadOut);
    expect(patches()).toEqual([]);
    await user.click(editButton());
    await waitFor(() => expect(bankName()).toHaveFocus());
    expect(bankName()).toHaveValue('AB Bank Ltd');
    expect(branchName()).toHaveValue('Park Street Branch');
    expect(accountType()).toHaveTextContent('Checking');
  });

  it.each([
    ['Bank Name', () => bankName()],
    ['Branch Name', () => branchName()],
    ['the closed select', () => accountType()],
    ['Save', () => saveButton()],
    ['Cancel', () => cancelButton()],
  ])('discards on Escape with focus on %s', async (_case, target) => {
    const { user } = await openAccount();
    await edit(user);
    await changeAll(user);
    target().focus();

    await user.keyboard('{Escape}');

    await waitFor(() => expect(editButton()).toHaveFocus());
    expect(readOut()).toEqual(checkingReadOut);
    expect(patches()).toEqual([]);
  });

  // Code review of task 022: an Escape that ends an IME composition (names such as 銀行, AC3) keeps edit mode.
  it('keeps edit mode and the typing on an Escape that ends an IME composition', async () => {
    const { user } = await openAccount();
    await edit(user);
    await replaceText(user, bankName(), '銀行');

    fireEvent.keyDown(bankName(), { key: 'Escape', isComposing: true });

    await settle();
    expect(bankName()).toHaveValue('銀行');
    expect(queryEditButton()).toBeNull();
  });

  it('closes only the list on Escape with it open; a second Escape discards', async () => {
    const { user } = await openAccount();
    await edit(user);
    await replaceText(user, bankName(), 'Discarded Bank');
    await user.click(accountType());

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
    await waitFor(() => expect(accountType()).toHaveFocus());
    expect(bankName()).toHaveValue('Discarded Bank');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(editButton()).toHaveFocus());
    expect(readOut()).toEqual(checkingReadOut);
  });

  // Task 032 code review: "Remove" shows "Not available" while it has keyboard focus (#133, #134 c). Escape hides only
  // that text, as with the list open: the typing is kept until a second Escape.
  it('hides only "Not available" on Escape with focus on "Remove"; a second Escape discards', async () => {
    const { user } = await openAccount();
    await edit(user);
    await replaceText(user, bankName(), 'Discarded Bank');
    for (const next of [accountType, branchName, saveButton, cancelButton, removeButton]) {
      await user.tab();
      expect(next()).toHaveFocus();
    }
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Not available');

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
    expect(removeButton()).toHaveFocus();
    expect(bankName()).toHaveValue('Discarded Bank');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(editButton()).toHaveFocus());
    expect(readOut()).toEqual(checkingReadOut);
  });

  it('discards the typing when Balances opens from the sidebar, with no prompt', async () => {
    const { user, url } = await openAccount();
    await edit(user);
    await replaceText(user, bankName(), 'Discarded Bank');

    await user.click(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'Balances' }));

    expect(await screen.findByRole('region', { name: 'Balances' })).toBeInTheDocument();
    expect(url()).toBe('/balances');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(patches()).toEqual([]);
  });
});

/** The sidebar link to a section. */
const sidebarLink = (name: string) =>
  within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name });

const region = (name: string) => screen.getByRole('region', { name });
/** The Overview carousel's shown slide: its name and its texts. */
const shownSlide = () => {
  const group = within(region('Total Balance')).getByRole('group', { name: /^Account \d+ of \d+$/ });
  return [group.getAttribute('aria-label'), ...[...group.querySelectorAll('p')].map((p) => p.textContent)];
};
/** The Balances cards, each as its heading (the type) and its texts. */
const balancesCards = async () =>
  within(await within(region('Balances')).findByRole('list'))
    .getAllByRole('listitem')
    .map((card) => card.textContent);
/** The Transactions table's rows as [item, payment method], once the panel shows its table. */
async function transactionRows() {
  const panel = within(region('Recent Transaction')).getByRole('tabpanel');
  const table = await within(panel).findByRole('table');
  return within(within(table).getAllByRole('rowgroup')[1]!)
    .getAllByRole('row')
    .map((row) => {
      const cells = within(row).getAllByRole('cell');
      return [cells[0]!.textContent, cells[3]!.textContent];
    });
}
const transactionsTab = (name: string) =>
  within(within(region('Recent Transaction')).getByRole('tablist')).getByRole('tab', { name });

// T18: AC13 and AC14, each screen after a save shows the new values, never the old ones (#57).
describe('each screen after a save', () => {
  it('shows the new type and Bank Name on Balances, the Overview carousel and every Transactions tab', async () => {
    const backend = accountsBackend();
    server.use(me.signedIn(), today.answers(), ...backend.handlers);
    const { user, router, url } = renderApp('/overview', undefined, { strict: true });
    // Every screen opened before the save, so its data is cached.
    await within(await screen.findByRole('region', { name: 'Total Balance' })).findByRole('group');
    await user.click(within(region('Total Balance')).getByRole('button', { name: 'Next' }));
    expect(shownSlide()).toEqual(['Account 2 of 5', 'Account Type', 'Checking', '**** **** **** 7310', '$33,362.48']);
    await user.click(sidebarLink('Balances'));
    expect((await balancesCards())[1]).toContain('Checking');
    await user.click(sidebarLink('Transactions'));
    expect((await transactionRows())[0]).toEqual(['Jeans', 'Checking']);
    await user.click(transactionsTab('Revenue'));
    await waitFor(async () => expect((await transactionRows())[0]).toEqual(['Freelance payment', 'Checking']));
    await user.click(transactionsTab('Expenses'));
    await waitFor(async () => expect((await transactionRows())[0]).toEqual(['Jeans', 'Checking']));
    await act(() => router.navigate('/balances/2'));
    await within(await screen.findByRole('region', { name: 'Account Details' })).findByRole('button', {
      name: 'Edit Details',
    });
    await within(historyRegion()).findByRole('table');

    await edit(user);
    await replaceText(user, bankName(), 'Nordic Bank');
    await chooseType(user, 'Savings');
    const sentBeforeSave = sent.length;
    await user.click(saveButton());
    await waitFor(() => expect(editButton()).toHaveFocus());
    await settle();
    const recorder = recordAddedText();

    // Account Details: the new values; the history unchanged and not asked for again.
    expect(readOut()[0]).toEqual(['Bank Name', 'Nordic Bank']);
    expect(readOut()[1]).toEqual(['Account Type', 'Savings']);
    expect(sent.slice(sentBeforeSave)).toEqual(['PATCH /api/accounts/2']);

    // Balances: Checking's card shows Savings and the new Bank Name.
    await user.click(sidebarLink('Balances'));
    await waitFor(async () => expect((await balancesCards())[1]).toContain('Nordic Bank'));
    expect((await balancesCards())[1]).toContain('Savings');
    expect((await balancesCards())[1]).not.toContain('AB Bank Ltd');

    // Overview: the carousel's Checking slide shows Savings.
    await user.click(sidebarLink('Overview'));
    await within(await screen.findByRole('region', { name: 'Total Balance' })).findByRole('group');
    await user.click(within(region('Total Balance')).getByRole('button', { name: 'Next' }));
    await waitFor(() =>
      expect(shownSlide()).toEqual(['Account 2 of 5', 'Account Type', 'Savings', '**** **** **** 7310', '$33,362.48']),
    );

    // Transactions: Checking's rows show Savings on every tab; the other accounts' rows are unchanged.
    await user.click(sidebarLink('Transactions'));
    await waitFor(async () =>
      expect((await transactionRows()).slice(0, 3)).toEqual([
        ['Jeans', 'Savings'],
        ['Movie ticket', 'Credit Card'],
        ['Pizza', 'Credit Card'],
      ]),
    );
    await user.click(transactionsTab('Revenue'));
    await waitFor(async () =>
      expect((await transactionRows()).slice(0, 2)).toEqual([
        ['Freelance payment', 'Savings'],
        ['Dividend', 'Investment'],
      ]),
    );
    await user.click(transactionsTab('Expenses'));
    await waitFor(async () => expect((await transactionRows())[0]).toEqual(['Jeans', 'Savings']));
    recorder.stop();

    // The old type never shows on these screens after the save.
    expect(recorder.texts.join('\n')).not.toContain('Checking');
    expect(url()).toBe('/transactions');
    expect(sent.slice(sentBeforeSave).filter((request) => request.startsWith('GET /api/accounts/2'))).toEqual([]);
  });
});

// T19: AC17, edit mode while the details are asked for again (#6, #39, #89).
describe('edit mode during a refetch', () => {
  it('keeps the typed values when a refetch on window focus answers a new balance, which shows', async () => {
    const { user } = await openAccount();
    await edit(user);
    await replaceText(user, bankName(), 'Typed Bank');
    server.use(accountDetails.answers({ ...demoAccountDetails, 2: { ...demoAccountDetails[2]!, balance: usd(1) } }));

    refocusWindow();

    await waitFor(() =>
      expect(readOut()).toEqual([
        ['Balance', '$0.01'],
        ['Account Number', '**** **** **** 7310'],
      ]),
    );
    expect(bankName()).toHaveValue('Typed Bank');
    expect(branchName()).toHaveValue('Park Street Branch');
  });

  it('keeps the data and the form, with no message, when the refetch fails', async () => {
    const { user } = await openAccount();
    await edit(user);
    await replaceText(user, bankName(), 'Typed Bank');
    server.use(accountDetails.fails());
    const before = sent.filter((request) => request === 'GET /api/accounts/2').length;

    refocusWindow();

    await waitFor(() =>
      expect(sent.filter((request) => request === 'GET /api/accounts/2').length).toBeGreaterThan(before),
    );
    await settle();
    expect(bankName()).toHaveValue('Typed Bank');
    expect(readOut()).toEqual([
      ['Balance', '$33,362.48'],
      ['Account Number', '**** **** **** 7310'],
    ]);
    expect(within(detailsRegion()).queryByRole('alert')).toBeNull();
    expect(within(detailsRegion()).queryByRole('button', { name: 'Retry' })).toBeNull();
  });

  it('opens Balances when the refetch answers 404', async () => {
    const { user, url } = await openAccount();
    await edit(user);
    server.use(accountDetails.notFound());

    refocusWindow();

    expect(await screen.findByRole('region', { name: 'Balances' })).toBeInTheDocument();
    expect(url()).toBe('/balances');
  });
});
