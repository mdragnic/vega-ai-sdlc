import { paths, RETURN_TO_PARAM } from '@finebank/shared';

// The return-target rule lives in @finebank/shared, so the backend checks Google's return target with the same one
// (task 012, #74): a relative in-app path only, never an open redirect (#3).
export { RETURN_TO_PARAM, returnTarget } from '@finebank/shared';

/** Login with the page asked for as its return target: path, query and hash. */
export function loginPathFor({ pathname, search, hash }: { pathname: string; search: string; hash: string }): string {
  return `${paths.login}?${new URLSearchParams({ [RETURN_TO_PARAM]: `${pathname}${search}${hash}` }).toString()}`;
}
