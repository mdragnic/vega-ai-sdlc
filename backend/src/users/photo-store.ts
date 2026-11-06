import { randomUUID } from 'node:crypto';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import type { PhotoMimeType } from '@finebank/shared';

/** The extension of each stored type (#76). */
const extensions: Record<PhotoMimeType, string> = { 'image/jpeg': 'jpg', 'image/png': 'png' };

/** A stored photo's name: `randomUUID()`'s shape (a lowercase UUID v4) and an extension, nothing else. */
const STORED_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png)$/;

/** A new photo's name (#76): a random UUID and the extension of the type its first bytes gave, never the client's. */
export const newPhotoName = (mimeType: PhotoMimeType): string => `${randomUUID()}.${extensions[mimeType]}`;

/**
 * The uploads folder (#76, task 029), the only code that reads or writes it: the profile photos, each a file named by
 * `newPhotoName` and nothing else. Every operation refuses a name of any other shape before touching the disk, and
 * resolves it inside the folder only. Provided by `UsersModule` with the config's folder; tests replace it to make the
 * disk fail.
 */
export class PhotoStore {
  constructor(readonly folder: string) {}

  /** Writes a new file, never over an existing one (`wx`). Fails as the disk does (a full disk, no permission). */
  async write(name: string, bytes: Uint8Array): Promise<void> {
    await writeFile(this.pathOf(name), bytes, { flag: 'wx' });
  }

  /** The file's bytes. Fails with `ENOENT` when it is missing. */
  async read(name: string): Promise<Buffer> {
    return readFile(this.pathOf(name));
  }

  /** Removes the file; one already gone is not an error. */
  async remove(name: string): Promise<void> {
    await rm(this.pathOf(name), { force: true });
  }

  private pathOf(name: string): string {
    const folder = resolve(this.folder);
    const path = resolve(folder, name);
    if (!STORED_NAME.test(name) || dirname(path) !== folder || path !== join(folder, name)) {
      throw new Error('Not a stored photo name');
    }
    return path;
  }
}
