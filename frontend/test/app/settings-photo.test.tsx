import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { type Profile, photoSchema } from '@finebank/shared';
import { focusManager } from '@tanstack/react-query';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  dataStateRootIn,
  demoProfile,
  me,
  profile,
  profileBackend,
  renderApp,
  savedPhotoTimes,
  signedInDefaults,
  signedInUser,
  today,
  updateProfile,
} from '../support/app';
import { sendFilesThroughNodeFetch } from '../support/multipart';

const server = setupServer(...signedInDefaults());

/** Every request the app sends, as `METHOD /path?query`. */
let requests: string[] = [];
let restoreFetch: () => void;

/** Every object URL the app made and revoked, in order (jsdom has neither function: the browser's stand-ins). */
let made: string[] = [];
let revoked: string[] = [];
const createObjectURL = vi.fn<(file: Blob) => string>((_file) => {
  const url = `blob:http://localhost:3000/preview-${made.length + 1}`;
  made.push(url);
  return url;
});
const revokeObjectURL = vi.fn<(url: string) => void>((url) => {
  revoked.push(url);
});

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
  // After the server listens: the wrapper goes around MSW's fetch.
  restoreFetch = sendFilesThroughNodeFetch();
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: createObjectURL });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: revokeObjectURL });
});
beforeEach(() => {
  requests = [];
  made = [];
  revoked = [];
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
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
  vi.restoreAllMocks();
});
afterAll(() => {
  restoreFetch();
  server.close();
});

type User = ReturnType<typeof userEvent.setup>;

/** The app signed in at `path`, with `handlers` first, once its page shows. In StrictMode. */
async function openSettings(path: string, ...handlers: Parameters<typeof server.use>) {
  server.use(...handlers, me.signedIn(), today.answers());
  const view = renderApp(path, undefined, { strict: true });
  if (path.startsWith('/settings')) await screen.findByRole('tablist', { name: 'Settings' });
  else await screen.findByRole('main');
  // The file input's accept list is the picker's filter only: the rule decides, so the tests choose any file.
  return { ...view, user: userEvent.setup({ applyAccept: false }) };
}

const formShown = () => screen.findByRole('group', { name: 'Your Profile Picture' });
const group = () => screen.getByRole('group', { name: 'Your Profile Picture' });
const box = () => within(group()).getByRole('button', { name: 'Upload your photo' });
const clearButton = () => screen.getByRole('button', { name: 'Clear the chosen photo' });
const queryClear = () => screen.queryByRole('button', { name: 'Clear the chosen photo' });
const fileInput = () => group().querySelector<HTMLInputElement>('input[type="file"]')!;
const boxImage = () => box().querySelector('img');
const fullName = () => screen.getByRole('textbox', { name: 'Full name' });
const username = () => screen.getByRole('textbox', { name: 'Username' });
const phoneNumber = () => screen.getByRole('textbox', { name: 'Phone Number' });
const updateButton = () => screen.getByRole('button', { name: 'Save changes' });
const sidebar = () => screen.getByRole('navigation', { name: 'Main' });
const profileBlock = () => sidebar().parentElement!;
const avatar = () => within(profileBlock()).getByRole('img', { name: 'Tanzir Rahman' });

/** The texts an element is described by, in order. */
const descriptionOf = (element: HTMLElement) =>
  (element.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent ?? '');

const count = (request: string) => requests.filter((sent) => sent === request).length;
const writes = () => requests.filter((request) => !request.startsWith('GET '));
const settle = () => new Promise((done) => setTimeout(done, 50));
const refocusWindow = () =>
  act(() => {
    focusManager.setFocused(false);
    focusManager.setFocused(true);
  });

async function retype(user: User, field: HTMLElement, text: string) {
  await user.clear(field);
  if (text) await user.paste(text);
}

/** The browser's picker: the box clicked (it opens), then the file chosen, or none (cancelled). Focus stays on the box. */
async function choose(user: User, file?: File) {
  await user.click(box());
  fireEvent.change(fileInput(), { target: { files: file ? [file] : [] } });
}

/** Waits until a chosen file is kept: "Not saved" shows. */
const kept = () => screen.findByText('Not saved');

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_START = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46];

