import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { APIRequestContext, Locator, Page, Request } from '@playwright/test';

import { FRONTEND_URL } from '../constants';
import { expect, test } from '../fixtures';
import { box, computed, expectRing, signUp, type User } from '../helpers';
import { baselineJpeg, JPEG_COMMENT, padTo, png, polyglot, POLYGLOT_HTML, TRAILING_DATA, withExif } from '../images';

/** The e2e run's uploads folder (`NODE_ENV=test`), emptied with the test database. */
const uploadsDir = fileURLToPath(new URL('../../backend/data/uploads-test/', import.meta.url));
const storedName = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png)$/;

const main = (page: Page) => page.getByRole('main');
const sidebar = (page: Page) => page.getByRole('navigation', { name: 'Main' });
const group = (page: Page) => main(page).getByRole('group', { name: 'Your Profile Picture', exact: true });
const uploadBox = (page: Page) => group(page).getByRole('button', { name: 'Upload your photo', exact: true });
const boxImage = (page: Page) => uploadBox(page).locator('img');
const clear = (page: Page) => group(page).getByRole('button', { name: 'Clear the chosen photo', exact: true });
const saveButton = (page: Page) => main(page).getByRole('button', { name: 'Save changes', exact: true });
const statusText = (page: Page) => main(page).getByRole('status');
const avatar = (page: Page) => sidebar(page).locator('..').getByRole('img', { name: 'Tanzir Rahman', exact: true });
const phoneNumber = (page: Page) => main(page).getByRole('textbox', { name: 'Phone Number', exact: true });

const notImage = 'Photo must be a JPG or PNG file';
const tooLarge = 'Photo must be at most 2 MB';

/** The uploads folder's files. */
const uploads = () => readdirSync(uploadsDir).toSorted();

/** Signs up through the page's API context (so the page is signed in) and opens Settings with the form shown. */
async function openSettings(page: Page): Promise<User> {
  const user = await signUp(page.request);
  await page.goto('/settings/account');
  await expect(uploadBox(page)).toBeVisible();
  return user;
}

/** Saves `photo` as the user's photo through the API, with the profile's current text fields. */
async function savePhotoThroughApi(request: APIRequestContext, user: User, photo: Buffer, name = 'photo.png') {
  const profile = (await (await request.get('/api/profile')).json()) as Record<string, string>;
  return request.patch('/api/profile', {
    headers: { 'X-Expected-User': user.email },
    multipart: {
      fullName: profile.fullName!,
      username: profile.username!,
      phoneCountryCode: profile.phoneCountryCode!,
      phoneNumber: profile.phoneNumber!,
      photo: { name, mimeType: 'image/png', buffer: photo },
    },
  });
}

/** The browser's file picker, opened by `open`, given `file`. */
async function chooseFile(
  page: Page,
  open: () => Promise<void>,
  file: { name: string; mimeType: string; buffer: Buffer },
) {
  const chooser = page.waitForEvent('filechooser');
  await open();
  await (await chooser).setFiles(file);
}

/** An image's natural size once it has loaded, or 0 x 0 if it cannot be drawn. */
const naturalSize = (image: Locator) =>
  image.evaluate(async (node: HTMLImageElement) => {
    try {
      await node.decode();
    } catch {
      return [0, 0];
    }
    return [node.naturalWidth, node.naturalHeight];
  });

/** The API requests the page sends from now on. */
function apiRequests(page: Page): Request[] {
  const sent: Request[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/')) sent.push(request);
  });
  return sent;
}

const describe = (request: Request) => `${request.method()} ${new URL(request.url()).pathname}`;

type SentPart = [string, string | { filename: string; type: string; bytes: number[] }];

/**
 * Records every `FormData` the page gives the browser's own `fetch`, part by part (a file's name, type and bytes), from
 * the next page load: Playwright does not expose a request body that holds a file.
 */
async function recordForms(page: Page) {
  await page.addInitScript(() => {
    const sent: unknown[] = [];
    Object.assign(window, { sentForms: sent });
    const original = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      if (init?.body instanceof FormData) {
        const parts: unknown[] = [];
        for (const [name, value] of init.body) {
          parts.push(
            typeof value === 'string'
              ? [name, value]
              : [
                  name,
                  { filename: value.name, type: value.type, bytes: [...new Uint8Array(await value.arrayBuffer())] },
                ],
          );
        }
        sent.push(parts);
      }
      return original(input, init);
    };
  });
  return () => page.evaluate(() => (window as unknown as { sentForms: SentPart[][] }).sentForms);
}

