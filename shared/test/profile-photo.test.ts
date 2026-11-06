import { deflateSync } from 'node:zlib';

import { describe, expect, it, vi } from 'vitest';

import { MAX_PHOTO_BYTES, photoMessages, photoSchema, photoTypeOf } from '../src/index.js';

const tooLarge = 'Photo must be at most 2 MB';
const notImage = 'Photo must be a JPG or PNG file';

/** A JPEG's start: SOI, then a JFIF APP0 segment, as an encoder writes it. */
const jpegStart = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00];
/** The PNG signature (RFC 2083 / ISO 15948), checked by hand. */
const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** A PNG chunk: length, type, data, CRC-32 over type and data. */
function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'latin1');
  Buffer.from(data).copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** A 1x1 red PNG, built here with node:zlib. */
function png(): Uint8Array {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0);
  header.writeUInt32BE(1, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // truecolor
  return Buffer.concat([
    Buffer.from(pngSignature),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.from([0, 0xff, 0, 0]))),
    chunk('IEND', new Uint8Array()),
  ]);
}

/** A JPEG start followed by `length` bytes in total (the rest zeros): the rule reads only the first bytes. */
const jpeg = (length = 64) =>
  Buffer.concat([Buffer.from(jpegStart), Buffer.alloc(Math.max(0, length - jpegStart.length))]);

/** `bytes` padded with zeros to `length`. */
const padded = (bytes: Uint8Array, length: number) => Buffer.concat([bytes, Buffer.alloc(length - bytes.length)]);

const file = (bytes: Uint8Array, name: string, type = '') => new File([bytes], name, { type });
const blob = (bytes: Uint8Array | string) => new Blob([bytes]);