/** `start` padded with zeros to `size` bytes. */
const bytes = (start: number[], size: number) => {
  const all = new Uint8Array(size);
  all.set(start);
  return all;
};
const png = (name = 'me.png', size = 64) => new File([bytes(PNG_SIGNATURE, size)], name, { type: 'image/png' });
const jpeg = (name = 'me.jpg', size = 64) => new File([bytes(JPEG_START, size)], name, { type: 'image/jpeg' });

const tooLarge = 'Photo must be at most 2 MB';
const notImage = 'Photo must be a JPG or PNG file';

const ascii = (text: string) => Uint8Array.from(text, (char) => char.charCodeAt(0));
/** Each file the rule refuses, with its one message. */
const refused: [string, () => File, string][] = [
  ['an empty file', () => new File([], 'empty.png', { type: 'image/png' }), notImage],
  ['a GIF', () => new File([ascii('GIF89a\u0001\u0000')], 'a.gif', { type: 'image/gif' }), notImage],
  [
    'a WebP',
    () => new File([ascii('RIFF\u0000\u0000\u0000\u0000WEBPVP8 ')], 'a.webp', { type: 'image/webp' }),
    notImage,
  ],
  [
    'an SVG',
    () => new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], 'a.svg', { type: 'image/svg+xml' }),
    notImage,
  ],
  ['a PDF', () => new File(['%PDF-1.7\n'], 'a.pdf', { type: 'application/pdf' }), notImage],
  ['a text file named .png', () => new File(['not an image'], 'photo.png', { type: 'image/png' }), notImage],
  ['2,097,153 bytes', () => png('big.png', 2_097_153), tooLarge],
];

const storedTime = '2026-10-21T08:30:00.000Z';
/** The stored photo's address for `time`: the contract's path and `?v=` (#76). */
const photoAddress = (time: string) => `/api/profile/photo?v=${encodeURIComponent(time)}`;
const withPhoto: Profile = { ...demoProfile, photoUpdatedAt: storedTime };

// T14: AC1, AC16, the box as a control: a button in its group, in the Tab order, opening the picker; the stored photo.
describe('the upload box', () => {
  it('is a button named "Upload your photo" in the group "Your Profile Picture", as 111 without a photo', async () => {
    await openSettings('/settings/account');
    await formShown();

    expect(box()).toHaveAttribute('type', 'button');
    expect(within(box()).getByText(/Upload your/)).toBeInTheDocument();
    expect(box().querySelector('svg')).not.toBeNull();
    expect(boxImage()).toBeNull();
    expect(group()).not.toHaveAttribute('aria-hidden');
    expect(group().closest('[inert]')).toBeNull();
    expect(queryClear()).toBeNull();
    expect(screen.queryByText('Not saved')).toBeNull();
  });

  it('comes after Phone Number and before Save changes in the Tab order; the file input is never a Tab stop', async () => {
    const { user } = await openSettings('/settings/account');
    await formShown();
    await retype(user, fullName(), 'Typed Name');

    phoneNumber().focus();
    await user.tab();
    expect(box()).toHaveFocus();
    await user.tab();
    expect(updateButton()).toHaveFocus();
    await user.tab({ shift: true });
    expect(box()).toHaveFocus();
    expect(fileInput()).toHaveAttribute('tabindex', '-1');
    expect(fileInput()).not.toBeVisible();
    expect(fileInput()).toHaveAttribute('accept', 'image/jpeg,image/png');
  });

  it('opens the file picker on a click, on Enter and on Space', async () => {
    const { user } = await openSettings('/settings/account');
    await formShown();
    const open = vi.spyOn(fileInput(), 'click');

    await user.click(box());
    expect(open).toHaveBeenCalledTimes(1);
    await user.keyboard('{Enter}');
    expect(open).toHaveBeenCalledTimes(2);
    await user.keyboard(' ');
    expect(open).toHaveBeenCalledTimes(3);
    expect(writes()).toEqual([]);
  });

  it('shows the stored photo in the box, the icon and text not shown, the name kept', async () => {
    await openSettings('/settings/account', profile.answers(withPhoto));
    await formShown();

    await waitFor(() => expect(boxImage()).toHaveAttribute('src', photoAddress(storedTime)));
    expect(boxImage()).toHaveAttribute('alt', '');
    expect(box()).toHaveAccessibleName('Upload your photo');
    expect(within(box()).queryByText(/Upload your/)).toBeNull();
    expect(box().querySelector('svg')).toBeNull();
  });

  it('shows the empty look when the stored photo fails to load', async () => {
    await openSettings('/settings/account', profile.answers(withPhoto));
    await formShown();
    await waitFor(() => expect(boxImage()).not.toBeNull());

    fireEvent.error(boxImage()!);

    expect(boxImage()).toBeNull();
    expect(within(box()).getByText(/Upload your/)).toBeInTheDocument();
  });
});

