const encoder = new TextEncoder();

/**
 * Sends a `FormData` body with its files whole (task 029). The app runs on jsdom's `FormData` and `File`, but its
 * requests go through Node's fetch (MSW), which cannot send a file part from them: vitest's conversion drops the file's
 * name, and Node's own `FormData` streams it empty in this environment. This wraps the current `fetch` (MSW's, so call it
 * after `server.listen()`): a `FormData` body is written as the `multipart/form-data` bytes a browser sends, each file
 * part with its name, type and bytes, and the `Content-Type` with the boundary, as a browser sets it. Returns the restore.
 */
export function sendFilesThroughNodeFetch(): () => void {
  const wrapped = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!(init?.body instanceof FormData)) return wrapped(input, init);
    const boundary = `----test-boundary-${Math.random().toString(16).slice(2)}`;
    const chunks: Uint8Array[] = [];
    for (const [name, value] of init.body) {
      if (typeof value === 'string') {
        chunks.push(
          encoder.encode(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`),
        );
      } else {
        chunks.push(
          encoder.encode(
            `--${boundary}\r\nContent-Disposition: form-data; name="${name}"; filename="${value.name}"\r\n` +
              `Content-Type: ${value.type || 'application/octet-stream'}\r\n\r\n`,
          ),
          new Uint8Array(await value.arrayBuffer()),
          encoder.encode('\r\n'),
        );
      }
    }
    chunks.push(encoder.encode(`--${boundary}--\r\n`));
    const body = new Uint8Array(chunks.reduce((length, chunk) => length + chunk.length, 0));
    let at = 0;
    for (const chunk of chunks) {
      body.set(chunk, at);
      at += chunk.length;
    }
    const headers = new Headers(init.headers);
    headers.set('Content-Type', `multipart/form-data; boundary=${boundary}`);
    return wrapped(input, { ...init, headers, body });
  };
  return () => {
    globalThis.fetch = wrapped;
  };
}

/** One part of a multipart body as the backend receives it: a text, or a file's name, type and bytes. */
export type MultipartPart =
  { name: string; value: string } | { name: string; file: { name: string; type: string; bytes: number[] } };

const decoder = new TextDecoder();

/** The index of `needle` in `bytes` from `from`, or -1. */
function indexOf(bytes: Uint8Array, needle: Uint8Array, from: number): number {
  outer: for (let i = from; i <= bytes.length - needle.length; i += 1) {
    for (let j = 0; j < needle.length; j += 1) if (bytes[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
}

/**
 * The parts of a `multipart/form-data` request, in order, read from its raw bytes. Node's own `request.formData()`
 * builds file parts with the global `File`, which jsdom replaces in these tests, so a file part fails there (task 029).
 */
export async function readMultipart(request: Request): Promise<MultipartPart[]> {
  const boundary = /boundary=(?:"([^"]+)"|([^;]+))/.exec(request.headers.get('Content-Type') ?? '');
  if (!boundary) throw new Error('Not a multipart request');
  const delimiter = new TextEncoder().encode(`--${boundary[1] ?? boundary[2]}`);
  const headerEnd = new TextEncoder().encode('\r\n\r\n');
  const bytes = new Uint8Array(await request.arrayBuffer());
  const parts: MultipartPart[] = [];
  let at = indexOf(bytes, delimiter, 0);
  while (at !== -1) {
    const start = at + delimiter.length;
    // `--` after the delimiter closes the body.
    if (bytes[start] === 0x2d && bytes[start + 1] === 0x2d) break;
    const next = indexOf(bytes, delimiter, start);
    if (next === -1) break;
    const part = bytes.subarray(start + 2, next - 2);
    const split = indexOf(part, headerEnd, 0);
    const headers = decoder.decode(part.subarray(0, split));
    const body = part.subarray(split + headerEnd.length);
    const name = /name="([^"]*)"/.exec(headers)?.[1] ?? '';
    const filename = /filename="([^"]*)"/.exec(headers)?.[1];
    if (filename === undefined) parts.push({ name, value: decoder.decode(body) });
    else {
      const type = /content-type:\s*([^\r\n]+)/i.exec(headers)?.[1] ?? '';
      parts.push({ name, file: { name: filename, type, bytes: [...body] } });
    }
    at = next;
  }
  return parts;
}