/** The messages a value fails with, one per issue; empty when it passes. */
async function messages(value: unknown): Promise<string[]> {
  const result = await photoSchema.safeParseAsync(value);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

const ascii = (text: string) => Buffer.from(text, 'latin1');

// T1: AC3, AC8, the shared photo rule (#33, #76, #128 b3): the size first, then the first bytes; name and type never read.
describe('photoTypeOf', () => {
  it.each<[string, Uint8Array, string | undefined]>([
    ['a JPEG (FF D8 FF)', jpeg(), 'image/jpeg'],
    ['the three JPEG bytes alone', Uint8Array.from([0xff, 0xd8, 0xff]), 'image/jpeg'],
    ['a PNG', png(), 'image/png'],
    ['the PNG signature alone', Uint8Array.from(pngSignature), 'image/png'],
    ['nothing', new Uint8Array(), undefined],
    ['two of the JPEG bytes', Uint8Array.from([0xff, 0xd8]), undefined],
    ['seven of the PNG bytes', Uint8Array.from(pngSignature.slice(0, 7)), undefined],
    ['the PNG signature with its last byte changed', Uint8Array.from([...pngSignature.slice(0, 7), 0x0b]), undefined],
    ['a GIF', ascii('GIF89a\u0001\u0000'), undefined],
    ['text', ascii('hello, world'), undefined],
  ])('gives %s the type %j', (_case, bytes, type) => {
    expect(photoTypeOf(bytes)).toBe(type);
  });
});

describe('photoSchema', () => {
  it('names 2 MB as 2,097,152 bytes and its two texts', () => {
    expect(MAX_PHOTO_BYTES).toBe(2_097_152);
    expect(photoMessages).toEqual({ tooLarge, notImage });
  });

  it.each<[string, Blob, string]>([
    ['the JPEG', file(jpeg(), 'me.jpg', 'image/jpeg'), 'image/jpeg'],
    ['the PNG', file(png(), 'me.png', 'image/png'), 'image/png'],
    ['the JPEG named .png', file(jpeg(), 'me.png', 'image/png'), 'image/jpeg'],
    ['the PNG named .jpg', file(png(), 'me.jpg', 'image/jpeg'), 'image/png'],
    ['the JPEG with no extension and no type', file(jpeg(), 'me'), 'image/jpeg'],
    ['the PNG declared as text/html', file(png(), 'me.html', 'text/html'), 'image/png'],
    ['a Blob of the PNG (as the backend wraps a buffer)', blob(png()), 'image/png'],
    ['a PNG padded to exactly 2,097,152 bytes', blob(padded(png(), 2_097_152)), 'image/png'],
    ['a JPEG cut short (its first bytes only)', blob(jpeg(20)), 'image/jpeg'],
    [
      'a PNG with garbage after its signature',
      blob(Buffer.concat([Buffer.from(pngSignature), ascii('<html>')])),
      'image/png',
    ],
  ])('accepts %s with its detected type', async (_case, value, mimeType) => {
    const parsed = await photoSchema.parseAsync(value);

    expect(parsed.mimeType).toBe(mimeType);
    expect(parsed.file).toBe(value);
  });

  it.each<[string, unknown, string]>([
    ['a PNG of 2,097,153 bytes', blob(padded(png(), 2_097_153)), tooLarge],
    ['a 3 MB GIF (the size first)', blob(padded(ascii('GIF89a'), 3 * 1024 * 1024)), tooLarge],
    ['an empty file', file(new Uint8Array(), 'empty.png', 'image/png'), notImage],
    ['a GIF', file(ascii('GIF89a\u0001\u0000\u0001\u0000'), 'a.gif', 'image/gif'), notImage],
    ['a WebP', file(ascii('RIFF\u0000\u0000\u0000\u0000WEBPVP8 '), 'a.webp', 'image/webp'), notImage],
    ['an SVG', file(ascii('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'a.svg', 'image/svg+xml'), notImage],
    ['a PDF', file(ascii('%PDF-1.7\n'), 'a.pdf', 'application/pdf'), notImage],
    ['a HEIC', file(ascii('\u0000\u0000\u0000\u0018ftypheic'), 'a.heic', 'image/heic'), notImage],
    ['text named .png, declared image/png', file(ascii('not an image'), 'photo.png', 'image/png'), notImage],
    ['a string', 'data', notImage],
    ['the bytes as a string', ascii('ÿØÿ').toString('latin1'), notImage],
    ['two values', [blob(png()), blob(png())], notImage],
    ['null', null, notImage],
  ])('refuses %s with its one message', async (_case, value, message) => {
    expect(await messages(value)).toEqual([message]);
  });

  it('reads no more than the first 8 bytes of a file', async () => {
    const value = blob(padded(png(), 1024 * 1024));
    const slice = vi.spyOn(value, 'slice');
    const whole = [
      vi.spyOn(value, 'arrayBuffer'),
      vi.spyOn(value, 'bytes'),
      vi.spyOn(value, 'text'),
      vi.spyOn(value, 'stream'),
    ];

    await photoSchema.parseAsync(value);

    expect(slice.mock.calls).toEqual([[0, 8]]);
    for (const read of whole) expect(read).not.toHaveBeenCalled();
  });

  // Task 029 review: a chosen file changed or removed on disk cannot be read; the rule refuses it as a file with no
  // first bytes (an empty file), never throws, so a form's check or save cannot stop on it.
  it('refuses a file whose bytes cannot be read as not a JPG or PNG', async () => {
    const value = blob(png());
    vi.spyOn(value, 'slice').mockReturnValue({
      arrayBuffer: () => Promise.reject(new DOMException('The file changed', 'NotReadableError')),
    } as unknown as Blob);

    expect(await messages(value)).toEqual([notImage]);
  });

  it('reads nothing of a file over the size', async () => {
    const value = blob(padded(png(), 2_097_153));
    const slice = vi.spyOn(value, 'slice');

    expect(await messages(value)).toEqual([tooLarge]);
    expect(slice).not.toHaveBeenCalled();
  });

  it('never reads the name or the declared type', async () => {
    const value = file(png(), 'me.png', 'image/png');
    const name = vi.spyOn(value, 'name', 'get');
    const type = vi.spyOn(value, 'type', 'get');

    await photoSchema.parseAsync(value);

    expect(name).not.toHaveBeenCalled();
    expect(type).not.toHaveBeenCalled();
  });
});
