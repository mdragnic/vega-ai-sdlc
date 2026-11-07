import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { countryCallingCodes, type CurrentUser, type Profile, writeGuardMessages } from '@finebank/shared';
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
  dataStateRootIn,
  demoAccounts,
  demoProfile,
  me,
  profile,
  profileBackend,
  renderApp,
  signedInDefaults,
  signedInUser,
  today,
  updateProfile,
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
  // Unmount first: a focus change while the app is still mounted would send its refetches into the next test.
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

/**
 * The app signed in at `path`, with `handlers` first (MSW takes the first handler that matches), once its page shows:
 * Settings' tabs, or the main area. In StrictMode.
 */
async function openSettings(path: string, ...handlers: Parameters<typeof server.use>) {
  server.use(...handlers, me.signedIn(), today.answers());
  const view = renderApp(path, probedRoutes, { strict: true });
  if (path.startsWith('/settings')) await screen.findByRole('tablist', { name: 'Settings' });
  else await screen.findByRole('main');
  return view;
}

/** Waits until "Profile updated" shows: its status region is always on the page, empty without the message. */
const updatedShown = () => waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Profile updated'));

/** Waits until the form shows a profile. */
const formShown = async () => {
  await waitFor(() => expect(fullName()).toBeInTheDocument());
};

const tablist = () => screen.getByRole('tablist', { name: 'Settings' });
const tab = (name: 'Account' | 'Security') => within(tablist()).getByRole('tab', { name });
const fullName = () => screen.getByRole('textbox', { name: 'Full name' });
const email = () => screen.getByRole('textbox', { name: 'Email' });
const username = () => screen.getByRole('textbox', { name: 'Username' });
const phoneNumber = () => screen.getByRole('textbox', { name: 'Phone Number' });
const countryCode = () => screen.getByRole('combobox', { name: 'Country code' });
const updateButton = () => screen.getByRole('button', { name: 'Save changes' });
const sidebar = () => screen.getByRole('navigation', { name: 'Main' });
const profileBlock = () => sidebar().parentElement!;

async function retype(user: User, field: HTMLElement, text: string) {
  await user.clear(field);
  // Pasted, so a tab and long texts go in as one value, as a paste brings them.
  if (text) await user.paste(text);
}

const count = (request: string) => requests.filter((sent) => sent === request).length;
const patches = () => count('PATCH /api/profile');
const settle = () => new Promise((done) => setTimeout(done, 50));
const refocusWindow = () =>
  act(() => {
    focusManager.setFocused(false);
    focusManager.setFocused(true);
  });

/** The message under a field: its `aria-describedby` target's text. */
const errorOf = (field: HTMLElement) => {
  const id = field.getAttribute('aria-describedby');
  return id === null ? null : (document.getElementById(id)?.textContent ?? null);
};

/** A key pressed on the focused element as a browser delivers it: outside `act`, so React renders on its own schedule. */
const pressOutsideAct = (key: string) =>
  document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));

/** An element whose raw text is `text`: Testing Library's matchers collapse whitespace, which would hide a stored tab. */
const shownAs = (text: string) => (_: string, element: Element | null) =>
  element?.textContent === text && element.children.length === 0;

/** A letter beyond the BMP: one code point, two UTF-16 code units. */
const doubleStruck = '\u{1D538}';

const name = {
  required: 'Name is required',
  control: 'Name cannot contain tabs or line breaks',
  max: 'Name must be at most 100 characters',
};
const usernameText = {
  required: 'Username is required',
  min: 'Username must be at least 3 characters',
  max: 'Username must be at most 30 characters',
  characters: 'Username can only contain lowercase letters, numbers, dots and underscores',
  taken: 'This username is already taken',
};
const phoneText = { digits: 'Phone Number can only contain digits', max: 'Phone Number must be at most 15 digits' };

