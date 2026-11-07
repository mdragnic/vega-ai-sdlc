import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { type CurrentUser, type Profile, writeGuardMessages } from '@finebank/shared';
import { focusManager, type QueryClient, useQueryClient } from '@tanstack/react-query';
import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import type userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { useEffect } from 'react';
import { Outlet, type RouteObject } from 'react-router';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { routes } from '../../src/app/routes';
import {
  changePassword,
  dataStateRootIn,
  demoProfile,
  googleOnlyProfile,
  me,
  passwordBackend,
  profile,
  profileBackend,
  renderApp,
  signedInDefaults,
  signedInUser,
  today,
} from '../support/app';

const server = setupServer(...signedInDefaults());

/** Every request the app sends, as `METHOD /path?query`. */
let requests: string[] = [];

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
beforeEach(() => {
  requests = [];
  server.events.on('request:start', ({ request }) => {
    const { pathname, search } = new URL(request.url);
    requests.push(`${request.method} ${pathname}${search}`);
  });
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
  server.events.removeAllListeners();
  focusManager.setFocused(undefined);
});
afterAll(() => server.close());

/** The query client the app uses, captured from inside it. */
let appClient: QueryClient | undefined;

function ClientProbe() {
  const client = useQueryClient();
  useEffect(() => {
    appClient = client;
  }, [client]);
  return null;
}

const probedRoutes: RouteObject[] = [
  {
    element: (
      <>
        <ClientProbe />
        <Outlet />
      </>
    ),
    children: routes,
  },
];

type User = ReturnType<typeof userEvent.setup>;

/** A profile with 112's phone. */
const phoneProfile: Profile = { ...demoProfile, phoneCountryCode: '+880', phoneNumber: '5154758868' };

/** The app signed in at `path` (Settings, Security by default), `handlers` first, once the tabs show. In StrictMode. */
async function openSecurity(path = '/settings/security', ...handlers: Parameters<typeof server.use>) {
  server.use(...handlers, me.signedIn(), today.answers());
  const view = renderApp(path, probedRoutes, { strict: true });
  if (path.startsWith('/settings')) await screen.findByRole('tablist', { name: 'Settings' });
  else await screen.findByRole('main');
  return view;
}

const tablist = () => screen.getByRole('tablist', { name: 'Settings' });
const tab = (name: 'Account' | 'Security') => within(tablist()).getByRole('tab', { name });
const oldPassword = () => screen.getByLabelText('Old Password');
const newPassword = () => screen.getByLabelText('New Password');
const retypePassword = () => screen.getByLabelText('Retype Password');
const passwordFields = () => [oldPassword(), newPassword(), retypePassword()];
const phoneGroup = () => screen.getByRole('group', { name: 'Phone Number' });
const countryCode = () => within(phoneGroup()).getByRole('textbox', { name: 'Country code' });
const phoneNumber = () => within(phoneGroup()).getByRole('textbox', { name: 'Phone Number' });
const updateButton = () => screen.getByRole('button', { name: 'Update Password' });
const sidebar = () => screen.getByRole('navigation', { name: 'Main' });
const profileBlock = () => sidebar().parentElement!;

/** Waits until the Security form shows. */
const formShown = () => waitFor(() => expect(oldPassword()).toBeInTheDocument());

/** "Password updated": its status region is the panel's visible one (the Account panel's is hidden). */
const statusText = () => screen.getByRole('status').textContent;

/** The message under a field: its `aria-describedby` target's text. */
const errorOf = (field: HTMLElement) => {
  const id = field.getAttribute('aria-describedby');
  return id === null ? null : (document.getElementById(id)?.textContent ?? null);
};

async function typeInto(user: User, field: HTMLElement, text: string) {
  await user.clear(field);
  if (text) await user.paste(text);
}

/** The three fields typed: Old, New, Retype. */
async function fill(user: User, old: string, next: string, retype = next) {
  await typeInto(user, oldPassword(), old);
  await typeInto(user, newPassword(), next);
  await typeInto(user, retypePassword(), retype);
}

