import { readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

/**
 * Test images for the e2e run (task 029), as `backend/test/helpers/images.ts` builds them: the baseline JPEG is Chromium's own
 * encoder's (`fixtures/photo-baseline.jpg`, see `fixtures/README.md`); the PNGs, the EXIF, comment and trailing-data
 * case and the polyglot are built here in code.
 */

/** The PNG signature (ISO 15948), checked by hand. */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** A PNG chunk: length, type, data, CRC-32 over type and data. */
function chunk(type: string, data: Uint8Array): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'latin1');
  Buffer.from(data).copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

/** An RGB PNG of `width` x `height`, a two-colour pattern, built with node:zlib. */
export function png(width = 40, height = 30): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // truecolour
  const rows: number[] = [];
  for (let y = 0; y < height; y += 1) {
    rows.push(0); // filter: none
    for (let x = 0; x < width; x += 1) rows.push(...(x < width / 2 ? [0x29, 0x9d, 0x91] : [0xe7, 0x3d, 0x1c]));
  }
  return Buffer.concat([
    Buffer.from(PNG_SIGNATURE),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.from(rows))),
    chunk('IEND', new Uint8Array()),
  ]);
}

/** Chromium's baseline JPEG, 120 x 80 (fixtures/README.md). */
export const baselineJpeg = (): Buffer => readFileSync(new URL('./fixtures/photo-baseline.jpg', import.meta.url));

/** A JPEG segment: its marker and its data with the length. */
const segment = (marker: number, data: Uint8Array) =>
  Buffer.concat([Buffer.from([0xff, marker, (data.length + 2) >> 8, (data.length + 2) & 0xff]), data]);

type IfdValue = { tag: number; type: 1 | 2 | 3 | 4 | 5; values: number[] | string };

/** The bytes of one big-endian TIFF IFD at `offset`, its out-of-line values right after it. */
function ifd(entries: IfdValue[], offset: number): Buffer {
  const sizes = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8 } as const;
  const head = Buffer.alloc(2 + entries.length * 12 + 4);
  head.writeUInt16BE(entries.length, 0);
  const data: Buffer[] = [];
  let dataOffset = offset + head.length;
  entries.forEach(({ tag, type, values }, index) => {
    const raw =
      typeof values === 'string'
        ? Buffer.from(`${values}\u0000`, 'latin1')
        : Buffer.concat(
            values.map((value) => {
              const one = Buffer.alloc(sizes[type] === 8 ? 4 : sizes[type]);
              if (type === 1) one.writeUInt8(value);
              else if (type === 3) one.writeUInt16BE(value);
              else one.writeUInt32BE(value);
              return one;
            }),
          );
    const count = typeof values === 'string' ? raw.length : type === 5 ? values.length / 2 : values.length;
    const at = 2 + index * 12;
    head.writeUInt16BE(tag, at);
    head.writeUInt16BE(type, at + 2);
    head.writeUInt32BE(count, at + 4);
    if (raw.length <= 4) raw.copy(head, at + 8);
    else {
      head.writeUInt32BE(dataOffset, at + 8);
      data.push(raw);
      dataOffset += raw.length;
    }
  });
  return Buffer.concat([head, ...data]);
}

/** IFD0: Make, Model, Orientation 6 and the pointers to the EXIF and GPS IFDs. */
const ifd0Entries = (exifAt: number, gpsAt: number): IfdValue[] => [
  { tag: 0x010f, type: 2, values: 'FineCam' },
  { tag: 0x0110, type: 2, values: 'Model X1' },
  { tag: 0x0112, type: 3, values: [6] },
  { tag: 0x8769, type: 4, values: [exifAt] },
  { tag: 0x8825, type: 4, values: [gpsAt] },
];

/** EXIF in a TIFF block: Make, Model, Orientation 6, DateTimeOriginal and a GPS location (Belgrade). */
function exifBlock(): Buffer {
  const ifd0Size = ifd(ifd0Entries(0, 0), 8).length;
  const exifEntries: IfdValue[] = [{ tag: 0x9003, type: 2, values: '2026:10:20 14:30:00' }];
  const exifAt = 8 + ifd0Size;
  const exif = ifd(exifEntries, exifAt);
  const gpsAt = exifAt + exif.length;
  const gps = ifd(
    [
      { tag: 0x0000, type: 1, values: [2, 3, 0, 0] },
      { tag: 0x0001, type: 2, values: 'N' },
      { tag: 0x0002, type: 5, values: [44, 1, 49, 1, 1234, 100] },
      { tag: 0x0003, type: 2, values: 'E' },
      { tag: 0x0004, type: 5, values: [20, 1, 27, 1, 4410, 100] },
    ],
    gpsAt,
  );
  return Buffer.concat([
    Buffer.from('Exif\u0000\u0000', 'latin1'),
    Buffer.from([0x4d, 0x4d, 0x00, 0x2a, 0, 0, 0, 8]),
    ifd(ifd0Entries(exifAt, gpsAt), 8),
    exif,
    gps,
  ]);
}

/** The text in the comment of `withExif`'s JPEG. */
export const JPEG_COMMENT = 'Holiday photo, kept as uploaded';
/** The bytes after `withExif`'s end-of-image marker. */
export const TRAILING_DATA = Buffer.from('TRAILING-DATA-AFTER-EOI', 'latin1');

/**
 * A phone's JPEG: `jpeg` with an EXIF APP1 (GPS location, camera, time taken, orientation 6) after its APP0, a comment
 * (COM) before its first scan's tables, and data after its end marker (#128 b3: all kept as uploaded).
 */
export function withExif(jpeg: Buffer = baselineJpeg()): Buffer {
  const app0Length = jpeg.readUInt16BE(4);
  const afterApp0 = 4 + app0Length;
  return Buffer.concat([
    jpeg.subarray(0, afterApp0),
    segment(0xe1, exifBlock()),
    segment(0xfe, Buffer.from(JPEG_COMMENT, 'latin1')),
    jpeg.subarray(afterApp0),
    TRAILING_DATA,
  ]);
}

/** The script in the polyglot: it would show a dialog and log a line if it ever ran. */
export const POLYGLOT_HTML =
  '<!doctype html><html><body><h1>polyglot</h1><script>alert("polyglot");console.log("polyglot ran");document.title="ran"</script></body></html>';

/** A polyglot (#128 b): a whole PNG, then an HTML page with a script. */
export const polyglot = (): Buffer => Buffer.concat([png(), Buffer.from(POLYGLOT_HTML, 'latin1')]);

/** `bytes` padded with zeros to exactly `length` bytes. */
export const padTo = (bytes: Buffer, length: number): Buffer =>
  Buffer.concat([bytes, Buffer.alloc(length - bytes.length)]);