// T24: AC1, AC2, AC4, AC7, AC10, AC13, the photo through the real stack: chosen, previewed, cleared, saved and served.
test('a second user chooses, clears and saves a photo; the box and the sidebar show it, and only to them', async ({
  page,
  request,
}) => {
  // The first user, with a photo of their own: never shown to the second.
  const first = await signUp(request);
  const firstPhoto = baselineJpeg();
  expect((await savePhotoThroughApi(request, first, firstPhoto, 'first.jpg')).status()).toBe(200);
  const sentForms = await recordForms(page);
  await openSettings(page);
  const sent = apiRequests(page);
  await expect(boxImage(page)).toHaveCount(0);
  await expect(avatar(page)).toHaveText('TR');

  // By keyboard: Tab from Phone Number to the box, its ring, Enter opens the picker.
  await phoneNumber(page).focus();
  await page.keyboard.press('Tab');
  await expect(uploadBox(page)).toBeFocused();
  await expectRing(page, uploadBox(page));
  expect(await computed(uploadBox(page), 'cursor')).toBe('pointer');
  const upload = png(48, 36);
  await chooseFile(page, () => page.keyboard.press('Enter'), {
    name: 'my photo.png',
    mimeType: 'image/png',
    buffer: upload,
  });

  // The preview: a local blob: URL, drawn, nothing sent.
  await expect(group(page).getByText('Not saved', { exact: true })).toBeVisible();
  await expect(boxImage(page)).toHaveAttribute('src', /^blob:/);
  expect(await naturalSize(boxImage(page))).toEqual([48, 36]);
  await expect(uploadBox(page)).toBeFocused();
  await expect(saveButton(page)).not.toHaveAttribute('aria-disabled');
  expect(sent.map(describe)).toEqual([]);

  // Clear: the empty box again, focus on it, the button unavailable.
  await clear(page).click();
  await expect(boxImage(page)).toHaveCount(0);
  await expect(uploadBox(page)).toBeFocused();
  await expect(saveButton(page)).toHaveAttribute('aria-disabled', 'true');

  // Chosen again by the mouse, then saved.
  await chooseFile(page, () => uploadBox(page).click(), {
    name: 'my photo.png',
    mimeType: 'image/png',
    buffer: upload,
  });
  await expect(boxImage(page)).toHaveAttribute('src', /^blob:/);
  const preview = (await boxImage(page).getAttribute('src'))!;
  const before = uploads();
  await saveButton(page).click();

  await expect(statusText(page)).toHaveText('Profile updated');
  const patches = sent.filter((one) => describe(one) === 'PATCH /api/profile');
  expect(patches).toHaveLength(1);
  expect(patches[0]!.headers()['content-type']).toMatch(/^multipart\/form-data; boundary=/);
  const [parts] = await sentForms();
  expect(parts!.map(([name]) => name)).toEqual(['fullName', 'username', 'phoneCountryCode', 'phoneNumber', 'photo']);
  // The fixed file name: the user's own ("my photo.png") stays in the browser.
  expect(parts![4]![1]).toEqual({ filename: 'photo', type: 'image/png', bytes: [...upload] });
  await expect(group(page).getByText('Not saved', { exact: true })).toHaveCount(0);
  await expect(saveButton(page)).toBeFocused();
  // The preview's URL is revoked: it no longer reads.
  expect(
    await page.evaluate(
      (url) =>
        fetch(url).then(
          () => 'read',
          () => 'revoked',
        ),
      preview,
    ),
  ).toBe('revoked');

  // The box and the sidebar show the stored photo from its address with ?v=.
  await expect(boxImage(page)).toHaveAttribute('src', /^\/api\/profile\/photo\?v=/);
  expect(await naturalSize(boxImage(page))).toEqual([48, 36]);
  await expect(avatar(page)).toHaveAttribute('src', /^\/api\/profile\/photo\?v=/);
  expect(await naturalSize(avatar(page))).toEqual([48, 36]);
  expect(sent.map(describe).filter((line) => line !== 'GET /api/profile/photo')).toEqual(['PATCH /api/profile']);

  // Stored as uploaded, under a UUID name, in the e2e folder.
  const added = uploads().filter((name) => !before.includes(name));
  expect(added).toHaveLength(1);
  expect(added[0]).toMatch(storedName);
  expect(readFileSync(join(uploadsDir, added[0]!)).equals(upload)).toBe(true);

  // Overview and a reload show it too.
  await sidebar(page).getByRole('link', { name: 'Overview' }).click();
  await expect(page).toHaveURL(/\/overview$/);
  expect(await naturalSize(avatar(page))).toEqual([48, 36]);
  await page.reload();
  await expect(avatar(page)).toHaveAttribute('src', /^\/api\/profile\/photo\?v=/);
  expect(await naturalSize(avatar(page))).toEqual([48, 36]);

  // The route answers each user their own bytes, with the serving headers.
  const mine = await page.request.get('/api/profile/photo');
  expect(mine.status()).toBe(200);
  expect((await mine.body()).equals(upload)).toBe(true);
  expect(mine.headers()).toMatchObject({
    'content-type': 'image/png',
    'content-length': String(upload.length),
    'x-content-type-options': 'nosniff',
    'cache-control': 'no-store',
    'content-security-policy': "default-src 'none'; sandbox",
    'cross-origin-resource-policy': 'same-origin',
  });
  expect((await (await request.get('/api/profile/photo')).body()).equals(firstPhoto)).toBe(true);
});