// T15: AC2, AC19, a valid chosen file: a local preview, "Not saved" and "Clear", the object URL's life.
describe('a chosen photo', () => {
  it('shows a preview from an object URL, "Not saved" and "Clear", enables Save changes, and sends nothing', async () => {
    const { user } = await openSettings('/settings/account');
    await formShown();
    expect(updateButton()).toHaveAttribute('aria-disabled', 'true');
    const file = png();

    await choose(user, file);
    await kept();

    expect(createObjectURL).toHaveBeenCalledWith(file);
    await waitFor(() => expect(boxImage()).toHaveAttribute('src', made.at(-1)));
    expect(within(box()).queryByText(/Upload your/)).toBeNull();
    expect(clearButton()).toHaveTextContent('Clear');
    expect(descriptionOf(box())).toEqual(['Not saved']);
    expect(box()).toHaveFocus();
    expect(updateButton()).not.toHaveAttribute('aria-disabled');
    expect(writes()).toEqual([]);
    expect(requests.filter((request) => request.includes('photo'))).toEqual([]);
  });

  it('clears the choice: the empty box again, the line gone, focus on the box, the button unavailable, the URL revoked', async () => {
    const { user } = await openSettings('/settings/account');
    await formShown();
    await choose(user, png());
    await kept();

    await user.click(clearButton());

    expect(boxImage()).toBeNull();
    expect(screen.queryByText('Not saved')).toBeNull();
    expect(queryClear()).toBeNull();
    expect(box()).toHaveFocus();
    expect(descriptionOf(box())).toEqual([]);
    expect(updateButton()).toHaveAttribute('aria-disabled', 'true');
    expect(revoked).toEqual(made);
  });

  it('returns to the stored photo on Clear', async () => {
    const { user } = await openSettings('/settings/account', profile.answers(withPhoto));
    await formShown();
    await choose(user, png());
    await kept();

    await user.click(clearButton());

    await waitFor(() => expect(boxImage()).toHaveAttribute('src', photoAddress(storedTime)));
  });

  it('lets the same file be chosen again after Clear, with a new URL', async () => {
    const { user } = await openSettings('/settings/account');
    await formShown();
    const file = png();
    await choose(user, file);
    await kept();
    await user.click(clearButton());
    expect(fileInput().value).toBe('');

    await choose(user, file);
    await kept();

    await waitFor(() => expect(boxImage()).toHaveAttribute('src', made.at(-1)));
    expect(revoked).not.toContain(made.at(-1));
  });

  it('replaces the choice with another file, revoking the old URL; a cancelled picker keeps it', async () => {
    const { user } = await openSettings('/settings/account');
    await formShown();
    await choose(user, png());
    await kept();
    const first = made.at(-1)!;

    await choose(user, jpeg());
    await waitFor(() => expect(made.at(-1)).not.toBe(first));
    await waitFor(() => expect(boxImage()).toHaveAttribute('src', made.at(-1)));
    expect(revoked).toContain(first);
    const second = made.at(-1)!;

    await choose(user, undefined);
    await settle();

    expect(boxImage()).toHaveAttribute('src', second);
    expect(screen.getByText('Not saved')).toBeInTheDocument();
    expect(revoked).not.toContain(second);
  });

  it('keeps a file the browser cannot draw (a JPEG cut short) with the empty look, "Not saved" and "Clear"', async () => {
    const { user } = await openSettings('/settings/account');
    await formShown();
    await choose(user, jpeg('cut.jpg', 20));
    await kept();
    await waitFor(() => expect(boxImage()).not.toBeNull());

    fireEvent.error(boxImage()!);

    expect(boxImage()).toBeNull();
    expect(within(box()).getByText(/Upload your/)).toBeInTheDocument();
    expect(screen.getByText('Not saved')).toBeInTheDocument();
    expect(clearButton()).toBeInTheDocument();
    expect(updateButton()).not.toHaveAttribute('aria-disabled');
  });

  it('keeps Save changes available after Clear when another field changed', async () => {
    const { user } = await openSettings('/settings/account');
    await formShown();
    await retype(user, fullName(), 'Another Name');
    await choose(user, png());
    await kept();

    await user.click(clearButton());

    expect(updateButton()).not.toHaveAttribute('aria-disabled');
  });

  it('revokes the URL when Settings is left with a file chosen', async () => {
    const { user } = await openSettings('/settings/account');
    await formShown();
    await choose(user, png());
    await kept();

    await user.click(within(sidebar()).getByRole('link', { name: 'Overview' }));
    await screen.findByText(/Hello/);

    expect(revoked.toSorted()).toEqual(made.toSorted());
  });

  it('makes each URL once per chosen file and revokes each exactly once, StrictMode included', async () => {
    const { user, unmount } = await openSettings('/settings/account');
    await formShown();
    await choose(user, png());
    await kept();
    const first = made.at(-1);
    await choose(user, jpeg());
    await waitFor(() => expect(made.at(-1)).not.toBe(first));
    await waitFor(() => expect(boxImage()).toHaveAttribute('src', made.at(-1)));
    await user.click(clearButton());

    unmount();

    expect(made.length).toBeGreaterThanOrEqual(2);
    expect(revoked.toSorted()).toEqual(made.toSorted());
    expect(new Set(revoked).size).toBe(revoked.length);
  });
});