// T14: AC1, AC3, AC4, Settings from the sidebar, "View profile" and /settings: the Account tab and its fields.
describe('Settings, Account tab', () => {
  it('opens /settings on /settings/account with Settings Active, no greeting, the tabs and the prefilled fields', async () => {
    const { url } = await openSettings('/settings');

    await waitFor(() => expect(url()).toBe('/settings/account'));
    await formShown();
    expect(within(sidebar()).getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByText(/Hello/)).toBeNull();
    expect(
      within(tablist())
        .getAllByRole('tab')
        .map((element) => element.textContent),
    ).toEqual([expect.stringContaining('Account'), expect.stringContaining('Security')]);
    expect(tab('Account')).toHaveAttribute('aria-selected', 'true');
    expect(tab('Security')).toHaveAttribute('aria-selected', 'false');
    await waitFor(() => expect(fullName()).toHaveValue('Tanzir Rahman'));
    expect(email()).toHaveValue('tanzir@example.com');
    expect(username()).toHaveValue('tanzir');
    expect(countryCode()).toHaveTextContent('+1');
    expect(phoneNumber()).toHaveValue('');
    expect(screen.getByRole('group', { name: 'Phone Number' })).toContainElement(countryCode());
    expect(screen.getByRole('group', { name: 'Phone Number' })).toContainElement(phoneNumber());
    // No placeholder where none is designed (#63). Task 029: the photo's hidden file input is a fifth input, so the four
    // fields are counted without it; every input is still checked for a placeholder. Task 030: the Account form's inputs,
    // as the hidden Security panel now holds its own.
    const inputs = fullName().closest('form')!.querySelectorAll('input');
    expect([...inputs].filter((input) => input.type !== 'file')).toHaveLength(4);
    expect([...inputs].filter((input) => input.type === 'file')).toHaveLength(1);
    for (const input of inputs) expect(input).not.toHaveAttribute('placeholder');
    expect(updateButton()).toHaveAttribute('type', 'submit');
  });

  it('makes Email read-only: typing, pasting and deleting change nothing', async () => {
    const { user } = await openSettings('/settings/account');
    await formShown();

    expect(email()).toHaveAttribute('readonly');
    await user.click(email());
    await user.keyboard('{End}{Backspace}{Backspace}x');
    await user.paste('other@example.com');

    expect(email()).toHaveValue('tanzir@example.com');
  });

  // Task 029 (#128 c): "draws "Your Profile Picture" and the upload box as visual only" is replaced by the control's tests
  // in settings-photo.test.tsx (T14 to T21): the box is now a button that opens the file picker.

  it('opens the Account tab from "View profile"', async () => {
    const { user, url } = await openSettings('/overview');

    await user.click(within(profileBlock()).getByRole('link', { name: 'View profile' }));

    await waitFor(() => expect(url()).toBe('/settings/account'));
    expect(await screen.findByRole('textbox', { name: 'Full name' })).toBeInTheDocument();
  });
});

// T15: AC2, the tabs are URLs; the page stays mounted, so typing survives a tab change.
describe('the Settings tabs', () => {
  it('opens Security by a click, replacing the URL, with focus on the tab, and keeps the typing', async () => {
    const { user, url, router } = await openSettings('/settings/account');
    await formShown();
    const form = fullName().closest('form');
    await retype(user, fullName(), 'Typed Name');

    await user.click(tab('Security'));

    expect(url()).toBe('/settings/security');
    expect(router.state.historyAction).toBe('REPLACE');
    expect(tab('Security')).toHaveAttribute('aria-selected', 'true');
    expect(tab('Security')).toHaveFocus();
    // The Account form is mounted but hidden. Changed by task 030: the Security panel was empty; it now shows the Security
    // tab (its own tests in settings-security.test.tsx): the read-only phone's two inputs and "Update Password".
    expect(screen.queryByRole('textbox', { name: 'Full name' })).toBeNull();
    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveAccessibleName('Security');
    await waitFor(() => expect(within(panel).getByLabelText('Old Password')).toBeVisible());
    expect(within(panel).getAllByRole('textbox')).toHaveLength(2);
    expect(within(panel).getByRole('button', { name: 'Update Password' })).toBeVisible();

    await user.click(tab('Account'));

    expect(url()).toBe('/settings/account');
    expect(fullName()).toHaveValue('Typed Name');
    // The same form element: the page did not remount.
    expect(fullName().closest('form')).toBe(form);
  });

  it('moves the selection with Right, Left (wrapping), Home and End, each replacing the URL', async () => {
    const { user, url, router } = await openSettings('/settings/account');
    await formShown();
    const form = fullName().closest('form');
    tab('Account').focus();

    const steps: [string, string, 'Account' | 'Security'][] = [
      ['{ArrowRight}', '/settings/security', 'Security'],
      ['{ArrowRight}', '/settings/account', 'Account'],
      ['{ArrowLeft}', '/settings/security', 'Security'],
      ['{Home}', '/settings/account', 'Account'],
      ['{End}', '/settings/security', 'Security'],
    ];
    for (const [key, path, selected] of steps) {
      await user.keyboard(key);
      expect(url()).toBe(path);
      expect(router.state.historyAction).toBe('REPLACE');
      expect(tab(selected)).toHaveFocus();
      expect(tab(selected)).toHaveAttribute('aria-selected', 'true');
    }
    await user.keyboard('{Home}');
    expect(fullName().closest('form')).toBe(form);
  });

  // Found in the manual checks: End then Home pressed before the router committed End's navigation left Security
  // selected with focus on Account. The keys are dispatched outside `act`, back to back, as a browser delivers them.
  it('follows keys pressed faster than a render: End then Home ends on Account, selected and in the URL', async () => {
    const { url } = await openSettings('/settings/account');
    await formShown();
    tab('Account').focus();

    pressOutsideAct('End');
    pressOutsideAct('Home');

    await waitFor(() => expect(url()).toBe('/settings/account'));
    await settle();
    expect(url()).toBe('/settings/account');
    expect(tab('Account')).toHaveAttribute('aria-selected', 'true');
    expect(tab('Account')).toHaveFocus();
  });

  it('selects Security when /settings/security is opened directly', async () => {
    await openSettings('/settings/security');

    expect(tab('Security')).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('textbox', { name: 'Full name' })).toBeNull();
  });

  it('leaves Settings on Back after a tab change: no history entry per tab', async () => {
    const { user, url, router } = await openSettings('/overview');
    await user.click(within(sidebar()).getByRole('link', { name: 'Settings' }));
    await formShown();

    await user.click(tab('Security'));
    await user.click(tab('Account'));
    await act(() => router.navigate(-1));

    await waitFor(() => expect(url()).toBe('/overview'));
  });
});

