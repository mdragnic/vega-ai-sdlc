import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { INestApplication } from '@nestjs/common';
import { type PhotoMimeType, profileContract, writeGuardMessages } from '@finebank/shared';
import request, { type Response, type Test } from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { FixedClock } from '../src/common/clock/fixed-clock.js';
import { PhotoStore } from '../src/users/photo-store.js';
import { ProfileBodyInterceptor } from '../src/users/profile-body.interceptor.js';
import { User } from '../src/users/user.entity.js';
import { UsersService } from '../src/users/users.service.js';
import { cookieFor, login, me, signUp } from './helpers/auth.js';
import { CapturingLogger } from './helpers/capturing-logger.js';
import {
  baselineJpeg,
  JPEG_COMMENT,
  notImages,
  padTo,
  png,
  polyglot,
  POLYGLOT_HTML,
  progressiveJpeg,
  TRAILING_DATA,
  withExif,
} from './helpers/images.js';
import { createTestApp, uploadsFolderOf } from './helpers/test-app.js';

// The paths come from the contract, so a route declared anywhere else would not answer them.
const profilePath = `/api${profileContract.update.path}`;
const photoPath = `/api${profileContract.photo.path}`;

const FIXED_NOW = '2026-10-22T10:00:00.000Z';
const LATER = '2026-10-22T11:15:30.250Z';

/** A stored name: a lowercase UUID v4 and the detected type's extension (#76). */
const storedName = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png)$/;

const notImage = 'Photo must be a JPG or PNG file';
const tooLarge = 'Photo must be at most 2 MB';

/** The bound SQL of a statement: each `?` replaced by its parameter, so a test reads the values in the text. */
function bind(sql: string, parameters: unknown): string {
  const values: unknown[] = Array.isArray(parameters) ? parameters : [];
  let index = 0;
  return sql.replace(/\?/g, () => JSON.stringify(values[index++]));
}

/** The WHERE clause of a statement. */
const whereOf = (sql: string) => /\bWHERE\b(.*?)(\bORDER BY\b|\bLIMIT\b|\bRETURNING\b|$)/is.exec(sql)?.[1] ?? '';

/** A response body as raw bytes, whatever its type. */
function binary(response: Response, callback: (error: Error | null, body: Buffer) => void) {
  // superagent hands the parser Node's incoming message, a stream.
  const stream = response as unknown as NodeJS.ReadableStream;
  const chunks: Buffer[] = [];
  stream.on('data', (part: Buffer) => chunks.push(part));
  stream.on('end', () => callback(null, Buffer.concat(chunks)));
}

const validParts = {
  fullName: 'Ana Marija Petrović',
  username: 'ana.petrovic',
  phoneCountryCode: '+381',
  phoneNumber: '641234567',
};

interface UserRow {
  id: number;
  email: string;
  full_name: string;
  username: string;
  phone_country_code: string;
  phone_number: string;
  photo_path: string | null;
  photo_mime_type: string | null;
  photo_updated_at: string | null;
}