/** Two files chosen quickly, the first one's check held until the second's has answered. */
async function chooseTwoQuickly(first: File, second: File) {
  const real = photoSchema.safeParseAsync.bind(photoSchema);
  const { promise: held, resolve: release } = Promise.withResolvers<void>();
  let calls = 0;
  vi.spyOn(photoSchema, 'safeParseAsync').mockImplementation(async (value) => {
    calls += 1;
    if (calls === 1) await held;
    return real(value);
  });
  const { user } = await openSettings('/settings/account');
  await formShown();
  await choose(user, first);
  await choose(user, second);
  await settle();
  release();
  await settle();
}

/** `file` made unreadable, as a chosen file changed or removed on disk is: its first bytes cannot be read. */
const unreadable = (file: File) => {
  vi.spyOn(file, 'slice').mockReturnValue({
    arrayBuffer: () => Promise.reject(new DOMException('The file changed', 'NotReadableError')),
  } as unknown as Blob);
  return file;
};

// T16: AC3, a refused choice: its one message at once, not kept, nothing sent.
describe('a refused photo', () => {
  it.each(refused)(
    'refuses %s at once with its message under the box, keeping nothing',
    async (_case, make, message) => {
      const { user } = await openSettings('/settings/account');
      await formShown();

      await choose(user, make());

      await waitFor(() => expect(descriptionOf(box())).toEqual([message]));
      expect(box()).toHaveAttribute('aria-invalid', 'true');
      expect(box()).toHaveFocus();
      expect(screen.getByText(message).closest('[aria-live="polite"]')).not.toBeNull();
      expect(createObjectURL).not.toHaveBeenCalled();
      expect(boxImage()).toBeNull();
      expect(screen.queryByText('Not saved')).toBeNull();
      expect(queryClear()).toBeNull();
      expect(updateButton()).toHaveAttribute('aria-disabled', 'true');
      await user.click(updateButton());
      await settle();
      expect(writes()).toEqual([]);
    },
  );

  it.each(refused)(
    'keeps an earlier valid choice and its preview when %s is chosen after it',
    async (_case, make, message) => {
      const { user } = await openSettings('/settings/account');
      await formShown();
      await choose(user, png());
      await kept();
      const preview = made.at(-1);

      await choose(user, make());

      await waitFor(() => expect(screen.getByText(message)).toBeInTheDocument());
      expect(boxImage()).toHaveAttribute('src', preview);
      expect(screen.getByText('Not saved')).toBeInTheDocument();
      expect(clearButton()).toBeInTheDocument();
      expect(descriptionOf(box())).toEqual(['Not saved', message]);
      expect(updateButton()).not.toHaveAttribute('aria-disabled');
      expect(made).toHaveLength(1);
    },
  );

  it('removes the message when a valid file is chosen', async () => {
    const { user } = await openSettings('/settings/account');
    await formShown();
    await choose(user, new File(['x'], 'x.png'));
    await screen.findByText(notImage);

    await choose(user, png());
    await kept();

    expect(screen.queryByText(notImage)).toBeNull();
    expect(box()).not.toHaveAttribute('aria-invalid');
  });

  it('replaces the message with the next refused file’s', async () => {
    const { user } = await openSettings('/settings/account');
    await formShown();
    await choose(user, new File(['x'], 'x.png'));
    await screen.findByText(notImage);

    await choose(user, png('big.png', 2_097_153));

    await screen.findByText(tooLarge);
    expect(screen.queryByText(notImage)).toBeNull();
  });

  it('removes the message on Clear of the earlier choice', async () => {
    const { user } = await openSettings('/settings/account');
    await formShown();
    await choose(user, png());
    await kept();
    await choose(user, new File(['x'], 'x.png'));
    await screen.findByText(notImage);

    await user.click(clearButton());

    expect(screen.queryByText(notImage)).toBeNull();
    expect(box()).not.toHaveAttribute('aria-invalid');
  });

  it('removes the message when Save changes runs, and the save sends no photo', async () => {
    const backend = profileBackend();
    const { user } = await openSettings('/settings/account', ...backend.handlers);
    await formShown();
    await choose(user, new File(['x'], 'x.png'));
    await screen.findByText(notImage);
    await retype(user, fullName(), 'Saved Name');

    await user.click(updateButton());

    await waitFor(() => expect(backend.writes).toHaveLength(1));
    expect(screen.queryByText(notImage)).toBeNull();
    expect(backend.writes[0]!.parts.map(([name]) => name)).toEqual([
      'fullName',
      'username',
      'phoneCountryCode',
      'phoneNumber',
    ]);
  });

  it.each([
    ['exactly 2,097,152 bytes', () => png('limit.png', 2_097_152)],
    ['a JPEG named .png', () => jpeg('photo.png')],
    ['a PNG named .jpg', () => png('photo.jpg')],
    ['a name without an extension', () => png('photo')],
    ['a PNG declared as text/plain', () => new File([bytes(PNG_SIGNATURE, 32)], 'x.txt', { type: 'text/plain' })],
  ])('keeps %s with its preview', async (_case, make) => {
    const { user } = await openSettings('/settings/account');
    await formShown();

    await choose(user, make());

    await kept();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(box()).not.toHaveAttribute('aria-invalid');
  });

  // Task 029 review: a chosen file the browser can no longer read (changed or removed on disk) is refused by the rule,
  // at once or on save; the form never stops.

  it('refuses a chosen file it cannot read at once, keeping nothing', async () => {
    const { user } = await openSettings('/settings/account');
    await formShown();

    await choose(user, unreadable(png()));

    await waitFor(() => expect(descriptionOf(box())).toEqual([notImage]));
    expect(screen.queryByText('Not saved')).toBeNull();
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('refuses a kept file that became unreadable when Save changes runs, and saves again after Clear', async () => {
    const backend = profileBackend();
    const { user } = await openSettings('/settings/account', ...backend.handlers);
    await formShown();
    const file = png();
    await choose(user, file);
    await kept();
    unreadable(file);

    await user.click(updateButton());

    await waitFor(() => expect(descriptionOf(box())).toEqual(['Not saved', notImage]));
    await waitFor(() => expect(box()).toHaveFocus());
    expect(backend.writes).toEqual([]);
    await user.click(clearButton());
    await retype(user, fullName(), 'Saved After Clear');
    await user.click(updateButton());
    await waitFor(() => expect(backend.writes).toHaveLength(1));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Profile updated'));
  });

  it('checks each choice with the shared photoSchema only', async () => {
    const check = vi.spyOn(photoSchema, 'safeParseAsync');
    const { user } = await openSettings('/settings/account');
    await formShown();
    const file = png();

    await choose(user, file);
    await kept();

    expect(check).toHaveBeenCalledWith(file);
  });

  it('applies only the latest of two quick choices: refused, then valid', async () => {
    await chooseTwoQuickly(new File(['x'], 'x.png'), png());

    await kept();
    expect(screen.queryByText(notImage)).toBeNull();
  });

  it('applies only the latest of two quick choices: valid, then refused', async () => {
    await chooseTwoQuickly(png(), new File(['x'], 'x.png'));

    await screen.findByText(notImage);
    expect(screen.queryByText('Not saved')).toBeNull();
    expect(createObjectURL).not.toHaveBeenCalled();
  });
});

// T17: AC4, the save with a photo: one multipart PATCH with the file part, then the stored photo in the box and sidebar.
describe('Save changes with a photo', () => {
  it('sends the four text parts and the photo, holds the form, then shows the stored photo in the box and the sidebar', async () => {
    const saved: Profile = { ...demoProfile, photoUpdatedAt: savedPhotoTimes[0]! };
    const held = updateProfile.held(saved);
    const { user } = await openSettings('/settings/account', held.handler);
    await formShown();
    const file = png('holiday photo.png', 40);
    await choose(user, file);
    await kept();
    const preview = made.at(-1)!;
    const sentBefore = requests.length;

    await user.click(updateButton());

    await waitFor(() => expect(held.writes).toHaveLength(1));
    const [write] = held.writes;
    expect(write!.parts).toEqual([
      ['fullName', 'Tanzir Rahman'],
      ['username', 'tanzir'],
      ['phoneCountryCode', '+1'],
      ['phoneNumber', ''],
      ['photo', 'file photo'],
    ]);
    expect(write!.photo).toEqual({ name: 'photo', type: 'image/png', bytes: [...bytes(PNG_SIGNATURE, 40)] });
    expect(write!.expectedUser).toBe('tanzir@example.com');
    expect(write!.contentType).toMatch(/^multipart\/form-data; boundary=/);
    // While it runs: the loading pattern, the box and Clear disabled, the preview kept.
    await waitFor(() => expect(updateButton()).toHaveAttribute('aria-busy', 'true'));
    expect(box()).toBeDisabled();
    expect(clearButton()).toBeDisabled();
    expect(boxImage()).toHaveAttribute('src', preview);

    held.release();

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Profile updated'));
    expect(screen.queryByText('Not saved')).toBeNull();
    expect(queryClear()).toBeNull();
    await waitFor(() => expect(boxImage()).toHaveAttribute('src', photoAddress(savedPhotoTimes[0]!)));
    expect(avatar()).toHaveAttribute('src', photoAddress(savedPhotoTimes[0]!));
    expect(updateButton()).toHaveFocus();
    expect(updateButton()).toHaveAttribute('aria-disabled', 'true');
    expect(box()).not.toBeDisabled();
    expect(revoked).toContain(preview);
    await settle();
    expect(requests.slice(sentBefore)).toEqual(['PATCH /api/profile']);
  });

  it('sends exactly task 028’s four parts when no photo is chosen, keeping the stored photo', async () => {
    const backend = profileBackend(withPhoto);
    const { user } = await openSettings('/settings/account', ...backend.handlers);
    await formShown();
    await retype(user, fullName(), 'Text Only');

    await user.click(updateButton());

    await waitFor(() => expect(backend.writes).toHaveLength(1));
    expect(backend.writes[0]!.parts.map(([name]) => name)).toEqual([
      'fullName',
      'username',
      'phoneCountryCode',
      'phoneNumber',
    ]);
    expect(backend.writes[0]!.photo).toBeUndefined();
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Profile updated'));
    expect(boxImage()).toHaveAttribute('src', photoAddress(storedTime));
  });

  it('gives a second photo save a new address in the box and the sidebar', async () => {
    const backend = profileBackend();
    const { user } = await openSettings('/settings/account', ...backend.handlers);
    await formShown();
    await choose(user, png());
    await kept();
    await user.click(updateButton());
    await waitFor(() => expect(avatar()).toHaveAttribute('src', photoAddress(savedPhotoTimes[0]!)));

    await choose(user, jpeg());
    await kept();
    await user.click(updateButton());

    await waitFor(() => expect(avatar()).toHaveAttribute('src', photoAddress(savedPhotoTimes[1]!)));
    expect(boxImage()).toHaveAttribute('src', photoAddress(savedPhotoTimes[1]!));
    expect(backend.writes.map((write) => write.photo?.type)).toEqual(['image/png', 'image/jpeg']);
  });
});

/** Settings with a photo chosen, then "Save changes" pressed, `handlers` answering; the preview's URL. */
async function saveFailing(...handlers: Parameters<typeof server.use>) {
  const view = await openSettings('/settings/account', ...handlers);
  await formShown();
  await choose(view.user, png());
  await kept();
  const preview = made.at(-1);
  await view.user.click(updateButton());
  return { ...view, preview };
}

// T18: AC6, a failed save keeps the choice and the preview; the photo's server error under the box.
describe('a failed save with a photo', () => {
  it('shows a 400’s photo error under the box with focus there, the preview kept', async () => {
    const { preview } = await saveFailing(updateProfile.fieldErrors({ photo: notImage }));

    await waitFor(() => expect(box()).toHaveFocus());
    expect(descriptionOf(box())).toEqual(['Not saved', notImage]);
    expect(box()).toHaveAttribute('aria-invalid', 'true');
    expect(boxImage()).toHaveAttribute('src', preview);
    expect(screen.queryByText('Something went wrong.')).toBeNull();
    expect(count('PATCH /api/profile')).toBe(1);
  });

  it('shows the taken username under Username, the preview kept', async () => {
    const { preview } = await saveFailing(updateProfile.usernameTaken());

    await waitFor(() => expect(username()).toHaveFocus());
    expect(descriptionOf(username())).toEqual(['This username is already taken']);
    expect(boxImage()).toHaveAttribute('src', preview);
    expect(screen.getByText('Not saved')).toBeInTheDocument();
    expect(count('PATCH /api/profile')).toBe(1);
  });

  it.each([
    ['a 500', updateProfile.fails, 'Something went wrong.'],
    ['a network failure', updateProfile.networkError, 'Something went wrong.'],
    [
      'another 4xx',
      () => updateProfile.clientError('Send the profile as multipart/form-data'),
      'Send the profile as multipart/form-data',
    ],
  ])('shows %s above the button with focus on it, the choice and preview kept', async (_case, handler, message) => {
    const { preview } = await saveFailing(handler());

    await screen.findByText(message);
    await waitFor(() => expect(updateButton()).toHaveFocus());
    expect(boxImage()).toHaveAttribute('src', preview);
    expect(screen.getByText('Not saved')).toBeInTheDocument();
    expect(updateButton()).not.toHaveAttribute('aria-disabled');
    expect(revoked).not.toContain(preview);
    await settle();
    expect(count('PATCH /api/profile')).toBe(1);
  });
});

// T19: AC13, the sidebar avatar from the session user's photo time.
describe('the sidebar avatar', () => {
  it('shows the photo for a session user with one, on every app page', async () => {
    const { user } = await openSettings(
      '/overview',
      http.get('*/api/auth/me', () => HttpResponse.json({ ...signedInUser, photoUpdatedAt: storedTime })),
    );

    expect(avatar()).toHaveAttribute('src', photoAddress(storedTime));
    await user.click(within(sidebar()).getByRole('link', { name: 'Settings' }));
    await formShown();
    expect(avatar()).toHaveAttribute('src', photoAddress(storedTime));
  });

  it('shows the initials without a photo', async () => {
    await openSettings('/overview');

    expect(avatar().tagName).not.toBe('IMG');
    expect(avatar()).toHaveTextContent('TR');
  });

  it('follows another tab’s save at the next session check', async () => {
    let answer: Record<string, string> = { ...signedInUser };
    await openSettings(
      '/overview',
      http.get('*/api/auth/me', () => HttpResponse.json(answer)),
    );
    expect(avatar().tagName).not.toBe('IMG');
    answer = { ...signedInUser, photoUpdatedAt: savedPhotoTimes[2]! };

    refocusWindow();

    await waitFor(() => expect(avatar()).toHaveAttribute('src', photoAddress(savedPhotoTimes[2]!)));
  });
});

// T20: AC15, the box inside the Account panel's states.
describe('the box in the Account panel’s states', () => {
  it('is part of the skeleton while the profile loads', async () => {
    const { container } = await openSettings('/settings/account', profile.pending());

    expect(screen.queryByRole('group', { name: 'Your Profile Picture' })).toBeNull();
    expect(container.querySelectorAll('[aria-hidden="true"] [class*="skeleton"]').length).toBeGreaterThan(4);
  });

  it('comes with the form after the error state’s Retry', async () => {
    const { user } = await openSettings('/settings/account', profile.failsThenAnswers());
    const retry = await screen.findByRole('button', { name: 'Retry' }, { timeout: 10_000 });

    await user.click(retry);

    await formShown();
    const panel = screen.getByRole('tabpanel');
    expect(panel).toContainElement(dataStateRootIn(panel));
    expect(box()).toBeInTheDocument();
  }, 15_000);

  it('keeps the chosen file, its preview and the typing when a refetch answers another photo time', async () => {
    let answer: Profile = demoProfile;
    const { user } = await openSettings(
      '/settings/account',
      http.get('*/api/profile', () => HttpResponse.json(answer)),
    );
    await formShown();
    await retype(user, fullName(), 'Typed Name');
    await choose(user, png());
    await kept();
    const preview = made.at(-1);
    answer = { ...demoProfile, photoUpdatedAt: savedPhotoTimes[2]! };
    const gets = count('GET /api/profile');

    refocusWindow();
    await waitFor(() => expect(count('GET /api/profile')).toBe(gets + 1));
    await settle();

    expect(fullName()).toHaveValue('Typed Name');
    expect(boxImage()).toHaveAttribute('src', preview);
    expect(screen.getByText('Not saved')).toBeInTheDocument();
    expect(revoked).not.toContain(preview);
  });

  it('keeps the data, the form and the choice with no message when a refetch fails', async () => {
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
    await choose(user, png());
    await kept();
    const preview = made.at(-1);
    fail = true;

    refocusWindow();
    await settle();
    await waitFor(() => expect(count('GET /api/profile')).toBeGreaterThan(1));

    expect(boxImage()).toHaveAttribute('src', preview);
    expect(screen.getByText('Not saved')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong.')).toBeNull();
  });
});

const source = (path: string) => readFileSync(resolve(import.meta.dirname, '../../src', path), 'utf8');

// T21: AC19, the photo rule only from the shared photoSchema; the paths from the contract; object URLs in one place.
describe('photo sources', () => {
  const photoFiles = [
    'components/ProfilePhotoUpload/ProfilePhotoUpload.tsx',
    'components/ProfileForm/ProfileForm.tsx',
    'api/profile.ts',
    'api/client.ts',
    'app/AppShell.tsx',
  ];
  /** A size or type check of its own: a byte signature, the 2 MB, a size comparison, a type or extension compared. */
  const ownCheck =
    /0x89|0xff,\s*0xd8|2_?097_?152|1024\s*\*\s*1024|\.size\s*[<>]|\.type\s*[=!]==|image\/(jpeg|png)'\s*[=!]==|\.(name|type)\.(endsWith|startsWith|includes)\(|\.test\(\s*\w+\.name/;

  it.each([
    'file.size > 2097152',
    'bytes[0] === 0x89',
    "file.type === 'image/png'",
    "file.name.endsWith('.png')",
    'file.size <= MAX',
  ])('flags %s', (code) => {
    expect(ownCheck.test(code)).toBe(true);
  });

  it.each(photoFiles)('%s has no size or type check of its own', (path) => {
    expect(source(path)).not.toMatch(ownCheck);
  });

  it('checks a chosen file with the shared photoSchema in the form', () => {
    expect(source('components/ProfileForm/ProfileForm.tsx')).toMatch(/photoSchema\.safeParseAsync\(/);
  });

  it('builds the photo’s address from the contract’s path, once', () => {
    const api = source('api/profile.ts');

    expect(api).toMatch(/profileContract\.photo\.path/);
    for (const path of photoFiles) expect(source(path)).not.toMatch(/['"`]\/api\/profile\/photo/);
  });

  it('makes and revokes object URLs only in ProfilePhotoUpload, in one effect', () => {
    const users = photoFiles.filter((path) => /createObjectURL|revokeObjectURL/.test(source(path)));
    const upload = source('components/ProfilePhotoUpload/ProfilePhotoUpload.tsx');

    expect(users).toEqual(['components/ProfilePhotoUpload/ProfilePhotoUpload.tsx']);
    expect(upload.match(/URL\.createObjectURL\(/g)).toHaveLength(1);
    expect(upload.match(/URL\.revokeObjectURL\(/g)).toHaveLength(1);
    expect(upload).toMatch(
      /useEffect\(\(\) => \{[\s\S]*?URL\.createObjectURL\([\s\S]*?return \(\) => \{?\s*URL\.revokeObjectURL\(/,
    );
  });
});