// T16: AC5, the country code: the shared Dropdown with every code of #126 d, the current one selected.
describe('the country code', () => {
  it('lists every code once in numeric order with +1 selected, and a click chooses one', async () => {
    const { user } = await openSettings('/settings/account');
    await formShown();

    await user.click(countryCode());

    const list = await screen.findByRole('listbox');
    const options = within(list).getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual([...countryCallingCodes]);
    expect(within(list).getByRole('option', { name: '+1' })).toHaveAttribute('aria-selected', 'true');
    await user.click(within(list).getByRole('option', { name: '+880' }));

    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
    expect(countryCode()).toHaveTextContent('+880');
  });

  it('opens by keyboard, moves to the code its digits type, and closes on Escape with focus on the trigger', async () => {
    const { user } = await openSettings('/settings/account');
    await formShown();
    countryCode().focus();

    await user.keyboard('{Enter}');
    await screen.findByRole('listbox');
    await waitFor(() => expect(document.activeElement).toHaveTextContent('+1'));
    await user.keyboard('880');

    await waitFor(() => expect(document.activeElement).toHaveTextContent('+880'));
    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
    await waitFor(() => expect(countryCode()).toHaveFocus());
    expect(countryCode()).toHaveTextContent('+1');
  });
});

// T17: AC6, AC16, the shared rules in the form: one message under each field, focus on the first, nothing sent.
describe('the form’s rules', () => {
  const invalid: [string, () => HTMLElement, string, string][] = [
    ['an empty name', fullName, '', name.required],
    ['a name of spaces', fullName, '   ', name.required],
    ['a name of a zero-width space', fullName, '\u200B', name.required],
    ['a name with a pasted tab', fullName, 'Ana\tMarija', name.control],
    ['a name of 101 letters', fullName, 'a'.repeat(101), name.max],
    ['a name of 101 letters beyond the BMP', fullName, doubleStruck.repeat(101), name.max],
    ['an empty username', username, '', usernameText.required],
    ['a username of 2', username, 'ab', usernameText.min],
    ['a username of 31', username, 'a'.repeat(31), usernameText.max],
    ['a username with a hyphen', username, 'marko-d', usernameText.characters],
    ['a username with an uppercase letter', username, 'Marko', usernameText.characters],
    ['a username with a space inside', username, 'mar ko', usernameText.characters],
    ['a number with a letter', phoneNumber, '064a123', phoneText.digits],
    ['a number with a plus', phoneNumber, '+381641234', phoneText.digits],
    ['a number with a dot', phoneNumber, '064.123', phoneText.digits],
    ['a number with a slash', phoneNumber, '064/123', phoneText.digits],
    ['a number with a no-break space', phoneNumber, '064\u00A0123', phoneText.digits],
    ['a number of 16 digits', phoneNumber, '1234 5678 9012 3456', phoneText.max],
  ];

  // One test per case, each from the stored profile: as one test the 18 cases ran past the 5 s limit under the full
  // suite's load (task 028 approval).
  it.each(invalid)(
    'shows the message for %s under its field on a click, with focus there and nothing sent',
    async (_case, field, value, message) => {
      const { user } = await openSettings('/settings/account');
      await formShown();

      await retype(user, field(), value);
      await user.click(updateButton());

      await waitFor(() => expect(errorOf(field())).toBe(message));
      expect(field()).toHaveAttribute('aria-invalid', 'true');
      expect(field()).toHaveFocus();
      expect(patches()).toBe(0);
    },
  );

  it('shows every field’s message at once on Enter, focus on the first, one message per field', async () => {
    const { user } = await openSettings('/settings/account');
    await formShown();
    await retype(user, fullName(), ' ');
    await retype(user, username(), 'Ab');
    await retype(user, phoneNumber(), '12a');

    await user.type(phoneNumber(), '{Enter}');

    await waitFor(() => expect(errorOf(fullName())).toBe(name.required));
    expect(errorOf(username())).toBe(usernameText.min);
    expect(errorOf(phoneNumber())).toBe(phoneText.digits);
    expect(errorOf(email())).toBeNull();
    expect(fullName()).toHaveFocus();
    expect(patches()).toBe(0);
  });

  it.each<[string, Partial<Record<'fullName' | 'username' | 'phoneNumber', string>>, Record<string, string>]>([
    ['100 letters', { fullName: 'b'.repeat(100) }, { fullName: 'b'.repeat(100) }],
    ['100 letters beyond the BMP', { fullName: doubleStruck.repeat(100) }, { fullName: doubleStruck.repeat(100) }],
    [
      'a name with a caron and a stroke, spaces around',
      { fullName: '  Šabac Đorđević ' },
      { fullName: 'Šabac Đorđević' },
    ],
    ['a username of 3, spaces around', { username: ' abc ' }, { username: 'abc' }],
    ['a username of 30', { username: 'a'.repeat(30) }, { username: 'a'.repeat(30) }],
    ['a number of spaces and hyphens', { phoneNumber: ' - - ' }, { phoneNumber: '' }],
    ['111’s number', { phoneNumber: '51547 58868' }, { phoneNumber: '5154758868' }],
    ['a number with hyphens', { phoneNumber: '064-123-4567' }, { phoneNumber: '0641234567' }],
    ['15 digits with spaces', { phoneNumber: ' 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 ' }, { phoneNumber: '123456789012345' }],
  ])('sends %s as the shared schema outputs it', async (_case, typed, sent) => {
    const backend = profileBackend();
    const { user } = await openSettings('/settings/account', ...backend.handlers);
    await formShown();
    const fields = { fullName, username, phoneNumber };
    for (const [key, value] of Object.entries(typed)) await retype(user, fields[key as keyof typeof fields](), value);

    await user.click(updateButton());

    await waitFor(() => expect(backend.writes).toHaveLength(1));
    expect(Object.fromEntries(backend.writes[0]!.parts)).toEqual({
      fullName: 'Tanzir Rahman',
      username: 'tanzir',
      phoneCountryCode: '+1',
      phoneNumber: '',
      ...sent,
    });
  });
});

