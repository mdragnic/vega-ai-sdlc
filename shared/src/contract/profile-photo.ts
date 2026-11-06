import { z } from 'zod';

/** The most bytes of a profile photo (#33, #76): 2 MB as Windows and macOS show it, 2 × 1024 × 1024. */
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

/** The photo rule's texts (#33), one message, the first failing (#95 a). */
export const photoMessages = {
  tooLarge: 'Photo must be at most 2 MB',
  notImage: 'Photo must be a JPG or PNG file',
} as const;

/** The two types a photo can be (#33), the only types the backend stores. */
export type PhotoMimeType = 'image/jpeg' | 'image/png';

/** A JPEG starts with SOI and a marker's first byte; a PNG with its 8-byte signature. */
const signatures: [PhotoMimeType, readonly number[]][] = [
  ['image/jpeg', [0xff, 0xd8, 0xff]],
  ['image/png', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
];

/** The most first bytes the rule reads: the longest signature. */
const SIGNATURE_BYTES = 8;

/**
 * A photo's type by its first bytes (#76, magic bytes): `image/jpeg` for `FF D8 FF`, `image/png` for the PNG signature,
 * otherwise none. Nothing after them is read (#128 b3).
 */
export function photoTypeOf(bytes: Uint8Array): PhotoMimeType | undefined {
  return signatures.find(([, signature]) => signature.every((byte, index) => bytes[index] === byte))?.[0];
}

/**
 * A file's first bytes, or none when it cannot be read (a chosen file changed or removed on disk since): the rule then
 * refuses it as it does an empty file, and never throws, so a form's check or save never stops on it (task 029 review).
 */
async function firstBytes(file: Blob): Promise<Uint8Array> {
  try {
    return new Uint8Array(await file.slice(0, SIGNATURE_BYTES).arrayBuffer());
  } catch {
    return new Uint8Array();
  }
}

/**
 * The shared photo rule (#33, #76, #128), used by the form when a file is chosen and by the API on save (#74): a `Blob`
 * (a `File` in the browser; the backend wraps the uploaded bytes in one), at most `MAX_PHOTO_BYTES`, "Photo must be at
 * most 2 MB", then a JPEG or a PNG by its first bytes, "Photo must be a JPG or PNG file". One message, the first failing
 * (#95 a): the size first, so a large file is refused without reading it. Only the first 8 bytes are read, and never the
 * file's name or declared type. Anything that is not a `Blob` (a text part, two values) fails with the second text.
 * Async: parse it with `parseAsync`. The output is the `Blob` and its detected type, the only type the backend stores.
 * Typed by the global name `Blob`, so each side reads its own: the browser's in the frontend, Node's in the backend.
 */
export const photoSchema: z.ZodType<{ file: Blob; mimeType: PhotoMimeType }, Blob> = z
  .instanceof(Blob, { error: photoMessages.notImage })
  .refine((file) => file.size <= MAX_PHOTO_BYTES, { error: photoMessages.tooLarge, abort: true })
  .transform(async (file, context) => {
    const mimeType = photoTypeOf(await firstBytes(file));
    if (mimeType === undefined) {
      context.issues.push({ code: 'custom', message: photoMessages.notImage, input: file });
      return z.NEVER;
    }
    return { file, mimeType };
  });

export type Photo = z.output<typeof photoSchema>;
