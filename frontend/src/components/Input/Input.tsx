import { useId, useState, type ComponentPropsWithRef, type ReactNode } from 'react';

import { IconEye, IconEyeOff } from '../../assets/icons';
import { FieldError } from '../FieldError/FieldError';
import styles from './Input.module.css';

type InputProps = Omit<ComponentPropsWithRef<'input'>, 'type' | 'className'> & {
  /** The text above the field, linked to it. */
  label: string;
  /** Figma Type=Name-Email is `text` or `email`. `password` masks the value and adds the eye (#51). */
  type?: 'text' | 'email' | 'password';
  /** Shown right-aligned in the label row, like "Forgot Password?" on Login. */
  labelAction?: ReactNode;
  /** The inline message under the field (#6). */
  error?: string;
};

/**
 * Figma `Input` (402:5191), Type=Name-Email, Password and Show Password. Active=Yes, the darker border,
 * is the focus style only: a filled field without focus keeps the normal border (#63). The ref, `name`,
 * `onChange` and `onBlur` go to the native input, so react-hook-form `register` works.
 */
export function Input({ label, type = 'text', labelAction, error, id, ...field }: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const [passwordShown, setPasswordShown] = useState(false);
  const isPassword = type === 'password';
  const describedBy = [field['aria-describedby'], error ? errorId : undefined].filter(Boolean).join(' ');

  return (
    <div className={styles.field}>
      <div className={styles.labelRow}>
        <label className={styles.label} htmlFor={inputId}>
          {label}
        </label>
        {labelAction != null && <span className={styles.labelAction}>{labelAction}</span>}
      </div>
      <div className={error ? `${styles.control} ${styles.invalid}` : styles.control}>
        <input
          {...field}
          // A shown password is plain text: keep it from the spell checker (which may send it to a
          // remote service), autocorrect and autocapitalize.
          {...(isPassword && { spellCheck: false, autoCorrect: 'off', autoCapitalize: 'off' })}
          id={inputId}
          type={isPassword && passwordShown ? 'text' : type}
          className={styles.input}
          aria-invalid={error ? true : field['aria-invalid']}
          aria-describedby={describedBy || undefined}
        />
        {isPassword && (
          <button
            type="button"
            className={styles.toggle}
            aria-label={passwordShown ? 'Hide password' : 'Show password'}
            // Focus stays in the field, so it keeps the Active border while the password is shown or hidden.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setPasswordShown((shown) => !shown)}
          >
            {passwordShown ? <IconEyeOff aria-hidden="true" /> : <IconEye aria-hidden="true" />}
          </button>
        )}
      </div>
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
}