// T18: AC7, AC16, the save: one multipart request, the loading pattern, "Profile updated" and the stored values.
// #127 (b): "Save changes" is unavailable (aria-disabled, focus kept, as task 022) until a field differs from the stored
// value, and again after a successful save or once the values are back to the stored ones.
describe('Save changes, until a field changes', () => {
  it('is aria-disabled and focusable before any change, enables on the first and disables when the values are back', async () => {
    const { user } = await openSettings('/settings/account');
    await formShown();

    expect(updateButton()).toHaveAttribute('aria-disabled', 'true');
    expect(updateButton()).not.toBeDisabled();
    await user.type(fullName(), 'x');
    expect(updateButton()).not.toHaveAttribute('aria-disabled');
    await user.type(fullName(), '{Backspace}');
    expect(fullName()).toHaveValue('Tanzir Rahman');
    expect(updateButton()).toHaveAttribute('aria-disabled', 'true');
    // The country code counts too.
    await user.click(countryCode());
    await user.click(await screen.findByRole('option', { name: '+44' }));
    await waitFor(() => expect(updateButton()).not.toHaveAttribute('aria-disabled'));
  });

  it('sends nothing on a click or on Enter in a field while nothing changed', async () => {
    const { user } = await openSettings('/settings/account');
    await formShown();

    await user.click(updateButton());
    await user.type(username(), '{Enter}');
    await settle();

    expect(patches()).toBe(0);
    expect(screen.queryByRole('status')).toHaveTextContent('');
  });

  it('disables again after a successful save, focus kept on it, and stays enabled after a failed one', async () => {
    const backend = profileBackend();
    const { user } = await openSettings('/settings/account', ...backend.handlers);
    await formShown();
    await user.type(username(), '.r');

    await user.click(updateButton());

    await updatedShown();
    expect(updateButton()).toHaveAttribute('aria-disabled', 'true');
    expect(updateButton()).toHaveFocus();
    server.use(updateProfile.fails());
    await user.type(username(), 'x');
    await user.click(updateButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.');
    expect(updateButton()).not.toHaveAttribute('aria-disabled');
  });
});

describe('Save changes', () => {
  const saved: Profile = {
    fullName: 'Ana Marija Petrović',
    email: 'tanzir@example.com',
    username: 'ana.petrovic',
    phoneCountryCode: '+880',
    phoneNumber: '5154758868',
    // Task 030: the profile answers whether the user has a password (#2).
    hasPassword: true,
  };

  it('sends one PATCH of four text parts with the header, holds the form while it runs, then shows the result', async () => {
    const held = updateProfile.held(saved);
    const { user } = await openSettings('/settings/account', held.handler);
    await formShown();
    await retype(user, fullName(), '  Ana Marija Petrović ');
    await retype(user, username(), 'ana.petrovic');
    await user.click(countryCode());
    await user.click(await screen.findByRole('option', { name: '+880' }));
    await retype(user, phoneNumber(), '51547 58868');

    await user.click(updateButton());

    await waitFor(() => expect(held.writes).toHaveLength(1));
    expect(held.writes[0]!.parts).toEqual([
      ['fullName', 'Ana Marija Petrović'],
      ['username', 'ana.petrovic'],
      ['phoneCountryCode', '+880'],
      ['phoneNumber', '5154758868'],
    ]);
    expect(held.writes[0]!.contentType).toMatch(/^multipart\/form-data; boundary=/);
    expect(held.writes[0]!.expectedUser).toBe('tanzir@example.com');
    // The loading pattern (#6): busy, the name kept, focus kept.
    await waitFor(() => expect(updateButton()).toHaveAttribute('aria-busy', 'true'));
    expect(updateButton()).toHaveAttribute('aria-disabled', 'true');
    expect(updateButton()).toHaveFocus();
    expect(fullName()).toHaveAttribute('readonly');
    expect(username()).toHaveAttribute('readonly');
    expect(phoneNumber()).toHaveAttribute('readonly');
    expect(countryCode()).toBeDisabled();
    await user.click(updateButton());
    await user.type(username(), 'x{Enter}');
    expect(username()).toHaveValue('ana.petrovic');
    await settle();
    expect(patches()).toBe(1);

    held.release();

    await updatedShown();
    expect(fullName()).toHaveValue('Ana Marija Petrović');
    expect(phoneNumber()).toHaveValue('5154758868');
    expect(countryCode()).toHaveTextContent('+880');
    expect(updateButton()).not.toHaveAttribute('aria-busy');
    expect(updateButton()).toHaveFocus();
    expect(fullName()).not.toHaveAttribute('readonly');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('removes "Profile updated" when a field changes, and when Save changes is pressed again', async () => {
    const backend = profileBackend();
    const { user } = await openSettings('/settings/account', ...backend.handlers);
    await formShown();
    await user.type(username(), '1');

    await user.click(updateButton());
    await updatedShown();
    await user.type(username(), '2');
    expect(screen.getByRole('status')).toHaveTextContent('');

    await user.click(updateButton());
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Profile updated'));
    expect(backend.writes).toHaveLength(2);
  });

  // #127 (b): a save still sends all four fields, the unchanged ones too.
  it('sends all four fields when one changed', async () => {
    const backend = profileBackend();
    const { user } = await openSettings('/settings/account', ...backend.handlers);
    await formShown();
    await retype(user, phoneNumber(), '641234567');

    await user.click(updateButton());

    await updatedShown();
    expect(Object.fromEntries(backend.writes[0]!.parts)).toEqual({
      fullName: 'Tanzir Rahman',
      username: 'tanzir',
      phoneCountryCode: '+1',
      phoneNumber: '641234567',
    });
  });

  it('submits on Enter in a text field and puts focus on Save changes after the save', async () => {
    const backend = profileBackend();
    const { user } = await openSettings('/settings/account', ...backend.handlers);
    await formShown();

    await user.type(phoneNumber(), '0641234567{Enter}');

    await updatedShown();
    expect(updateButton()).toHaveFocus();
  });
});

// T19: AC8, AC14, a failed save keeps the typing and is not retried by itself.
describe('a failed save', () => {
  it.each([
    ['a 500', updateProfile.fails, 'Something went wrong.'],
    ['a network error', updateProfile.networkError, 'Something went wrong.'],
    [
      'another 4xx',
      () => updateProfile.clientError('Send the profile as multipart/form-data'),
      'Send the profile as multipart/form-data',
    ],
  ])(
    'shows the message above the button for %s, keeps the typing, and sends again on a new press',
    async (_case, handler, message) => {
      const { user } = await openSettings('/settings/account', handler());
      await formShown();
      await retype(user, fullName(), 'Typed Name');

      await user.click(updateButton());

      expect(await screen.findByRole('alert')).toHaveTextContent(message);
      expect(fullName()).toHaveValue('Typed Name');
      expect(updateButton()).toHaveFocus();
      await settle();
      expect(patches()).toBe(1);

      await user.click(updateButton());
      await waitFor(() => expect(patches()).toBe(2));
    },
  );

  // Code review (task 028): only a direct request can send a code outside the list, but the message must still describe
  // the code's control and take focus there, as every field's does (AC8, AC16).
  it('describes the country code by its 400 message, marks it invalid and puts focus on it', async () => {
    const { user } = await openSettings(
      '/settings/account',
      updateProfile.fieldErrors({ phoneCountryCode: 'Choose a country code' }),
    );
    await formShown();
    await user.type(phoneNumber(), '1');

    await user.click(updateButton());

    await waitFor(() => expect(countryCode()).toHaveFocus());
    expect(countryCode()).toHaveAccessibleDescription('Choose a country code');
    expect(countryCode()).toHaveAttribute('aria-invalid', 'true');
    expect(phoneNumber()).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows a 400’s field errors under their fields, focus on the first, nothing above the button', async () => {
    const { user } = await openSettings(
      '/settings/account',
      updateProfile.fieldErrors({
        phoneNumber: phoneText.digits,
        username: usernameText.characters,
        fullName: name.required,
        phoneCountryCode: 'Choose a country code',
      }),
    );
    await formShown();
    await user.type(phoneNumber(), '1');

    await user.click(updateButton());

    await waitFor(() => expect(errorOf(fullName())).toBe(name.required));
    expect(errorOf(username())).toBe(usernameText.characters);
    expect(errorOf(phoneNumber())).toBe(phoneText.digits);
    expect(screen.getByText('Choose a country code')).toBeInTheDocument();
    // Focus moves once the form is no longer saving (the country code is a disabled button until then).
    await waitFor(() => expect(fullName()).toHaveFocus());
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows "This username is already taken" under Username with focus there, the typing kept', async () => {
    const backend = profileBackend(demoProfile, { taken: ['other.person'] });
    const { user } = await openSettings('/settings/account', ...backend.handlers);
    await formShown();
    await retype(user, username(), 'other.person');

    await user.click(updateButton());

    await waitFor(() => expect(errorOf(username())).toBe(usernameText.taken));
    await waitFor(() => expect(username()).toHaveFocus());
    expect(username()).toHaveValue('other.person');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(backend.stored()).toEqual(demoProfile);
  });

  it('on the guard’s 409 shows its message, asks for the session once, and then shows the other user', async () => {
    const other: CurrentUser = { fullName: 'Bora Kostić', email: 'bora@example.com', username: 'bora' };
    let sessionUser: CurrentUser = signedInUser;
    // The check that finds Bora is held until the message has been seen; then the page shows Bora.
    const { promise: checked, resolve: answerCheck } = Promise.withResolvers<void>();
    const { user } = await openSettings(
      '/settings/account',
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
      http.patch('*/api/profile', () => {
        sessionUser = other;
        return HttpResponse.json({ message: writeGuardMessages.otherUser }, { status: 409 });
      }),
    );
    await formShown();
    await retype(user, fullName(), 'Typed For Tanzir');
    const before = count('GET /api/auth/me');

    await user.click(updateButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(writeGuardMessages.otherUser);
    expect(fullName()).toHaveValue('Typed For Tanzir');
    answerCheck();
    await waitFor(() => expect(within(profileBlock()).getByText('Bora Kostić')).toBeInTheDocument());
    await waitFor(() => expect(fullName()).toHaveValue('Bora Kostić'));
    expect(count('GET /api/auth/me')).toBe(before + 1);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

// T20: AC9, the shell's user from the save's own answer: no other request, a late session check cannot undo it.
describe('the shell after a save', () => {
  it('shows the new name and initials at once, greets with it on Overview, and asks for nothing but the PATCH', async () => {
    const backend = profileBackend();
    const { user } = await openSettings('/settings/account', ...backend.handlers);
    await formShown();
    appClient!.setQueryData(['accounts'], demoAccounts);
    const updatedAt = () =>
      appClient!
        .getQueryCache()
        .getAll()
        .filter((query) => !['session', 'profile'].includes(String(query.queryKey[0])))
        .map((query) => [JSON.stringify(query.queryKey), query.state.dataUpdatedAt]);
    const before = updatedAt();
    await retype(user, fullName(), 'Ana Marija Petrović');
    const sentBefore = requests.length;

    await user.click(updateButton());

    await waitFor(() => expect(within(profileBlock()).getByText('Ana Marija Petrović')).toBeInTheDocument());
    expect(screen.getByRole('img', { name: 'Ana Marija Petrović' })).toHaveTextContent('AP');
    expect(requests.slice(sentBefore)).toEqual(['PATCH /api/profile']);
    expect(updatedAt()).toEqual(before);

    await user.click(within(sidebar()).getByRole('link', { name: 'Overview' }));

    expect(await screen.findByText('Hello Ana')).toBeInTheDocument();
    await settle();
    expect(requests.slice(sentBefore).filter((request) => /\/api\/(auth\/me|profile)$/.test(request))).toEqual([
      'PATCH /api/profile',
    ]);
  });

  it('keeps the new name when a session check sent before the save answers after it with the old one', async () => {
    const backend = profileBackend();
    let meCalls = 0;
    const { promise: released, resolve: release } = Promise.withResolvers<void>();
    const { user } = await openSettings(
      '/settings/account',
      http.get('*/api/auth/me', async () => {
        meCalls += 1;
        if (meCalls > 1) await released;
        return HttpResponse.json(signedInUser);
      }),
      ...backend.handlers,
    );
    await formShown();
    await retype(user, fullName(), 'Ana Marija Petrović');
    // A session check on window focus, held until after the save.
    refocusWindow();
    await waitFor(() => expect(meCalls).toBe(2));

    await user.click(updateButton());
    await waitFor(() => expect(within(profileBlock()).getByText('Ana Marija Petrović')).toBeInTheDocument());
    release();
    await settle();

    expect(within(profileBlock()).getByText('Ana Marija Petrović')).toBeInTheDocument();
    expect(within(profileBlock()).queryByText('Tanzir Rahman')).toBeNull();
  });
});

// T21: AC15, the Account panel's states through DataState.
// Code review (task 028): the form reads the profile once, as it mounts, so it must mount from the stored profile, never
// from a cached answer older than a change made since (in another tab, or by a refetch answered after a save).
describe('the profile the form starts from', () => {
  it('shows the stored values on a return visit after the profile changed elsewhere', async () => {
    let answer: Profile = demoProfile;
    const { user } = await openSettings(
      '/settings/account',
      http.get('*/api/profile', () => HttpResponse.json(answer)),
    );
    await formShown();
    await user.click(within(sidebar()).getByRole('link', { name: 'Overview' }));
    await screen.findByText('Hello Tanzir');
    // Another tab saves a new name and username meanwhile.
    answer = { ...demoProfile, fullName: 'Changed Elsewhere', username: 'changed.elsewhere' };

    await user.click(within(sidebar()).getByRole('link', { name: 'Settings' }));

    await waitFor(() => expect(fullName()).toHaveValue('Changed Elsewhere'));
    expect(username()).toHaveValue('changed.elsewhere');
  });

  it('keeps the saved profile when a refetch sent before the save answers after it with the old values', async () => {
    const saved: Profile = { ...demoProfile, fullName: 'Ana Marija Petrović', username: 'ana.petrovic' };
    let gets = 0;
    const { promise: released, resolve: release } = Promise.withResolvers<void>();
    const { user } = await openSettings(
      '/settings/account',
      http.get('*/api/profile', async () => {
        gets += 1;
        // The first load answers at once; the refetch on window focus is held until after the save.
        if (gets > 1) await released;
        return HttpResponse.json(demoProfile);
      }),
      http.patch('*/api/profile', () => HttpResponse.json(saved)),
    );
    await formShown();
    refocusWindow();
    await waitFor(() => expect(gets).toBeGreaterThan(1));
    await retype(user, fullName(), 'Ana Marija Petrović');
    await retype(user, username(), 'ana.petrovic');

    await user.click(updateButton());
    await updatedShown();
    release();
    await settle();

    expect(appClient!.getQueryData(['profile'])).toEqual(saved);
    expect(fullName()).toHaveValue('Ana Marija Petrović');
  });
});

describe('the Account panel’s states', () => {
  it('shows the tabs and a skeleton while the profile loads', async () => {
    const { container } = await openSettings('/settings/account', profile.pending());

    expect(tablist()).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(container.querySelector('[aria-hidden="true"] [class*="skeleton"]')).not.toBeNull();
  });

  it('shows the error state with Retry, keeps focus in the panel on Retry, and then the form', async () => {
    const { user } = await openSettings('/settings/account', profile.failsThenAnswers());

    const retry = await screen.findByRole('button', { name: 'Retry' }, { timeout: 10_000 });
    // Task 030: the hidden Security panel shows the same error state (one profile query for both): the visible one.
    expect(
      screen.getAllByText('Something went wrong.').filter((element) => element.closest('[hidden]') === null),
    ).toHaveLength(1);
    expect(tablist()).toBeInTheDocument();
    await user.click(retry);

    await formShown();
    const panel = screen.getByRole('tabpanel');
    expect(panel).toContainElement(dataStateRootIn(panel));
  }, 15_000);

  it('keeps the typing when a refetch on window focus answers other values', async () => {
    let answer: Profile = demoProfile;
    const { user } = await openSettings(
      '/settings/account',
      http.get('*/api/profile', () => HttpResponse.json(answer)),
    );
    await formShown();
    await retype(user, fullName(), 'Typed Name');
    answer = { ...demoProfile, fullName: 'Changed Elsewhere', username: 'changed' };
    const gets = count('GET /api/profile');

    refocusWindow();
    await waitFor(() => expect(count('GET /api/profile')).toBe(gets + 1));
    await settle();

    expect(fullName()).toHaveValue('Typed Name');
    expect(username()).toHaveValue('tanzir');
  });

  it('keeps the data and the form with no message when a refetch fails', async () => {
    let fail = false;
    const { user } = await openSettings(
      '/settings/account',
      http.get('*/api/profile', async () => {
        if (!fail) return HttpResponse.json(demoProfile);
        await delay(1);
        return HttpResponse.json({ message: 'Internal server error' }, { status: 500 });
      }),
    );
    await formShown();
    await retype(user, username(), 'typed');
    fail = true;

    refocusWindow();
    await waitFor(() => expect(appClient!.getQueryState(['profile'])?.status).toBe('error'), { timeout: 10_000 });

    expect(username()).toHaveValue('typed');
    expect(screen.queryByText('Something went wrong.')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  }, 15_000);
});

// T33: AC18, #126 a's condition: a stored name that breaks the rule shows everywhere and is refused only on save.
describe('a stored Full name that breaks the rule', () => {
  it.each([
    ['a tab inside', 'Ana\tMarija', 'Hello Ana', name.control],
    ['only a zero-width space', '\u200B', 'Hello \u200B', name.required],
    ['101 letters', 'a'.repeat(101), `Hello ${'a'.repeat(101)}`, name.max],
  ])(
    'with %s shows in the sidebar, the greeting and the form, and is refused on save',
    async (_case, stored, greeting, message) => {
      const storedUser: CurrentUser = { ...signedInUser, fullName: stored };
      server.use(
        today.answers(),
        http.get('*/api/auth/me', () => HttpResponse.json(storedUser)),
        http.get('*/api/profile', () =>
          HttpResponse.json({ ...storedUser, phoneCountryCode: '+1', phoneNumber: '', hasPassword: true }),
        ),
      );
      const { user } = renderApp('/overview', probedRoutes, { strict: true });
      // The name, and for a one-character name its initial too.
      await waitFor(() => expect(within(profileBlock()).getAllByText(shownAs(stored)).length).toBeGreaterThan(0));
      expect(await screen.findByText(shownAs(greeting))).toBeInTheDocument();
      await user.click(within(sidebar()).getByRole('link', { name: 'Settings' }));
      await formShown();
      expect(fullName()).toHaveValue(stored);
      // #127: nothing to save until a field changes; another field changed, the stored name is refused on save.
      expect(updateButton()).toHaveAttribute('aria-disabled', 'true');
      await user.type(username(), '1');

      await user.click(updateButton());

      await waitFor(() => expect(errorOf(fullName())).toBe(message));
      expect(patches()).toBe(0);
      expect(screen.queryByText('Something went wrong.')).toBeNull();
    },
  );
});

const source = (path: string) => readFileSync(resolve(import.meta.dirname, '../../src', path), 'utf8');

/** The Settings screens: they show the values as sent and only format them (#74). */
const screens = [
  'app/pages/SettingsPage.tsx',
  'components/ProfileForm/ProfileForm.tsx',
  'components/SettingsInput/SettingsInput.tsx',
  'components/SettingsPhoneInput/SettingsPhoneInput.tsx',
  'api/profile.ts',
];

// T22: AC19, the form's rules only from the shared schema; the save only through useUserWrite.
describe('Settings sources', () => {
  /** A rule of its own: a trim, a code point count, a Unicode class, a length limit, a pattern, a replace, a test. */
  const ownRule =
    /\.trim(Start|End)?\(|\[\.\.\.\w+\]\.length|codePointAt|Segmenter|\\p\{|\bmaxLength\b|maxlength|\.length\s*[<>]|\bpattern=|\.replace(All)?\(|\.test\(/;

  it.each([
    'name.trim()',
    '[...name].length',
    '/^\\p{L}+$/u',
    'value.length <= 100',
    '<input maxLength={30} />',
    "text.replaceAll(/ /g, '')",
    '/^[0-9]*$/.test(phone)',
  ])('flags %s', (code) => {
    expect(ownRule.test(code)).toBe(true);
  });

  it.each(screens)('%s has no rule of its own', (path) => {
    expect(source(path)).not.toMatch(ownRule);
  });

  it('takes the form’s rule from profileUpdateRequestSchema', () => {
    expect(source('components/ProfileForm/ProfileForm.tsx')).toMatch(/zodResolver\(profileUpdateRequestSchema\)/);
  });

  it('saves only through useUserWrite, with the contract’s entry', () => {
    const api = source('api/profile.ts');

    expect(api).toMatch(/useUserWrite\(\{[\s\S]*entry: profileContract\.update/);
    expect(api).not.toMatch(/\buseMutation\(|\bsendWrite\(|\bapiWrite\(/);
  });
});
