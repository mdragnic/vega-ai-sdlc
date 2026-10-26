import { paths } from './paths.js';

/** The query parameter on Login that holds the page to open after login (#3), the name #75 uses for Google. */
export const RETURN_TO_PARAM = 'returnTo';

const authPaths: readonly string[] = [paths.login, paths.signUp, paths.forgotPassword];

/**
 * Relative values are parsed against this origin, in the browser and in the backend alike. Only a value that
 * starts with one `/` is parsed, and such a value never leaves the origin it is parsed against.
 */
const baseOrigin = 'http://finebank.invalid';

// ASCII control characters: the URL parser drops a tab or a newline anywhere, so `/\t/host` becomes `//host`.
// A space is no trick: the parser encodes it.
// oxlint-disable-next-line no-control-regex
const controlCharacter = /[\u0000-\u001f\u007f]/;

/** `//host` and `/\host` are another host to the URL parser. Control characters can hide either. */
function isSafeRelativePath(value: string): boolean {
  return value.startsWith('/') && value[1] !== '/' && value[1] !== '\\' && !controlCharacter.test(value);
}

function decodeOrNull(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

/** Router matching ignores case and a trailing slash, so `/LOGIN/` is still Login. */
function isAuthPath(pathname: string): boolean {
  const normalized = pathname.toLowerCase().replace(/\/+$/, '');
  return authPaths.includes(normalized);
}

/**
 * `value` (a `returnTo` value) as a path inside the app, with its query and hash, when it is one and not an auth
 * screen; otherwise null. Never an open redirect: an absolute URL, `//host`, `/\host`, tab and newline tricks,
 * `javascript:` and a value without the leading slash all give null.
 */
export function inAppReturnTarget(value: string | null): string | null {
  if (value === null || !isSafeRelativePath(value)) {
    return null;
  }
  const url = new URL(value, baseOrigin);
  const decodedPath = decodeOrNull(url.pathname);
  if (
    url.origin !== baseOrigin ||
    decodedPath === null ||
    !isSafeRelativePath(decodedPath) ||
    isAuthPath(decodedPath)
  ) {
    return null;
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

/** The page to open after login: `value` when it is a path inside the app, not an auth screen; otherwise Overview (#3). */
export function returnTarget(value: string | null): string {
  return inAppReturnTarget(value) ?? paths.overview;
}
