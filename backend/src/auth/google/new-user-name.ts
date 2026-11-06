/** Full Name's maximum (#15), counted as `fullNameSchema` counts it: in code points (#126 a). */
const MAX_CODE_POINTS = 100;

/** Every control character (Cc), such as a tab or a line break, which the Full name rule refuses (#126 a). */
const controlCharacters = /\p{Cc}/gu;

/** Nothing visible: only whitespace, control (Cc) and format (Cf) characters, the rule's "required" (#120 b3). */
const invisibleOnly = /^[\p{White_Space}\p{Cc}\p{Cf}]*$/u;

/** The text cut to its first 100 code points, never inside one, then trimmed. */
// oxlint-disable-next-line typescript/no-misused-spread
const cut = (text: string): string => [...text].slice(0, MAX_CODE_POINTS).join('').trim();

/**
 * The name of a new Google user (#62, #103), made to pass `fullNameSchema` (#126 a): the profile's name with its control
 * characters removed, trimmed, cut to its first 100 code points and trimmed again. With no name, or nothing visible
 * left, the part of the email before `@`, as Google gives it, cut the same way.
 */
export function newUserName({ name, email }: { name: string | undefined; email: string }): string {
  const fromProfile = cut((name ?? '').replaceAll(controlCharacters, '').trim());
  if (!invisibleOnly.test(fromProfile)) return fromProfile;
  return cut(email.slice(0, email.indexOf('@')).trim());
}
