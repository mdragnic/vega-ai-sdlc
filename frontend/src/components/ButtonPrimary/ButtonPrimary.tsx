import type { ComponentPropsWithRef } from 'react';

import { Spinner } from '../Spinner/Spinner';
import styles from './ButtonPrimary.module.css';

type ButtonPrimaryProps = Omit<ComponentPropsWithRef<'button'>, 'type' | 'className'> & {
  type?: 'button' | 'submit';
  /**
   * While a form is saving: the disabled look with a spinner, `aria-busy` and `aria-disabled` (#6). Not the
   * native `disabled`, so the button keeps keyboard focus; its clicks are cancelled instead, which also stops
   * Enter in a field from submitting, since the browser submits a form by clicking its default button.
   */
  loading?: boolean;
};

/**
 * Figma `Button/primary` (402:5239). Active=Yes is the teal default; Active=No, the gray variant in the
 * component export, is the disabled look, also while loading. The width comes from the parent. `aria-disabled`
 * gives the same look without the spinner, as "Save changes" before any change (#127): focusable, its clicks cancelled.
 */
export function ButtonPrimary({
  type = 'button',
  disabled,
  loading = false,
  onClick,
  children,
  'aria-disabled': ariaDisabled,
  ...button
}: ButtonPrimaryProps) {
  const unavailable = loading || ariaDisabled === true || ariaDisabled === 'true';
  return (
    <button
      {...button}
      type={type === 'submit' ? 'submit' : 'button'}
      className={styles.button}
      disabled={disabled}
      aria-disabled={unavailable || undefined}
      aria-busy={loading || undefined}
      onClick={(event) => {
        if (unavailable) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
    >
      {/* While loading the label is transparent, so screen readers still read it as the button's name. */}
      <span className={loading ? styles.hiddenLabel : undefined}>{children}</span>
      {loading && (
        <span className={styles.spinner}>
          <Spinner />
        </span>
      )}
    </button>
  );
}