/** One app with its own uploads folder, two users: the other signed up first and given a photo, then the requester. */
function photoApp(options: { store?: (folder: string) => PhotoStore; logger?: CapturingLogger; folder?: string } = {}) {
  const ctx = {} as {
    app: INestApplication;
    db: DataSource;
    folder: string;
    token: string;
    email: string;
    userId: number;
    username: string;
    otherToken: string;
    otherEmail: string;
    otherId: number;
    otherPhoto: Buffer;
  };

  beforeAll(async () => {
    const folder = options.folder ?? mkdtempSync(join(tmpdir(), 'finebank-photo-'));
    ctx.folder = folder;
    ctx.app = await createTestApp({
      config: { nodeEnv: 'test', testNow: FIXED_NOW, uploadsDir: folder },
      overrides: options.store ? [{ provide: PhotoStore, useValue: options.store(folder) }] : [],
      logger: options.logger,
    });
    ctx.db = ctx.app.get(DataSource);
    const other = await signUp(ctx.app, { fullName: 'Other Person' });
    ctx.otherToken = other.token;
    ctx.otherEmail = other.user.email;
    const requester = await signUp(ctx.app);
    ctx.token = requester.token;
    ctx.email = requester.user.email;
    ctx.username = requester.user.username;
    const rows: UserRow[] = await ctx.db.query('SELECT * FROM users ORDER BY id');
    ctx.otherId = rows.at(-2)!.id;
    ctx.userId = rows.at(-1)!.id;
    ctx.otherPhoto = progressiveJpeg();
  });

  beforeEach(async () => {
    ctx.app.get(FixedClock).set(new Date(FIXED_NOW));
    // Each test starts from no photo for the requester and the other user's own photo, saved through the API.
    for (const name of readdirSync(ctx.folder)) rmSync(join(ctx.folder, name), { recursive: true, force: true });
    await ctx.db.query(
      `UPDATE users SET full_name = 'Tanzir Rahman', username = ?, phone_country_code = '+1', phone_number = '',
       photo_path = NULL, photo_mime_type = NULL, photo_updated_at = NULL WHERE id = ?`,
      [ctx.username, ctx.userId],
    );
    await ctx.db.query(
      `UPDATE users SET photo_path = NULL, photo_mime_type = NULL, photo_updated_at = NULL WHERE id = ?`,
      [ctx.otherId],
    );
    const saved = await request(ctx.app.getHttpServer())
      .patch(profilePath)
      .set('Cookie', cookieFor(ctx.otherToken))
      .set('X-Expected-User', ctx.otherEmail)
      .field('fullName', 'Other Person')
      .field('username', 'other.person')
      .field('phoneCountryCode', '+44')
      .field('phoneNumber', '2071234567')
      .attach('photo', ctx.otherPhoto, { filename: 'other.jpg', contentType: 'image/jpeg' });
    expect(saved.status).toBe(200);
  });

  afterAll(async () => {
    await ctx.app.close();
    rmSync(ctx.folder, { recursive: true, force: true });
  });

  const server = () => request(ctx.app.getHttpServer());
  const users = (): Promise<UserRow[]> => ctx.db.query('SELECT * FROM users ORDER BY id');
  const rowOf = async (id: number) => (await users()).find((row) => row.id === id)!;
  const files = () => readdirSync(ctx.folder).toSorted();
  const fileOf = (name: string) => readFileSync(join(ctx.folder, name));

  /** `PATCH /api/profile` with the requester's session and email, `parts` as text parts and an optional photo. */
  function patch(
    photo?: { bytes: Buffer; filename?: string; contentType?: string },
    parts: Record<string, string> = validParts,
    session: { token: string; email: string } = { token: ctx.token, email: ctx.email },
  ): Test {
    let req = server().patch(profilePath).set('Cookie', cookieFor(session.token)).set('X-Expected-User', session.email);
    for (const [name, value] of Object.entries(parts)) req = req.field(name, value);
    if (photo) {
      req = req.attach('photo', photo.bytes, {
        filename: photo.filename ?? 'me.png',
        contentType: photo.contentType ?? 'image/png',
      });
    }
    return req;
  }

  /** `GET /api/profile/photo` with a session, its body as raw bytes. */
  const getPhoto = (token: string | null = ctx.token, query = '') => {
    const req = server().get(`${photoPath}${query}`).buffer(true).parse(binary);
    return token === null ? req : req.set('Cookie', cookieFor(token));
  };

  /** The SQL the data source runs while `run` runs, each statement bound with its parameters. */
  async function recordSql(run: () => Promise<unknown>) {
    const statements: string[] = [];
    const logQuery = vi.spyOn(ctx.db.logger, 'logQuery').mockImplementation((sql, parameters) => {
      statements.push(bind(sql, parameters));
    });
    try {
      await run();
    } finally {
      logQuery.mockRestore();
    }
    return statements;
  }

  return { ctx, server, users, rowOf, files, fileOf, patch, getPhoto, recordSql };
}

/** A spy on the multipart stage: a request refused before it is never read. */
const interceptor = () => vi.spyOn(ProfileBodyInterceptor.prototype, 'intercept');

