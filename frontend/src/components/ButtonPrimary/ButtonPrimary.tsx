import type { ComponentPropsWithRef } from 'react';

import { Spinner } from '../Spinner/Spinner';
import styles from './ButtonPrimary.module.css';

type ButtonPrimaryProps = Omit<ComponentPropsWithRef<'button'>, 'type' | 'className'> & {
  type?: 'button' | 'submit';
  /** While a form is saving: disabled, with a spinner and `aria-busy` (#6). */
  loading?: boolean;
};

/**
 * Figma `Button/primary` (402:5239). Active=Yes is the teal default; Active=No, the gray variant in the
 * component export, is the disabled look, also while loading. The width comes from the parent.
 */
export function ButtonPrimary({ type = 'button', disabled, loading = false, children, ...button }: ButtonPrimaryProps) {
  return (
    <button
      {...button}
      type={type === 'submit' ? 'submit' : 'button'}
      className={styles.button}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
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