const count = (request: string) => requests.filter((sent) => sent === request).length;
const puts = () => count('PUT /api/auth/password');
const settle = () => new Promise((done) => setTimeout(done, 50));
const refocusWindow = () =>
  act(() => {
    focusManager.setFocused(false);
    focusManager.setFocused(true);
  });

const text = {
  required: 'Password is required',
  max: 'Password must be at most 128 characters',
  min: 'Password must be at least 8 characters',
  letterAndNumber: 'Password must contain at least one letter and one number',
  same: 'New password must be different from the old password',
  mismatch: 'Passwords do not match',
  incorrect: 'Current password is incorrect',
};

// T11: AC1, AC2, AC3, the tab and its fields.
describe('Settings, Security tab', () => {
  it('opens from the Account tab by a click, Security active, and a click on Account opens Account again', async () => {
    const { user, url } = await openSecurity('/settings/account');

    await user.click(tab('Security'));
    await formShown();

    expect(url()).toBe('/settings/security');
    expect(tab('Security')).toHaveAttribute('aria-selected', 'true');
    expect(tab('Account')).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Security');
    await user.click(tab('Account'));
    expect(url()).toBe('/settings/account');
    expect(screen.getByRole('textbox', { name: 'Full name' })).toBeVisible();
    // Both panels stay mounted (task 028): the Security form is hidden, its typing kept.
    expect(oldPassword()).not.toBeVisible();
  });

  it('shows three empty masked fields, the read-only phone and Update Password unavailable, with no placeholder or eye', async () => {
    await openSecurity('/settings/security', profile.answers(phoneProfile));
    await formShown();

    expect(passwordFields().map((field) => field.getAttribute('type'))).toEqual(['password', 'password', 'password']);
    expect(passwordFields().map((field) => (field as HTMLInputElement).value)).toEqual(['', '', '']);
    expect(passwordFields().map((field) => field.getAttribute('autocomplete'))).toEqual([
      'current-password',
      'new-password',
      'new-password',
    ]);
    for (const field of passwordFields()) {
      expect(field).toHaveAttribute('spellcheck', 'false');
      expect(field).not.toHaveAttribute('readonly');
    }
    expect(countryCode()).toHaveValue('+880');
    expect(phoneNumber()).toHaveValue('5154758868');
    expect(countryCode()).toHaveAttribute('readonly');
    expect(phoneNumber()).toHaveAttribute('readonly');
    const panel = screen.getByRole('tabpanel');
    for (const input of panel.querySelectorAll('input')) expect(input).not.toHaveAttribute('placeholder');
    // The visible panel's buttons: Update Password only, no eye.
    expect(
      within(panel)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Update Password']);
    expect(updateButton()).toHaveAttribute('type', 'submit');
    expect(updateButton()).toHaveAttribute('aria-disabled', 'true');
    expect(updateButton()).not.toBeDisabled();
  });

  it('shows the code and an empty number for a user with no number', async () => {
    await openSecurity();
    await formShown();

    expect(countryCode()).toHaveValue('+1');
    expect(phoneNumber()).toHaveValue('');
  });

  it('shows a Google-only user the read-only phone alone: no password field, no button', async () => {
    await openSecurity('/settings/security', profile.answers({ ...googleOnlyProfile, phoneCountryCode: '+880' }));

    await waitFor(() => expect(countryCode()).toHaveValue('+880'));
    const panel = screen.getByRole('tabpanel');
    expect(screen.queryByLabelText('Old Password')).toBeNull();
    expect(screen.queryByLabelText('New Password')).toBeNull();
    expect(screen.queryByLabelText('Retype Password')).toBeNull();
    expect(within(panel).queryByRole('button')).toBeNull();
    expect(within(panel).queryByRole('status')).toBeNull();
    expect(within(panel).getAllByRole('textbox')).toEqual([countryCode(), phoneNumber()]);
    expect(panel).not.toHaveTextContent(/password/i);
  });
});

// T12: AC4, #127 b: unavailable while the three fields are empty.
describe('Update Password, until a field changes', () => {
  it('is available after a character in any one field and unavailable again when all three are emptied', async () => {
    const { user } = await openSecurity();
    await formShown();

    for (const field of passwordFields()) {
      expect(updateButton()).toHaveAttribute('aria-disabled', 'true');
      await user.type(field, 'a');
      expect(updateButton()).not.toHaveAttribute('aria-disabled');
      await user.clear(field);
    }
    expect(updateButton()).toHaveAttribute('aria-disabled', 'true');
  });

  it('sends nothing and shows nothing on a click or on Enter in a field while unavailable', async () => {
    const { user } = await openSecurity();
    await formShown();

    await user.click(updateButton());
    await user.click(oldPassword());
    await user.keyboard('{Enter}');
    await settle();

    expect(puts()).toBe(0);
    for (const field of passwordFields()) expect(errorOf(field)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(statusText()).toBe('');
  });

  it('is unavailable after a success until the next change, and stays available after a refusal', async () => {
    const backend = passwordBackend();
    const { user } = await openSecurity('/settings/security', backend.handler);
    await formShown();

    await fill(user, 'wrong-pass1', 'newpass12');
    await user.click(updateButton());
    await waitFor(() => expect(errorOf(oldPassword())).toBe(text.incorrect));
    expect(updateButton()).not.toHaveAttribute('aria-disabled');

    await typeInto(user, oldPassword(), 'old-pass1');
    await user.click(updateButton());
    await waitFor(() => expect(statusText()).toBe('Password updated'));
    expect(updateButton()).toHaveAttribute('aria-disabled', 'true');
    await user.type(newPassword(), 'x');
    expect(updateButton()).not.toHaveAttribute('aria-disabled');
  });
});

// T13: AC5, AC15, the form's rules: the shared schema's messages, focus on the first, nothing sent.
describe('the form’s rules', () => {
  it.each<[string, [string, string, string], 'old' | 'new' | 'retype', string]>([
    ['New Password of 7 characters', ['old-pass1', 'abcdef1', 'abcdef1'], 'new', text.min],
    ['New Password without a letter', ['old-pass1', '12345678', '12345678'], 'new', text.letterAndNumber],
    ['New Password without a number', ['old-pass1', 'abcdefgh', 'abcdefgh'], 'new', text.letterAndNumber],
    ['New Password of 129 characters', ['old-pass1', `a1${'x'.repeat(127)}`, `a1${'x'.repeat(127)}`], 'new', text.max],
    ['New Password equal to Old Password', ['old-pass1', 'old-pass1', 'old-pass1'], 'new', text.same],
    ['Old Password empty', ['', 'newpass12', 'newpass12'], 'old', text.required],
    ['Old Password of 129 characters', ['x'.repeat(129), 'newpass12', 'newpass12'], 'old', text.max],
    ['Retype Password different', ['old-pass1', 'newpass12', 'newpass13'], 'retype', text.mismatch],
    ['Retype Password empty', ['old-pass1', 'newpass12', ''], 'retype', text.mismatch],
  ])(
    'shows %s under its field with focus there, sending nothing',
    async (_case, [old, next, retype], target, message) => {
      const { user } = await openSecurity();
      await formShown();
      await fill(user, old, next, retype);

      await user.click(updateButton());

      const field = { old: oldPassword(), new: newPassword(), retype: retypePassword() }[target];
      await waitFor(() => expect(errorOf(field)).toBe(message));
      expect(field).toHaveAttribute('aria-invalid', 'true');
      expect(field).toHaveAccessibleDescription(message);
      await waitFor(() => expect(field).toHaveFocus());
      const others = passwordFields().filter((other) => other !== field);
      for (const other of others) expect(errorOf(other)).toBeNull();
      expect(puts()).toBe(0);
    },
  );

  it('shows every field’s one message at once on Enter, focus on the first', async () => {
    const { user } = await openSecurity();
    await formShown();
    await fill(user, '', 'abc', 'abd');

    await user.click(retypePassword());
    await user.keyboard('{Enter}');

    await waitFor(() => expect(errorOf(oldPassword())).toBe(text.required));
    expect(errorOf(newPassword())).toBe(text.min);
    expect(errorOf(retypePassword())).toBe(text.mismatch);
    await waitFor(() => expect(oldPassword()).toHaveFocus());
    expect(puts()).toBe(0);
  });

  // Code review: a message that depends on another field goes as soon as that field makes it true.
  it('drops "Passwords do not match" when New Password is changed to match, and the "different" one when Old changes', async () => {
    const { user } = await openSecurity();
    await formShown();
    await fill(user, 'old-pass1', 'newpass12', 'newpass1');
    // Nothing is checked before the first submit.
    expect(errorOf(retypePassword())).toBeNull();

    await user.click(updateButton());
    await waitFor(() => expect(errorOf(retypePassword())).toBe(text.mismatch));
    await typeInto(user, newPassword(), 'newpass1');

    await waitFor(() => expect(errorOf(retypePassword())).toBeNull());
    expect(retypePassword()).not.toHaveAttribute('aria-invalid');

    await typeInto(user, newPassword(), 'old-pass1');
    await typeInto(user, retypePassword(), 'old-pass1');
    await user.click(updateButton());
    await waitFor(() => expect(errorOf(newPassword())).toBe(text.same));
    await typeInto(user, oldPassword(), 'other-pass1');

    await waitFor(() => expect(errorOf(newPassword())).toBeNull());
    expect(puts()).toBe(0);
  });

  it('shows nothing under Retype Password when it and New Password are both empty', async () => {
    const { user } = await openSecurity();
    await formShown();
    await typeInto(user, oldPassword(), 'old-pass1');

    await user.click(updateButton());

    await waitFor(() => expect(errorOf(newPassword())).toBe(text.required));
    expect(errorOf(retypePassword())).toBeNull();
  });

  it.each([
    ['exactly 8 characters', 'abcdefg1'],
    ['exactly 128 characters', `a1${'x'.repeat(126)}`],
    ['Šifra123', 'Šifra123'],
    ['spaces around and inside', '  my pass 1  '],
  ])('sends a new password of %s exactly as typed', async (_case, next) => {
    const backend = passwordBackend(' old pass ');
    const { user } = await openSecurity('/settings/security', backend.handler);
    await formShown();
    await fill(user, ' old pass ', next);

    await user.click(updateButton());

    await waitFor(() => expect(statusText()).toBe('Password updated'));
    expect(JSON.parse(backend.writes[0]!.body)).toEqual({ currentPassword: ' old pass ', newPassword: next });
  });
});

// T14: AC6, the save: one JSON PUT with the two keys and the header, the loading pattern, then "Password updated".
describe('Update Password', () => {
  it('sends one PUT of the two passwords with the header, holds the form while it runs, then shows the result', async () => {
    const held = changePassword.held();
    const { user, url } = await openSecurity('/settings/security', held.handler);
    await formShown();
    await waitFor(() => expect(appClient?.getQueryData(['session'])).toBeDefined());
    const sessionUpdatedAt = appClient!.getQueryState(['session'])!.dataUpdatedAt;
    const profileUpdatedAt = appClient!.getQueryState(['profile'])!.dataUpdatedAt;
    await fill(user, 'old-pass1', 'newpass12', 'newpass12');
    const before = requests.length;

    await user.click(updateButton());

    await waitFor(() => expect(held.writes).toHaveLength(1));
    expect(held.writes[0]!.contentType).toBe('application/json');
    expect(held.writes[0]!.body).toBe(JSON.stringify({ currentPassword: 'old-pass1', newPassword: 'newpass12' }));
    expect(held.writes[0]!.expectedUser).toBe(signedInUser.email);
    // The loading pattern, focus kept, a second click and Enter send nothing.
    await waitFor(() => expect(updateButton()).toHaveAttribute('aria-busy', 'true'));
    expect(updateButton()).toHaveAttribute('aria-disabled', 'true');
    expect(updateButton()).toHaveAccessibleName('Update Password');
    expect(updateButton()).toHaveFocus();
    await user.click(updateButton());
    await user.keyboard('{Enter}');
    for (const field of passwordFields()) expect(field).toHaveAttribute('readonly');
    await user.type(newPassword(), 'zz');
    expect(newPassword()).toHaveValue('newpass12');
    await settle();
    expect(puts()).toBe(1);

    held.release();

    await waitFor(() => expect(statusText()).toBe('Password updated'));
    expect(passwordFields().map((field) => (field as HTMLInputElement).value)).toEqual(['', '', '']);
    await waitFor(() => expect(updateButton()).toHaveFocus());
    expect(updateButton()).toHaveAttribute('aria-disabled', 'true');
    expect(updateButton()).not.toHaveAttribute('aria-busy', 'true');
    for (const field of passwordFields()) expect(field).not.toHaveAttribute('readonly');
    await settle();
    // Still signed in: the URL, the sidebar and the session unchanged, no other request.
    expect(url()).toBe('/settings/security');
    expect(within(profileBlock()).getByText('Tanzir Rahman')).toBeInTheDocument();
    expect(appClient!.getQueryState(['session'])!.dataUpdatedAt).toBe(sessionUpdatedAt);
    expect(appClient!.getQueryState(['profile'])!.dataUpdatedAt).toBe(profileUpdatedAt);
    expect(requests.slice(before)).toEqual(['PUT /api/auth/password']);
  });

  it('removes "Password updated" when a field changes, and when the button is pressed again', async () => {
    const backend = passwordBackend();
    const { user } = await openSecurity('/settings/security', backend.handler);
    await formShown();
    await fill(user, 'old-pass1', 'newpass12');
    await user.click(updateButton());
    await waitFor(() => expect(statusText()).toBe('Password updated'));

    await user.type(oldPassword(), 'n');
    expect(statusText()).toBe('');

    await fill(user, 'newpass12', 'newpass34');
    await user.click(updateButton());
    await waitFor(() => expect(statusText()).toBe('Password updated'));
    await typeInto(user, oldPassword(), 'wrong-pass1');
    await typeInto(user, newPassword(), 'newpass56');
    await typeInto(user, retypePassword(), 'newpass56');
    await user.click(updateButton());
    await waitFor(() => expect(errorOf(oldPassword())).toBe(text.incorrect));
    expect(statusText()).toBe('');
  });

  it('saves on Enter in a field and puts focus on Update Password after the save', async () => {
    const backend = passwordBackend();
    const { user } = await openSecurity('/settings/security', backend.handler);
    await formShown();
    await fill(user, 'old-pass1', 'newpass12');

    await user.click(retypePassword());
    await user.keyboard('{Enter}');

    await waitFor(() => expect(statusText()).toBe('Password updated'));
    await waitFor(() => expect(updateButton()).toHaveFocus());
    expect(backend.current()).toBe('newpass12');
  });
});

// T15: AC8, AC9, a refused or failed save.
describe('a refused or failed save', () => {
  it('shows "Current password is incorrect" under Old Password with focus there, the typing kept', async () => {
    const backend = passwordBackend();
    const { user } = await openSecurity('/settings/security', backend.handler);
    await formShown();
    await fill(user, 'wrong-pass1', 'newpass12');

    await user.click(updateButton());

    await waitFor(() => expect(errorOf(oldPassword())).toBe(text.incorrect));
    await waitFor(() => expect(oldPassword()).toHaveFocus());
    expect(oldPassword()).toHaveAttribute('aria-invalid', 'true');
    expect(passwordFields().map((field) => (field as HTMLInputElement).value)).toEqual([
      'wrong-pass1',
      'newpass12',
      'newpass12',
    ]);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(backend.current()).toBe('old-pass1');
  });

  it('shows a 400’s field errors under their fields, focus on the first, nothing above the button', async () => {
    const { user } = await openSecurity(
      '/settings/security',
      changePassword.fieldErrors({ currentPassword: 'Password is required', newPassword: text.min }),
    );
    await formShown();
    await fill(user, 'old-pass1', 'newpass12');

    await user.click(updateButton());

    await waitFor(() => expect(errorOf(oldPassword())).toBe('Password is required'));
    expect(errorOf(newPassword())).toBe(text.min);
    await waitFor(() => expect(oldPassword()).toHaveFocus());
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it.each([
    ['a 500', changePassword.fails(), 'Something went wrong.'],
    ['a network failure', changePassword.networkError(), 'Something went wrong.'],
    ['another 4xx', changePassword.clientError('Unsupported Media Type'), 'Unsupported Media Type'],
  ])(
    'shows %s above the button with focus on it, sends once, and sends again on the next press',
    async (_case, handler, message) => {
      const { user } = await openSecurity('/settings/security', handler);
      await formShown();
      await fill(user, 'old-pass1', 'newpass12');

      await user.click(updateButton());

      expect(await screen.findByRole('alert')).toHaveTextContent(message);
      await waitFor(() => expect(updateButton()).toHaveFocus());
      expect(passwordFields().map((field) => (field as HTMLInputElement).value)).toEqual([
        'old-pass1',
        'newpass12',
        'newpass12',
      ]);
      expect(updateButton()).not.toHaveAttribute('aria-disabled');
      await settle();
      expect(puts()).toBe(1);

      await user.click(updateButton());

      await waitFor(() => expect(puts()).toBe(2));
    },
  );

  it('on the guard’s 409 shows its message, then the other user with the typing gone', async () => {
    const other: CurrentUser = { fullName: 'Bora Kostić', email: 'bora@example.com', username: 'bora' };
    let sessionUser: CurrentUser = signedInUser;
    const { promise: checked, resolve: answerCheck } = Promise.withResolvers<void>();
    const { user } = await openSecurity(
      '/settings/security',
      http.get('*/api/auth/me', async () => {
        if (sessionUser === other) await checked;
        return HttpResponse.json(sessionUser);
      }),
      http.get('*/api/profile', () =>
        HttpResponse.json({
          ...sessionUser,
          phoneCountryCode: '+1',
          phoneNumber: '',
          hasPassword: true,
        } satisfies Profile),
      ),
      http.put('*/api/auth/password', () => {
        sessionUser = other;
        return HttpResponse.json({ message: writeGuardMessages.otherUser }, { status: 409 });
      }),
    );
    await formShown();
    await fill(user, 'old-pass1', 'newpass12');

    await user.click(updateButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(writeGuardMessages.otherUser);
    expect(oldPassword()).toHaveValue('old-pass1');
    answerCheck();
    await waitFor(() => expect(within(profileBlock()).getByText('Bora Kostić')).toBeInTheDocument());
    await waitFor(() => expect(oldPassword()).toHaveValue(''));
    expect(newPassword()).toHaveValue('');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('goes to Login on a 401', async () => {
    const { user, url } = await openSecurity('/settings/security', changePassword.unauthorized());
    await formShown();
    await fill(user, 'old-pass1', 'newpass12');

    await user.click(updateButton());

    await waitFor(() => expect(url()).toMatch(/^\/login/));
  });
});

// T16: AC14, the panel's states.
describe('the Security panel’s states', () => {
  it('shows the tabs and a skeleton while the profile loads', async () => {
    const { container } = await openSecurity('/settings/security', profile.pending());

    expect(tablist()).toBeInTheDocument();
    expect(screen.queryByLabelText('Old Password')).toBeNull();
    const panel = screen.getByRole('tabpanel');
    expect(panel.querySelector('[aria-hidden="true"] [class*="skeleton"]')).not.toBeNull();
    expect(container.querySelectorAll('[aria-hidden="true"] [class*="skeleton"]').length).toBeGreaterThan(0);
  });

  it('shows the error state with Retry, keeps focus in the panel on Retry, and then the form', async () => {
    const { user } = await openSecurity('/settings/security', profile.failsThenAnswers());

    const retry = await screen.findByRole('button', { name: 'Retry' }, { timeout: 10_000 });
    // The Account panel shows the same error state, hidden: one profile query for both.
    expect(
      screen.getAllByText('Something went wrong.').filter((element) => element.closest('[hidden]') === null),
    ).toHaveLength(1);
    expect(tablist()).toBeInTheDocument();
    await user.click(retry);

    await formShown();
    const panel = screen.getByRole('tabpanel');
    expect(panel).toContainElement(dataStateRootIn(panel));
  }, 15_000);

  it('sends one profile request for both panels', async () => {
    const { user } = await openSecurity('/settings/security');
    await formShown();

    await user.click(tab('Account'));
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Full name' })).toBeInTheDocument());
    await settle();

    expect(count('GET /api/profile')).toBe(1);
  });

  it('keeps the typing when a refetch on window focus answers another phone, and shows the new phone', async () => {
    let answer: Profile = demoProfile;
    const { user } = await openSecurity(
      '/settings/security',
      http.get('*/api/profile', () => HttpResponse.json(answer)),
    );
    await formShown();
    await fill(user, 'old-pass1', 'newpass12');
    answer = { ...demoProfile, phoneCountryCode: '+44', phoneNumber: '2071234567' };
    const gets = count('GET /api/profile');

    refocusWindow();
    await waitFor(() => expect(count('GET /api/profile')).toBe(gets + 1));
    await waitFor(() => expect(phoneNumber()).toHaveValue('2071234567'));

    expect(passwordFields().map((field) => (field as HTMLInputElement).value)).toEqual([
      'old-pass1',
      'newpass12',
      'newpass12',
    ]);
  });

  it('keeps the form and the typing with no message when a refetch fails', async () => {
    let fail = false;
    const { user } = await openSecurity(
      '/settings/security',
      http.get('*/api/profile', async () => {
        if (!fail) return HttpResponse.json(demoProfile);
        await delay(1);
        return HttpResponse.json({ message: 'Internal server error' }, { status: 500 });
      }),
    );
    await formShown();
    await typeInto(user, newPassword(), 'typed-pass1');
    fail = true;

    refocusWindow();
    await waitFor(() => expect(appClient!.getQueryState(['profile'])?.status).toBe('error'), { timeout: 10_000 });

    expect(newPassword()).toHaveValue('typed-pass1');
    expect(screen.queryByText('Something went wrong.')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  }, 15_000);

  it('hides the section when the profile’s next read says the user became Google-only (#104)', async () => {
    let answer: Profile = demoProfile;
    await openSecurity(
      '/settings/security',
      http.get('*/api/profile', () => HttpResponse.json(answer)),
    );
    await formShown();
    answer = googleOnlyProfile;

    refocusWindow();

    await waitFor(() => expect(screen.queryByLabelText('Old Password')).toBeNull());
    expect(screen.queryByRole('button', { name: 'Update Password' })).toBeNull();
    expect(countryCode()).toHaveValue('+1');
  });

  it('shows a phone saved on the Account tab with no request but the PATCH', async () => {
    const backend = profileBackend();
    const { user } = await openSecurity('/settings/account', ...backend.handlers);
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Full name' })).toBeInTheDocument());
    await user.clear(screen.getByRole('textbox', { name: 'Phone Number' }));
    await user.paste('51547 58868');
    const before = requests.length;

    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Profile updated'));
    await user.click(tab('Security'));
    await formShown();
    await settle();

    expect(phoneNumber()).toHaveValue('5154758868');
    expect(requests.slice(before).filter((request) => /\/api\/(auth\/me|profile)$/.test(request))).toEqual([
      'PATCH /api/profile',
    ]);
  });
});

// T17: AC15, the typing across a tab change and after leaving Settings.
describe('the passwords typed on Security', () => {
  it('are kept across a visit to Account and gone after leaving Settings', async () => {
    const { user } = await openSecurity();
    await formShown();
    await fill(user, 'old-pass1', 'newpass12', 'newpass1');

    await user.click(tab('Account'));
    await user.click(tab('Security'));

    expect(passwordFields().map((field) => (field as HTMLInputElement).value)).toEqual([
      'old-pass1',
      'newpass12',
      'newpass1',
    ]);

    await user.click(within(sidebar()).getByRole('link', { name: 'Overview' }));
    await screen.findByText(/Hello/);
    await user.click(within(sidebar()).getByRole('link', { name: 'Settings' }));
    await user.click(await screen.findByRole('tab', { name: 'Security' }));
    await formShown();

    expect(passwordFields().map((field) => (field as HTMLInputElement).value)).toEqual(['', '', '']);
  });
});

// AC15: the keyboard order and the names.
describe('the Security tab by keyboard', () => {
  it('goes from the selected tab through Old, New, Retype, the code, the number and Update Password', async () => {
    const { user } = await openSecurity('/settings/security', profile.answers(phoneProfile));
    await formShown();
    tab('Security').focus();

    const order: HTMLElement[] = [];
    for (let i = 0; i < 6; i += 1) {
      await user.tab();
      order.push(document.activeElement as HTMLElement);
    }

    expect(order).toEqual([...passwordFields(), countryCode(), phoneNumber(), updateButton()]);
  });
});

const source = (path: string) => readFileSync(resolve(import.meta.dirname, '../../src', path), 'utf8');

/** The Security tab's sources: the rules only from the shared schema (#74). */
const screens = ['app/pages/SettingsPage.tsx', 'components/PasswordForm/PasswordForm.tsx', 'api/password.ts'];

// T18: AC18, the rules only from passwordChangeFormSchema; the change only through useUserWrite.
describe('Security sources', () => {
  /** A rule of its own: a trim, a length check, a pattern, a letter or digit class, a comparison of two passwords. */
  const ownRule =
    /\.trim(Start|End)?\(|\.length\s*[<>=]|\bminLength\b|\bmaxLength\b|maxlength|\bpattern=|\\p\{|\[0-9\]|\\d|\.test\(|Password\s*[!=]==?\s*\w*Password/;

  it.each([
    'value.trim()',
    'password.length >= 8',
    '<input minLength={8} />',
    '/\\p{L}/u',
    '/[0-9]/.test(password)',
    'newPassword !== currentPassword',
    'retypePassword === newPassword',
  ])('flags %s', (code) => {
    expect(ownRule.test(code)).toBe(true);
  });

  it.each(screens)('%s has no rule of its own', (path) => {
    expect(source(path)).not.toMatch(ownRule);
  });

  it('takes the form’s rule from passwordChangeFormSchema', () => {
    expect(source('components/PasswordForm/PasswordForm.tsx')).toMatch(/zodResolver\(passwordChangeFormSchema\)/);
  });

  // T19: Vitest's CSS-module stub names any class, so a class used but missing from its module would pass here and be
  // undefined in the build.
  it.each([
    'components/PasswordForm/PasswordForm.tsx',
    'components/PasswordFormSkeleton/PasswordFormSkeleton.tsx',
    'components/SettingsInput/SettingsInput.tsx',
    'components/SettingsPhoneInput/SettingsPhoneInput.tsx',
    'app/pages/SettingsPage.tsx',
  ])('%s uses only classes its CSS modules define', (path) => {
    const code = source(path);
    const folder = path.split('/').slice(0, -1).join('/');
    const modules = [...code.matchAll(/^import (\w+) from '(\.{1,2}\/[^']+\.module\.css)';$/gm)];
    expect(modules.length).toBeGreaterThan(0);
    for (const [, name, file] of modules) {
      const css = source(`${folder}/${file}`.replace(/[^/]+\/\.\.\//g, '').replace(/\/\.\//g, '/'));
      const used = new Set([...code.matchAll(new RegExp(`\\b${name}\\.(\\w+)`, 'g'))].map((match) => match[1]!));
      for (const className of used) expect(css, `${name}.${className}`).toMatch(new RegExp(`\\.${className}\\b`));
    }
  });

  it('changes the password only through useUserWrite, with the contract’s entry', () => {
    const api = source('api/password.ts');

    expect(api).toMatch(/useUserWrite\(\{[\s\S]*entry: authContract\.changePassword/);
    expect(api).not.toMatch(/\buseMutation\(|\bsendWrite\(|\bapiWrite\(|\bapiRequest\(|\bfetch\(/);
  });
});