describe('a photo saved with the profile', () => {
  const { ctx, users, rowOf, files, fileOf, patch, getPhoto, recordSql, server } = photoApp();

  const expectNothingChanged = async (before: UserRow[], filesBefore: string[]) => {
    expect(await users()).toEqual(before);
    expect(files()).toEqual(filesBefore);
  };

  // T4: AC7, the write: 200 with the profile and the time; the row's three columns; the file as uploaded.
  it('answers 200 with the five fields and photoUpdatedAt, and stores the file and the row’s three columns', async () => {
    const before = await users();
    const otherFiles = files();
    const upload = png();

    const response = await patch({ bytes: upload });

    expect(response.status).toBe(200);
    expect(JSON.parse(response.text)).toEqual({ ...validParts, email: ctx.email, photoUpdatedAt: FIXED_NOW });
    const row = await rowOf(ctx.userId);
    expect(row.photo_path).toMatch(storedName);
    expect(row.photo_path).toMatch(/\.png$/);
    expect(row.photo_mime_type).toBe('image/png');
    expect(row.photo_updated_at).toBe('2026-10-22 10:00:00.000');
    expect({ ...row, photo_path: null, photo_mime_type: null, photo_updated_at: null }).toEqual({
      ...before.find(({ id }) => id === ctx.userId)!,
      full_name: validParts.fullName,
      username: validParts.username,
      phone_country_code: '+381',
      phone_number: '641234567',
    });
    expect(files()).toEqual([...otherFiles, row.photo_path!].toSorted());
    expect(fileOf(row.photo_path!).equals(upload)).toBe(true);
    // The other user's row and file are untouched.
    expect((await users()).filter(({ id }) => id !== ctx.userId)).toEqual(before.filter(({ id }) => id !== ctx.userId));
    const otherRow = await rowOf(ctx.otherId);
    expect(fileOf(otherRow.photo_path!).equals(ctx.otherPhoto)).toBe(true);
  });

  // T5: AC5, AC7, AC13: a second photo replaces the first; a save without one keeps it; the reads answer the time.
  it('replaces the first file with a second photo, and keeps it on a save without one', async () => {
    expect((await patch({ bytes: png() })).status).toBe(200);
    const first = (await rowOf(ctx.userId)).photo_path!;
    ctx.app.get(FixedClock).set(new Date(LATER));
    const jpeg = baselineJpeg();

    const second = await patch({ bytes: jpeg, filename: 'second.png', contentType: 'image/png' });

    expect(second.status).toBe(200);
    expect(second.body.photoUpdatedAt).toBe(LATER);
    const row = await rowOf(ctx.userId);
    expect(row.photo_path).toMatch(storedName);
    expect(row.photo_path).toMatch(/\.jpg$/);
    expect(row.photo_mime_type).toBe('image/jpeg');
    expect(row.photo_path).not.toBe(first);
    expect(existsSync(join(ctx.folder, first))).toBe(false);
    expect(fileOf(row.photo_path!).equals(jpeg)).toBe(true);

    const filesBefore = files();
    const statements = await recordSql(async () => {
      const textOnly = await patch(undefined, { ...validParts, fullName: 'Text Only' });
      expect(textOnly.status).toBe(200);
      expect(textOnly.body.photoUpdatedAt).toBe(LATER);
    });

    expect(await rowOf(ctx.userId)).toEqual({ ...row, full_name: 'Text Only' });
    expect(files()).toEqual(filesBefore);
    // Task 028's one UPDATE: the four columns, keyed on the user's ID only.
    const updates = statements.filter((sql) => /^UPDATE\b.*\busers\b/is.test(sql));
    expect(updates).toHaveLength(1);
    expect(whereOf(updates[0]!).trim()).toMatch(new RegExp(`^"id"\\s*=\\s*${ctx.userId}$`));
    expect(updates[0]).not.toMatch(/photo/);

    const profile = await server().get(`/api${profileContract.get.path}`).set('Cookie', cookieFor(ctx.token));
    const session = await me(ctx.app, ctx.token);
    expect(JSON.parse(profile.text)).toEqual({
      fullName: 'Text Only',
      email: ctx.email,
      username: validParts.username,
      phoneCountryCode: '+381',
      phoneNumber: '641234567',
      photoUpdatedAt: LATER,
    });
    expect(JSON.parse(session.text)).toEqual({
      fullName: 'Text Only',
      email: ctx.email,
      username: validParts.username,
      photoUpdatedAt: LATER,
    });
  });

  it('answers photoUpdatedAt on login too', async () => {
    expect((await patch({ bytes: png() })).status).toBe(200);

    const response = await login(ctx.app, { email: ctx.email, password: 'abcdef12' });

    expect(JSON.parse(response.text)).toEqual({
      fullName: validParts.fullName,
      email: ctx.email,
      username: validParts.username,
      photoUpdatedAt: FIXED_NOW,
    });
  });

  it('gives a user without a photo no photoUpdatedAt in sign up, login, me or the profile', async () => {
    const signedUp = await server().post('/api/auth/signup').send({
      fullName: 'Plain User',
      email: 'plain.user@example.com',
      password: 'abcdef12',
    });
    const token = /finebank_session=([^;]+)/.exec(String(signedUp.headers['set-cookie']))![1]!;
    const loggedIn = await login(ctx.app, { email: 'plain.user@example.com', password: 'abcdef12' });
    const session = await me(ctx.app, token);
    const profile = await server().get(`/api${profileContract.get.path}`).set('Cookie', cookieFor(token));

    for (const response of [signedUp, loggedIn, session, profile]) {
      expect(response.status).toBeLessThan(300);
      expect(response.text).not.toContain('photoUpdatedAt');
    }
    expect(Object.keys(JSON.parse(profile.text) as object).toSorted()).toEqual([
      'email',
      'fullName',
      'phoneCountryCode',
      'phoneNumber',
      'username',
    ]);
  });

  // T3: AC7, AC12 (#128 b3): stored and served exactly as uploaded, metadata, comment and trailing data included.
  it.each<[string, () => Buffer, string]>([
    ['a JPEG with EXIF (GPS, camera, time, orientation 6), a comment and data after its end', withExif, 'image/jpeg'],
    ['the polyglot (a PNG, then an HTML page with a script)', polyglot, 'image/png'],
    ['a progressive JPEG', progressiveJpeg, 'image/jpeg'],
  ])('stores and serves %s byte-identical to the upload', async (_case, make, mimeType) => {
    const upload = make();

    expect((await patch({ bytes: upload, filename: 'holiday.png', contentType: 'image/png' })).status).toBe(200);
    const row = await rowOf(ctx.userId);
    const served = await getPhoto();

    expect(row.photo_mime_type).toBe(mimeType);
    expect(fileOf(row.photo_path!).equals(upload)).toBe(true);
    expect(served.status).toBe(200);
    expect((served.body as Buffer).equals(upload)).toBe(true);
    expect(served.headers['content-type']).toBe(mimeType);
    expect(served.headers['x-content-type-options']).toBe('nosniff');
    expect(served.headers['content-security-policy']).toBe("default-src 'none'; sandbox");
    expect(served.headers['cross-origin-resource-policy']).toBe('same-origin');
  });

  it('keeps the EXIF, the comment and the trailing data in the stored file', async () => {
    const upload = withExif();

    await patch({ bytes: upload, filename: 'holiday.jpg', contentType: 'image/jpeg' });
    const stored = fileOf((await rowOf(ctx.userId)).photo_path!);

    expect(stored.includes(Buffer.from('Exif\u0000\u0000', 'latin1'))).toBe(true);
    expect(stored.includes(Buffer.from('FineCam', 'latin1'))).toBe(true);
    expect(stored.includes(Buffer.from(JPEG_COMMENT, 'latin1'))).toBe(true);
    expect(stored.subarray(-TRAILING_DATA.length).equals(TRAILING_DATA)).toBe(true);
  });

  it('serves the polyglot as image/png, its page inside never as HTML', async () => {
    await patch({ bytes: polyglot(), filename: 'page.html', contentType: 'text/html' });

    const served = await getPhoto();

    expect(served.headers['content-type']).toBe('image/png');
    expect((served.body as Buffer).includes(Buffer.from(POLYGLOT_HTML, 'latin1'))).toBe(true);
    expect(served.headers['x-content-type-options']).toBe('nosniff');
    expect(served.headers['content-security-policy']).toBe("default-src 'none'; sandbox");
  });

  // T6: AC3, AC8: the API's refusals: 400, nothing stored, nothing written.
  describe('refused', () => {
    it.each(notImages)('answers 400 under photo for %s declared image/png and named x.png', async (_case, bytes) => {
      const before = await users();
      const filesBefore = files();

      const response = await patch({ bytes, filename: 'x.png', contentType: 'image/png' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: 'Validation failed', fieldErrors: { photo: notImage } });
      await expectNothingChanged(before, filesBefore);
    });

    it('answers 400 under photo for 2,097,153 bytes with multer’s limit, and stores nothing', async () => {
      const before = await users();
      const filesBefore = files();

      const response = await patch({ bytes: padTo(png(), 2_097_153) });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: 'Validation failed', fieldErrors: { photo: tooLarge } });
      await expectNothingChanged(before, filesBefore);
    });

    it('accepts exactly 2,097,152 bytes', async () => {
      const upload = padTo(png(), 2_097_152);

      const response = await patch({ bytes: upload });

      expect(response.status).toBe(200);
      expect(fileOf((await rowOf(ctx.userId)).photo_path!).equals(upload)).toBe(true);
    });

    it('answers 400 under photo for a photo text part', async () => {
      const before = await users();
      const filesBefore = files();

      const response = await patch(undefined, { ...validParts, photo: png().toString('latin1') });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: 'Validation failed', fieldErrors: { photo: notImage } });
      await expectNothingChanged(before, filesBefore);
    });

    it.each<[string, () => Test]>([
      ['a photo text part and a photo file part', () => patch({ bytes: png() }, { ...validParts, photo: 'text' })],
      ['two photo files', () => patch({ bytes: png() }).attach('photo', png(), 'second.png')],
      [
        'a file under fullName',
        () =>
          patch(undefined, { username: 'a.b.c', phoneCountryCode: '+1', phoneNumber: '' }).attach(
            'fullName',
            png(),
            'x.png',
          ),
      ],
      [
        'a photo and 11 parts',
        () => patch({ bytes: png() }, { ...validParts, a: '1', b: '2', c: '3', d: '4', e: '5', f: '6' }),
      ],
      ['a photo and a field of 2 KB', () => patch({ bytes: png() }, { ...validParts, fullName: 'a'.repeat(2048) })],
    ])('answers 400 for %s, storing and writing nothing', async (_case, send) => {
      const before = await users();
      const filesBefore = files();

      const response = await send();

      expect(response.status).toBe(400);
      expect(typeof response.body.message).toBe('string');
      await expectNothingChanged(before, filesBefore);
    });

    it('answers every failing field at once: an invalid name and an invalid photo', async () => {
      const before = await users();
      const filesBefore = files();

      const response = await patch({ bytes: notImages[1]![1] }, { ...validParts, fullName: ' ' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        message: 'Validation failed',
        fieldErrors: { fullName: 'Name is required', photo: notImage },
      });
      await expectNothingChanged(before, filesBefore);
    });

    it('answers the taken username’s 409 and stores no photo', async () => {
      const before = await users();
      const filesBefore = files();

      const response = await patch({ bytes: png() }, { ...validParts, username: 'other.person' });

      expect(response.status).toBe(409);
      expect(response.body.fieldErrors).toEqual({ username: 'This username is already taken' });
      await expectNothingChanged(before, filesBefore);
    });
  });

  // T9: AC9, AC19: one UPDATE, keyed on the session user's ID and the old name.
  it('runs one UPDATE on users whose WHERE holds the session user’s ID and the photo name it replaces', async () => {
    const first = await recordSql(() => patch({ bytes: png() }));
    const firstName = (await rowOf(ctx.userId)).photo_path!;
    const second = await recordSql(() => patch({ bytes: baselineJpeg() }));

    for (const [statements, old] of [
      [first, 'IS NULL'],
      [second, `= ${JSON.stringify(firstName)}`],
    ] as const) {
      const updates = statements.filter((sql) => /^UPDATE\b.*\busers\b/is.test(sql));
      expect(updates).toHaveLength(1);
      const where = whereOf(updates[0]!).replaceAll(/[()]/g, '').trim();
      expect(where).toBe(`"id" = ${ctx.userId} AND "photo_path" ${old}`);
      expect(updates[0]).toMatch(/"full_name"[\s\S]*"photo_path"[\s\S]*"photo_mime_type"[\s\S]*"photo_updated_at"/);
      expect(updates[0]).not.toMatch(/"email"|"password_hash"/);
    }
  });

  it('gives two saves of the same user at once both 200, the row one of the two files and the folder only that one', async () => {
    for (let round = 0; round < 5; round += 1) {
      const otherFiles = [(await rowOf(ctx.otherId)).photo_path!];
      const [a, b] = await Promise.all([patch({ bytes: png() }), patch({ bytes: baselineJpeg() })]);

      expect([a.status, b.status]).toEqual([200, 200]);
      const row = await rowOf(ctx.userId);
      expect(row.photo_path).toMatch(storedName);
      expect(files()).toEqual([...otherFiles, row.photo_path!].toSorted());
    }
  });

  // Task 029 review: the synchronous driver never lets another save run between the name read and the update, so the
  // compare on the old name is forced here: another save lands in between, and then never stops landing.
  describe('when the row changes between the name read and the update', () => {
    type NameReader = { photoNameOf: (userId: number) => Promise<string | null> };
    // The private read, reached through Nest's typed lookup.
    const reader = () => ctx.app.get<UsersService, NameReader>(UsersService);
    const between = '0e6f6b5c-3c1d-4d8a-9f00-0123456789ab.png';

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('reads the name again, replaces the photo the other save stored, and leaves no file of it', async () => {
      expect((await patch({ bytes: png() })).status).toBe(200);
      const service = reader();
      const real = service.photoNameOf.bind(service);
      let landed = false;
      const read = vi.spyOn(service, 'photoNameOf').mockImplementation(async (userId) => {
        const name = await real(userId);
        if (landed) return name;
        landed = true;
        // Another save of the same user stores its photo now: the name read above is stale.
        writeFileSync(join(ctx.folder, between), png());
        await ctx.db.query(
          `UPDATE users SET photo_path = ?, photo_mime_type = 'image/png', photo_updated_at = '2026-10-22 10:00:00.000'
           WHERE id = ?`,
          [between, userId],
        );
        return name;
      });
      const upload = baselineJpeg();

      const response = await patch({ bytes: upload });

      expect(response.status).toBe(200);
      expect(read).toHaveBeenCalledTimes(2);
      const row = await rowOf(ctx.userId);
      expect(row.photo_path).not.toBe(between);
      expect(fileOf(row.photo_path!).equals(upload)).toBe(true);
      expect(files()).not.toContain(between);
    });

    it('stops after five tries with a 500, removing the new file and changing nothing', async () => {
      expect((await patch({ bytes: png() })).status).toBe(200);
      const before = await users();
      const filesBefore = files();
      // A name the row never holds: every update touches nothing.
      const read = vi.spyOn(reader(), 'photoNameOf').mockResolvedValue(between);

      const response = await patch({ bytes: baselineJpeg() });

      expect(response.status).toBe(500);
      expect(read).toHaveBeenCalledTimes(5);
      expect(await users()).toEqual(before);
      expect(files()).toEqual(filesBefore);
    });
  });

  // T10: AC10: the photo route answers the session user's photo only, with the serving headers.
  describe('GET /api/profile/photo', () => {
    it.each(['', `?v=${encodeURIComponent(FIXED_NOW)}`, '?v=something-else', '?v=../../etc/passwd'])(
      'answers 200 with the stored bytes and the headers, for the query %j',
      async (query) => {
        const upload = png();
        await patch({ bytes: upload });

        const response = await getPhoto(ctx.token, query);

        expect(response.status).toBe(200);
        expect((response.body as Buffer).equals(upload)).toBe(true);
        expect(response.headers['content-type']).toBe('image/png');
        expect(response.headers['content-length']).toBe(String(upload.length));
        expect(response.headers['x-content-type-options']).toBe('nosniff');
        expect(response.headers['cache-control']).toBe('no-store');
        expect(response.headers['content-security-policy']).toBe("default-src 'none'; sandbox");
        expect(response.headers['cross-origin-resource-policy']).toBe('same-origin');
      },
    );

    it('answers each user their own photo', async () => {
      const upload = png();
      await patch({ bytes: upload });

      const mine = await getPhoto(ctx.token);
      const theirs = await getPhoto(ctx.otherToken);

      expect((mine.body as Buffer).equals(upload)).toBe(true);
      expect((theirs.body as Buffer).equals(ctx.otherPhoto)).toBe(true);
      expect(theirs.headers['content-type']).toBe('image/jpeg');
    });

    it('answers one 404 body without a photo and when the file is missing from the folder', async () => {
      const none = await getPhoto(ctx.token);
      await patch({ bytes: png() });
      unlinkSync(join(ctx.folder, (await rowOf(ctx.userId)).photo_path!));
      const missing = await getPhoto(ctx.token);

      for (const response of [none, missing]) {
        expect(response.status).toBe(404);
        expect((response.body as Buffer).toString('utf8')).toBe('{"message":"Photo not found"}');
        expect(response.headers['cache-control']).toBe('no-store');
      }
    });

    it('answers 401 without a session', async () => {
      await patch({ bytes: png() });

      const response = await getPhoto(null);

      expect(response.status).toBe(401);
      expect((response.body as Buffer).includes(png().subarray(0, 8))).toBe(false);
    });

    it('registers the photo route as a GET with no parameter', () => {
      const routes = (
        ctx.app.getHttpAdapter().getInstance() as { router: { stack: { route?: { path: string } }[] } }
      ).router.stack
        .flatMap(({ route }) => (route ? [route.path] : []))
        .filter((path) => path.includes('photo'));

      expect(routes).toEqual(['/api/profile/photo']);
    });
  });

  // T11: AC14: a photo save refused before multer is answered without its body read; nothing is stored.
  describe('the checks before the multipart stage', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it.each<[string, () => Test, number, unknown]>([
      [
        'no session',
        () => server().patch(profilePath).set('X-Expected-User', ctx.email).attach('photo', png(), 'me.png'),
        401,
        { message: 'Authentication required' },
      ],
      [
        'a cross-site multipart post',
        () => patch({ bytes: png() }).set('Origin', 'http://evil.example').set('Sec-Fetch-Site', 'cross-site'),
        403,
        // CSRF's own text, in the shared shape.
        { message: expect.any(String) },
      ],
      [
        'no X-Expected-User',
        () =>
          server()
            .patch(profilePath)
            .set('Cookie', cookieFor(ctx.token))
            .field('fullName', 'X Y')
            .attach('photo', png(), 'me.png'),
        400,
        { message: writeGuardMessages.expectedUserInvalid },
      ],
      [
        'another user’s email',
        () => patch({ bytes: png() }, validParts, { token: ctx.token, email: ctx.otherEmail }),
        409,
        { message: writeGuardMessages.otherUser },
      ],
      [
        'a 3 MB photo with another user’s email',
        () => patch({ bytes: padTo(png(), 3 * 1024 * 1024) }, validParts, { token: ctx.token, email: ctx.otherEmail }),
        409,
        { message: writeGuardMessages.otherUser },
      ],
    ])('answers %s with %i without reading the body', async (_case, send, status, body) => {
      const before = await users();
      const filesBefore = files();
      const spy = interceptor();

      const response = await send();

      expect(response.status).toBe(status);
      expect(response.body).toEqual(body);
      expect(spy).not.toHaveBeenCalled();
      expect(await users()).toEqual(before);
      expect(files()).toEqual(filesBefore);
    });

    it('answers 409 with another user’s email reading nothing of users but the guard’s email', async () => {
      let response: Response | undefined;
      const statements = await recordSql(async () => {
        response = await patch({ bytes: png() }, validParts, { token: ctx.token, email: ctx.otherEmail });
      });

      expect(response!.status).toBe(409);
      const onUsers = statements.filter((sql) => /\busers\b/i.test(sql));
      expect(onUsers).toHaveLength(1);
      expect(onUsers[0]).not.toMatch(/photo|full_name|username/);
    });

    it('answers a JSON body with valid values and a photo field with 415', async () => {
      const before = await users();

      const response = await server()
        .patch(profilePath)
        .set('Cookie', cookieFor(ctx.token))
        .set('X-Expected-User', ctx.email)
        .send({ ...validParts, photo: png().toString('base64') });

      expect(response.status).toBe(415);
      expect(await users()).toEqual(before);
    });
  });
});