/** Whether `target`'s page can load the photo as an image: "loaded", or "blocked". */
const loads = (target: Page) =>
  target.evaluate(
    (src) =>
      new Promise<string>((done) => {
        const image = new Image();
        image.addEventListener('load', () => done('loaded'));
        image.addEventListener('error', () => done('blocked'));
        image.src = src;
      }),
    'http://localhost:5173/api/profile/photo?v=probe',
  );

/** A file part named x.png and declared image/png, with `buffer` as its bytes. */
const photoPart = (buffer: Buffer) => ({ name: 'x.png', mimeType: 'image/png', buffer });

// T25: AC3, AC12, a phone's JPEG kept as uploaded and drawn upright; the polyglot harmless; refusals at once.
test('keeps a phone JPEG as uploaded and upright, serves a polyglot harmlessly, and refuses bad files at once', async ({
  page,
  context,
}) => {
  const user = await openSettings(page);

  // A JPEG with GPS EXIF, orientation 6, a comment and trailing data, named .png.
  const holiday = withExif();
  await chooseFile(page, () => uploadBox(page).click(), {
    name: 'holiday.png',
    mimeType: 'image/png',
    buffer: holiday,
  });
  await expect(group(page).getByText('Not saved', { exact: true })).toBeVisible();
  await saveButton(page).click();
  await expect(statusText(page)).toHaveText('Profile updated');
  const served = await page.request.get('/api/profile/photo');
  expect(served.headers()['content-type']).toBe('image/jpeg');
  const servedBytes = await served.body();
  expect(servedBytes.equals(holiday)).toBe(true);
  expect(servedBytes.includes(Buffer.from(JPEG_COMMENT, 'latin1'))).toBe(true);
  expect(servedBytes.subarray(-TRAILING_DATA.length).equals(TRAILING_DATA)).toBe(true);
  // Encoded 120 x 80; orientation 6 draws it upright, 80 x 120.
  await expect(boxImage(page)).toHaveAttribute('src', /^\/api\/profile\/photo\?v=/);
  expect(await naturalSize(boxImage(page))).toEqual([80, 120]);

  // The polyglot: saved as uploaded, shown as an image, and opened directly nothing in it runs.
  const page2 = polyglot();
  expect((await savePhotoThroughApi(page.request, user, page2, 'page.html')).status()).toBe(200);
  await page.reload();
  expect(await naturalSize(boxImage(page))).toEqual([40, 30]);
  const direct = await context.newPage();
  const events: string[] = [];
  direct.on('dialog', (dialog) => {
    events.push(`dialog ${dialog.message()}`);
    void dialog.dismiss();
  });
  direct.on('console', (message) => events.push(`console ${message.text()}`));
  const response = await direct.goto('/api/profile/photo');
  expect(response!.headers()['content-type']).toBe('image/png');
  expect((await response!.body()).includes(Buffer.from(POLYGLOT_HTML, 'latin1'))).toBe(true);
  await direct.waitForTimeout(500);
  // Chromium reports its own blocks (the sandbox's scripts, CSP's inline styles); the polyglot's script never runs.
  expect(events.filter((event) => event.startsWith('dialog') || event.includes('polyglot ran'))).toEqual([]);
  expect(events.some((event) => event.includes('sandboxed'))).toBe(true);
  expect(new URL(direct.url()).pathname).toBe('/api/profile/photo');
  expect(await direct.evaluate(() => document.contentType)).toBe('image/png');
  expect(await direct.title()).not.toBe('ran');
  await direct.close();

  // Another site's page cannot load it (Cross-Origin-Resource-Policy); this site's can.
  expect(await loads(page)).toBe('loaded');
  const otherSite = await context.newPage();
  // Same site (localhost), so the session cookie goes with it; another origin (port 3000), so CORP refuses it.
  await otherSite.goto('http://localhost:3000/api/does-not-exist');
  expect(await loads(otherSite)).toBe('blocked');
  await otherSite.close();

  // Refused at once: a text file named photo.png, and a file one byte over 2 MB. No preview, nothing sent.
  const sent = apiRequests(page);
  for (const [file, message] of [
    [{ name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from('This is not an image.') }, notImage],
    [{ name: 'big.png', mimeType: 'image/png', buffer: padTo(png(), 2_097_153) }, tooLarge],
  ] as const) {
    await chooseFile(page, () => uploadBox(page).click(), file);
    await expect(uploadBox(page)).toHaveAccessibleDescription(message);
    await expect(uploadBox(page)).toHaveAttribute('aria-invalid', 'true');
    await expect(group(page).getByText('Not saved', { exact: true })).toHaveCount(0);
    expect(await computed(uploadBox(page), 'border-top-color')).toBe('rgb(231, 61, 28)');
    await expect(saveButton(page)).toHaveAttribute('aria-disabled', 'true');
    await saveButton(page).click({ force: true });
  }
  await page.waitForTimeout(300);
  expect(sent.map(describe).filter((line) => line !== 'GET /api/profile/photo')).toEqual([]);
});

