import { useId, type ComponentPropsWithRef } from 'react';

import { FieldError } from '../FieldError/FieldError';
import styles from './SettingsInput.module.css';
import { usePointerFocusMark } from './usePointerFocusMark';

type SettingsInputProps = Omit<ComponentPropsWithRef<'input'>, 'type' | 'className' | 'readOnly'> & {
  /** The text above the field, linked to it. */
  label: string;
  /**
   * `text` (the default) or `password`: masked as 112 draws it, kept from the spell checker, autocorrect and
   * autocapitalize as `Input`'s password, with no eye (task 030, #129 c).
   */
  type?: 'text' | 'password';
  /** Read-only by design, as Email (#33): in the Tab order, selectable, with the #87 ring on keyboard focus. */
  readOnly?: boolean;
  /** While the form saves: read-only, its look unchanged (#6). */
  busy?: boolean;
  /** The inline message under the field (#6). */
  error?: string;
};

/**
 * Figma `Settings Input` (54:2202), 540x88 in 111: the label (Medium 16/24, Secondary), 8 under it the value (Regular
 * 16/24, Gray/02) in a 56 px box, 24 in from the label. An editable field has the app's bordered Input look (#127 a):
 * its border, the darker border on focus, the red border with its message under it while an error shows (#87 b). The
 * read-only Email stays borderless and gray (#33, #127 a), with the #87 ring on keyboard focus, as it has no caret. The
 * masked type (task 030) is the Security tab's password fields, the mask in Gray/03 as 112 draws it. The ref, `name`,
 * `onChange` and `onBlur` go to the native input, so react-hook-form `register` works.
 */
export function SettingsInput({
  label,
  type = 'text',
  readOnly = false,
  busy = false,
  error,
  id,
  ...field
}: SettingsInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const describedBy = [field['aria-describedby'], error ? errorId : undefined].filter(Boolean).join(' ');
  const { 'data-pointer-focus': pointerFocus, ...focusHandlers } = usePointerFocusMark(field);

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={inputId}>
        {label}
      </label>
      <div
        className={[styles.control, !readOnly && styles.bordered, error && styles.invalid].filter(Boolean).join(' ')}
      >
        <input
          {...field}
          // A password is kept from the spell checker (which may send it to a remote service), autocorrect and
          // autocapitalize, as `Input`'s.
          {...(type === 'password' && { spellCheck: false, autoCorrect: 'off', autoCapitalize: 'off' })}
          id={inputId}
          type={type}
          readOnly={readOnly || busy}
          className={readOnly ? `${styles.input} ${styles.readOnly}` : styles.input}
          aria-invalid={error ? true : field['aria-invalid']}
          aria-describedby={describedBy || undefined}
          data-pointer-focus={(readOnly && pointerFocus) || undefined}
          {...focusHandlers}
        />
      </div>
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
}