// T7: AC11: the client's file name and type are never used; names have one shape; nothing is written outside the folder.
describe('a photo’s file name', () => {
  const logger = new CapturingLogger();
  const root = mkdtempSync(join(tmpdir(), 'finebank-photo-root-'));
  const folder = join(root, 'uploads');
  mkdirSync(folder);
  const { ctx, rowOf, files, fileOf, patch } = photoApp({ folder, logger });

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  /** Every file under the root (the folder's parent), so a file written beside the folder shows. */
  const everything = () => readdirSync(root, { recursive: true }).map(String).toSorted();

  it.each([
    '../../evil.png',
    '..\\..\\evil.png',
    'C:\\evil.png',
    '/etc/evil.png',
    'evil.png%00.html',
    `${'a'.repeat(296)}.png`,
  ])('stores %j as <uuid>.png inside the folder, nothing anywhere else, and never logs it', async (filename) => {
    const before = everything();
    const upload = png();

    const response = await patch({ bytes: upload, filename, contentType: 'text/html' });

    expect(response.status).toBe(200);
    const row = await rowOf(ctx.userId);
    expect(row.photo_path).toMatch(storedName);
    expect(row.photo_path).toMatch(/\.png$/);
    expect(row.photo_mime_type).toBe('image/png');
    expect(fileOf(row.photo_path!).equals(upload)).toBe(true);
    expect(everything()).toEqual([...before, join('uploads', row.photo_path!)].toSorted());
    expect(files()).toContain(row.photo_path);
    expect(JSON.stringify(await rowOf(ctx.userId))).not.toContain('evil');
    expect(logger.lines.join('\n')).not.toContain(filename.slice(-12));
  });

  it.each([
    ['a path', '../x.png', 'image/png'],
    ['a name without a UUID', 'x.png', 'image/png'],
    ['an uppercase UUID', '0E6F6B5C-3C1D-4D8A-9F00-0123456789AB.png', 'image/png'],
    ['a UUID that is not v4', '0e6f6b5c-3c1d-1d8a-9f00-0123456789ab.png', 'image/png'],
    ['.png with image/jpeg', '0e6f6b5c-3c1d-4d8a-9f00-0123456789ab.png', 'image/jpeg'],
    ['.jpg with image/png', '0e6f6b5c-3c1d-4d8a-9f00-0123456789ab.jpg', 'image/png'],
    ['another type', '0e6f6b5c-3c1d-4d8a-9f00-0123456789ab.png', 'text/html'],
  ])('is refused by the database’s CHECK for %s', async (_case, name, mimeType) => {
    await expect(
      ctx.db.getRepository(User).update(
        { id: ctx.userId },
        // A type outside the two, on purpose: the database refuses it.
        { photoPath: name, photoMimeType: mimeType as PhotoMimeType, photoUpdatedAt: new Date(FIXED_NOW) },
      ),
    ).rejects.toThrow(/CHECK constraint failed/);
  });

  it.each([
    ['a name without a time', { photo_path: '0e6f6b5c-3c1d-4d8a-9f00-0123456789ab.png', photo_mime_type: 'image/png' }],
    ['a time without a name', { photo_updated_at: '2026-10-22 10:00:00.000' }],
  ])('is refused by the database’s CHECK for %s', async (_case, columns) => {
    const names = Object.keys(columns);
    await expect(
      ctx.db.query(`UPDATE users SET ${names.map((name) => `${name} = ?`).join(', ')} WHERE id = ?`, [
        ...Object.values(columns),
        ctx.userId,
      ]),
    ).rejects.toThrow(/CHECK constraint failed/);
  });

  it.each(['../x.png', '..\\x.png', 'x.png', '/etc/passwd', `${folder}/0e6f6b5c-3c1d-4d8a-9f00-0123456789ab.png`])(
    'makes the store refuse the name %j for every operation',
    async (name) => {
      const store = ctx.app.get(PhotoStore);

      await expect(store.read(name)).rejects.toThrow(/photo name/);
      await expect(store.write(name, Buffer.from('x'))).rejects.toThrow(/photo name/);
      await expect(store.remove(name)).rejects.toThrow(/photo name/);
      expect(everything().filter((file) => !file.startsWith('uploads'))).toEqual([]);
    },
  );
});