// T26: AC8, AC10, AC14, the photo route and the photo write through the real stack, each user with their own session.
test('refuses photo saves that are cross-site, unguarded, another user’s, misnamed or too large; each user reads their own', async ({
  page,
  request,
}) => {
  const a = await signUp(page.request);
  const b = await signUp(request);
  const aPhoto = png(20, 10);
  const bPhoto = baselineJpeg();
  expect((await savePhotoThroughApi(page.request, a, aPhoto)).status()).toBe(200);
  expect((await savePhotoThroughApi(request, b, bPhoto)).status()).toBe(200);
  const profile = (await (await page.request.get('/api/profile')).json()) as Record<string, string>;
  const text = {
    fullName: profile.fullName!,
    username: profile.username!,
    phoneCountryCode: profile.phoneCountryCode!,
    phoneNumber: profile.phoneNumber!,
  };
  const other = png(30, 30);
  const send = (headers: Record<string, string>, multipart: Record<string, unknown>) =>
    page.request.patch('/api/profile', { headers, multipart: multipart as never });
  const own = { 'X-Expected-User': a.email };

  const answers = [
    (await send({ ...own, 'Sec-Fetch-Site': 'cross-site' }, { ...text, photo: photoPart(other) })).status(),
    (await send({}, { ...text, photo: photoPart(other) })).status(),
    (await send({ 'X-Expected-User': b.email }, { ...text, photo: photoPart(other) })).status(),
    (await send(own, { ...text, fullName: photoPart(other) })).status(),
  ];
  const large = await send(own, { ...text, photo: photoPart(padTo(png(), 3 * 1024 * 1024)) });

  expect(answers).toEqual([403, 400, 409, 400]);
  expect([large.status(), await large.json()]).toEqual([
    400,
    { message: 'Validation failed', fieldErrors: { photo: tooLarge } },
  ]);
  expect((await (await page.request.get('/api/profile/photo')).body()).equals(aPhoto)).toBe(true);
  expect((await (await request.get('/api/profile/photo')).body()).equals(bPhoto)).toBe(true);
  expect((await request.get('/api/profile/photo?v=anything')).headers()['content-type']).toBe('image/jpeg');
});

