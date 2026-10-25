import { paths } from './paths';

/** The query parameter on Login that holds the page to open after login (#3), the name #75 uses for Google. */
export const RETURN_TO_PARAM = 'returnTo';

const authPaths: readonly string[] = [paths.login, paths.signUp, paths.forgotPassword];

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
 * The page to open after login: `value` (the `returnTo` query value) when it is a path inside the app, not an
 * auth screen; otherwise Overview (#3). Never an open redirect: an absolute URL, `//host`, `/\host`, tab and
 * newline tricks, `javascript:` and a value without the leading slash all give Overview.
 */
export function returnTarget(value: string | null): string {
  if (value === null || !isSafeRelativePath(value)) {
    return paths.overview;
  }
  const origin = window.location.origin;
  const url = new URL(value, origin);
  const decodedPath = decodeOrNull(url.pathname);
  if (url.origin !== origin || decodedPath === null || !isSafeRelativePath(decodedPath) || isAuthPath(decodedPath)) {
    return paths.overview;
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Login with the page asked for as its return target: path, query and hash. */
export function loginPathFor({ pathname, search, hash }: { pathname: string; search: string; hash: string }): string {
  return `${paths.login}?${new URLSearchParams({ [RETURN_TO_PARAM]: `${pathname}${search}${hash}` }).toString()}`;
}