/** A store whose disk fails on demand: a partial write then an error, or a removal error. */
class ControlledStore extends PhotoStore {
  failWrite?: string;
  failRemove?: string;

  override async write(name: string, bytes: Uint8Array): Promise<void> {
    if (!this.failWrite) return super.write(name, bytes);
    await super.write(name, bytes.subarray(0, 10));
    throw Object.assign(new Error(`${this.failWrite}: the disk failed`), { code: this.failWrite });
  }

  override async remove(name: string): Promise<void> {
    if (this.failRemove) throw Object.assign(new Error(`${this.failRemove}: resource busy`), { code: this.failRemove });
    return super.remove(name);
  }
}

// T8: AC9: the file write and the row update stay consistent when the disk or the database fails.
describe('a photo save when the disk or the database fails', () => {
  const logger = new CapturingLogger();
  let store: ControlledStore;
  const { ctx, users, rowOf, files, fileOf, patch } = photoApp({
    logger,
    store: (folder) => {
      store = new ControlledStore(folder);
      return store;
    },
  });

  beforeEach(async () => {
    // The requester starts with a stored photo, the one a failed save must keep.
    const saved = await patch({ bytes: progressiveJpeg() });
    if (saved.status !== 200) throw new Error(`The starting photo was not saved: ${saved.status}`);
    logger.lines.length = 0;
  });

  afterEach(async () => {
    // Before the next test's saves (the outer beforeEach saves the other user's photo first).
    store.failWrite = undefined;
    store.failRemove = undefined;
    await ctx.db.query('DROP TRIGGER IF EXISTS fail_users_update');
  });

  it.each(['ENOSPC', 'EACCES'])(
    'answers 500 to a write failing with %s, leaving no file and the row unchanged',
    async (code) => {
      const before = await users();
      const filesBefore = files();
      store.failWrite = code;

      const response = await patch({ bytes: png() });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ message: 'Internal server error' });
      expect(await users()).toEqual(before);
      expect(files()).toEqual(filesBefore);
    },
  );

  it('answers 409 to a taken username, removing the new file and keeping the old file and row', async () => {
    const before = await users();
    const filesBefore = files();

    const response = await patch({ bytes: png() }, { ...validParts, username: 'other.person' });

    expect(response.status).toBe(409);
    expect(await users()).toEqual(before);
    expect(files()).toEqual(filesBefore);
  });

  it('answers 500 to a database error in the update, removing the new file and keeping the old file and row', async () => {
    const before = await users();
    const filesBefore = files();
    await ctx.db.query(
      "CREATE TRIGGER fail_users_update BEFORE UPDATE ON users BEGIN SELECT RAISE(ABORT, 'disk I/O error'); END",
    );

    const response = await patch({ bytes: png() });

    expect(response.status).toBe(500);
    expect(await users()).toEqual(before);
    expect(files()).toEqual(filesBefore);
  });

  it('answers 200 when the old file’s removal fails: the new photo stored, the old file kept, one log line', async () => {
    const old = (await rowOf(ctx.userId)).photo_path!;
    store.failRemove = 'EBUSY';
    const upload = png();

    const response = await patch({ bytes: upload });

    expect(response.status).toBe(200);
    const row = await rowOf(ctx.userId);
    expect(row.photo_path).not.toBe(old);
    expect(fileOf(row.photo_path!).equals(upload)).toBe(true);
    expect(files()).toContain(old);
    expect(logger.lines.filter((line) => line.includes('EBUSY'))).toHaveLength(1);
  });

  it('answers 200 when the old file is already gone', async () => {
    unlinkSync(join(ctx.folder, (await rowOf(ctx.userId)).photo_path!));

    const response = await patch({ bytes: png() });

    expect(response.status).toBe(200);
    expect(files()).toContain((await rowOf(ctx.userId)).photo_path);
    expect(logger.lines.filter((line) => /ENOENT|error/i.test(line))).toEqual([]);
  });
});

// The folder of a backend test app: its own, removed when the app closes (task 029).
describe('the test app’s uploads folder', () => {
  it('is a temporary folder of its own, removed when the app closes', async () => {
    const app = await createTestApp({ config: { nodeEnv: 'test' } });
    const folder = uploadsFolderOf(app);

    expect(folder.startsWith(tmpdir())).toBe(true);
    expect(existsSync(folder)).toBe(true);
    await app.close();
    expect(existsSync(folder)).toBe(false);
  });
});