// Task 031, #131: a photo save a guard refuses before reading it, on the browser's path: the dev server's `/api` proxy,
// which sends `Connection: close` to the backend. A photo just under the 2 MB limit gets the real answer every time,
// never the proxy's 502 or a reset, so a stale tab still switches to the signed-in user and an ended session still
// opens Login.
test.describe('a near-2 MB photo save refused by a guard, through the dev server', () => {
  const RUNS = 100;
  const nearLimit = padTo(png(), 2_000_000);
  const text = { fullName: 'Tanzir Rahman', username: 'tanzir', phoneCountryCode: '+1', phoneNumber: '' };

  /** Each answer as `<status> <body>`, or the request's error, so a failure shows them all. */
  async function answers(request: APIRequestContext, headers: Record<string, string>) {
    const seen: string[] = [];
    for (let run = 0; run < RUNS; run += 1) {
      try {
        const response = await request.patch('/api/profile', {
          headers,
          multipart: { ...text, photo: photoPart(nearLimit) },
        });
        seen.push(`${response.status()} ${await response.text()}`);
      } catch (error) {
        seen.push(`error ${(error as Error).message.split('\n')[0]}`);
      }
    }
    return seen;
  }

  test('answers another user’s email with the 409 every time', async ({ page, request }) => {
    await signUp(page.request);
    const other = await signUp(request);

    const seen = await answers(page.request, { 'X-Expected-User': other.email });

    expect(
      seen.filter((answer) => answer !== `409 {"message":"Another user is signed in. Nothing was saved."}`),
    ).toEqual([]);
    expect(seen).toHaveLength(RUNS);
  });

  test('answers a save without a session with the 401 every time', async ({ playwright, request }) => {
    const user = await signUp(request);
    const signedOut = await playwright.request.newContext({ baseURL: FRONTEND_URL });

    const seen = await answers(signedOut, { 'X-Expected-User': user.email });
    await signedOut.dispose();

    expect(seen.filter((answer) => answer !== `401 {"message":"Authentication required"}`)).toEqual([]);
    expect(seen).toHaveLength(RUNS);
  });
});

const near = (actual: number, expected: number, what: string, tolerance = 1) =>
  expect(Math.abs(actual - expected), `${what}: ${actual} vs ${expected}`).toBeLessThanOrEqual(tolerance);
type Box = { x: number; y: number; width: number; height: number };
const insideX = (inner: Box, outer: Box) =>
  inner.x >= outer.x - 0.5 && inner.x + inner.width <= outer.x + outer.width + 0.5;

/** The box in task 028's place: 144 x 132, 32 under its label and centred under it; its image covering it. */
async function expectBoxInPlace(page: Page) {
  const label = await box(group(page).getByText('Your Profile Picture', { exact: true }));
  const upload = await box(uploadBox(page));
  near(upload.width, 144, 'box width');
  near(upload.height, 132, 'box height');
  near(upload.y, label.y + 24 + 32, 'box 32 under its label');
  near(upload.x + upload.width / 2, label.x + label.width / 2, 'box centred under its label');
  if ((await boxImage(page).count()) > 0) {
    const image = await box(boxImage(page));
    near(image.x, upload.x + 1, 'image inside the left border');
    near(image.y, upload.y + 1, 'image inside the top border');
    near(image.width, 142, 'image width');
    near(image.height, 130, 'image height');
  }
  return { label, upload };
}

/** The picture column: from the label's column start to the card's content end. */
async function pictureColumn(page: Page): Promise<Box> {
  const column = await box(group(page).locator('..'));
  return column;
}

const scrollWidth = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth);
const pageRight = (page: Page) => page.evaluate(() => document.body.getBoundingClientRect().right);

