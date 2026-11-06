import { z } from 'zod';

/** The most characters of a name (#15, #26), counted in code points (#120 b1, #126 a). */
const MAX_NAME_CODE_POINTS = 100;

/** Nothing visible: only whitespace, control (Cc) and format (Cf) characters, such as a zero-width space (#120 b3). */
const invisibleOnly = /^[\p{White_Space}\p{Cc}\p{Cf}]*$/u;

/** A control character (Cc), such as a tab or a line break (#120 b3). */
const controlCharacter = /\p{Cc}/u;

/**
 * The one rule of a name (task 022's #120 b, Full name's too by #126 a), for the form and the API (#74): the text
 * trimmed at both ends with JavaScript's `trim()` (#120 b2), then, one message per field, its first failing rule
 * (#95 a): nothing visible left is "required" (#120 b3); a control character anywhere is refused (#120 b3); more than
 * 100 code points is too long (#120 b1: code points, so the form and the API count alike in every runtime, the size is
 * bounded, and SQLite's `length()` counts the same). The output is the trimmed text, with no Unicode normalisation. A
 * value that is not a string, a missing one included, is "required".
 */
export const nameSchema = (messages: { required: string; control: string; max: string }) =>
  z
    .string({ error: messages.required })
    .trim()
    .refine((text) => !invisibleOnly.test(text), { error: messages.required, abort: true })
    .refine((text) => !controlCharacter.test(text), { error: messages.control, abort: true })
    // The spread counts code points on purpose: the decided unit (#120 b1), not graphemes.
    // oxlint-disable-next-line typescript/no-misused-spread
    .refine((text) => [...text].length <= MAX_NAME_CODE_POINTS, { error: messages.max });
