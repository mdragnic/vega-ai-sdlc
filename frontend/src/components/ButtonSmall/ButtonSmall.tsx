import type { ComponentPropsWithRef } from 'react';

import styles from './ButtonSmall.module.css';

type ButtonSmallProps = Omit<ComponentPropsWithRef<'button'>, 'type' | 'className'> & {
  type?: 'button' | 'submit';
};

/**
 * Figma `Button small` (2:42): the small teal button, 84x32 at least, from the component export.
 * Used for Retry in the widget error state (#6, #88). A longer label widens it.
 */
export function ButtonSmall({ type = 'button', children, ...button }: ButtonSmallProps) {
  return (
    <button {...button} type={type === 'submit' ? 'submit' : 'button'} className={styles.button}>
      {children}
    </button>
  );
}