// T28: AC17, the box at 1280, 1440 and 1920 with a stored photo, a preview and a refused choice's message.
test('keeps the box in its place at 1280, 1440 and 1920 with a photo, a preview and a message, all inside the column', async ({
  page,
}) => {
  const user = await openSettings(page);
  expect((await savePhotoThroughApi(page.request, user, png(60, 40))).status()).toBe(200);
  await page.reload();
  await expect(boxImage(page)).toHaveAttribute('src', /^\/api\/profile\/photo/);

  for (const [width, height] of [
    [1280, 1024],
    [1440, 1024],
    [1920, 1080],
  ] as const) {
    await page.setViewportSize({ width, height });
    // The stored photo.
    await expectBoxInPlace(page);
    // A preview, "Not saved" and "Clear" under the box, inside the column.
    await chooseFile(page, () => uploadBox(page).click(), {
      name: 'p.png',
      mimeType: 'image/png',
      buffer: png(30, 50),
    });
    await expect(clear(page)).toBeVisible();
    const { upload } = await expectBoxInPlace(page);
    const column = await pictureColumn(page);
    const note = await box(group(page).getByText('Not saved', { exact: true }).locator('..'));
    expect(note.y, 'the line under the box').toBeGreaterThanOrEqual(upload.y + upload.height);
    expect(insideX(note, column), 'the line inside the column').toBe(true);
    // A refused choice's message, wrapping inside the column, the preview kept.
    await chooseFile(page, () => uploadBox(page).click(), {
      name: 'x.png',
      mimeType: 'image/png',
      buffer: Buffer.from('no image'),
    });
    await expect(group(page).getByText(notImage)).toBeVisible();
    await expectBoxInPlace(page);
    const message = await box(group(page).getByText(notImage));
    expect(message.y, 'the message under the line').toBeGreaterThanOrEqual(note.y + note.height);
    expect(insideX(message, column), 'the message inside the column').toBe(true);
    expect(await scrollWidth(page), 'no horizontal scroll').toBeLessThanOrEqual(Math.round(await pageRight(page)));
    await clear(page).click();
    await expect(clear(page)).toHaveCount(0);
  }
});

/** `backend/data/` as the dev server's `/@fs/` route names it: the absolute path, forward slashes. */
const dataDir = fileURLToPath(new URL('../../backend/data/', import.meta.url)).replaceAll(String.fromCharCode(92), '/');

/**
 * A response holds none of `file`'s bytes: not its start, nor the start of its base64 (an inlined data URL). The base64
 * start is the first 24 characters, which the first 18 bytes make exactly (3 bytes per 4 characters): encoding the whole
 * file instead failed once the e2e database grew past 402,653,184 bytes, V8's longest string as base64 (task 031).
 */
const holdsNoneOf = (body: Buffer, file: Buffer) =>
  !body.includes(file.subarray(0, 16)) && !body.toString('latin1').includes(file.subarray(0, 18).toString('base64'));

// Task 029 security review: the Vite dev server's `/@fs/` route serves files under the workspace; `backend/data/` (the
// SQLite files and the photos) must never be among them: every way of reading a file answers 403 or 404 and none of
// its bytes. Vite answers an image's `?import` with a module holding only the image's own URL (which then answers 403):
// none of its bytes either.
test('never serves backend/data through the dev server: neither the database file nor a stored photo', async ({
  page,
}) => {
  const user = await signUp(page.request);
  const photo = png(24, 18);
  const before = uploads();
  expect((await savePhotoThroughApi(page.request, user, photo)).status()).toBe(200);
  const [stored] = uploads().filter((name) => !before.includes(name));
  const databasePath = `${dataDir}finebank.test.sqlite`;
  const photoPath = `${dataDir}uploads-test/${stored}`;
  const targets: [string, Buffer][] = [
    [databasePath, readFileSync(databasePath)],
    [photoPath, photo],
  ];

  for (const [path, file] of targets) {
    for (const url of [
      `/@fs/${path}`,
      `/@fs/${path}?raw`,
      `/@fs/${path}?url`,
      `/@fs/${path}?inline`,
      `/@fs/${path.toLowerCase()}`,
      `/@fs/${encodeURI(path)}`,
      ...(path === databasePath ? [`/@fs/${path}?import`] : []),
    ]) {
      const response = await page.request.get(url);

      expect([403, 404], `${url}: ${response.status()}`).toContain(response.status());
      expect(holdsNoneOf(await response.body(), file), `${url}: none of the file's bytes`).toBe(true);
    }
  }
  const imported = await page.request.get(`/@fs/${photoPath}?import`);
  const module = await imported.text();
  expect(holdsNoneOf(await imported.body(), photo), 'the photo’s ?import: none of its bytes').toBe(true);
  expect(module.split('\n')[0]).toBe(`export default "/@fs/${photoPath}"`);
  expect([403, 404]).toContain((await page.request.get(`/@fs/${photoPath}`)).status());
});
