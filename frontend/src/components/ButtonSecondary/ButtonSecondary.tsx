import type { ComponentPropsWithRef, ReactNode } from 'react';

import styles from './ButtonSecondary.module.css';

type ButtonSecondaryProps = Omit<ComponentPropsWithRef<'button'>, 'type' | 'className'> & {
  type?: 'button' | 'submit';
  /** Icon=Yes: shown before the label, 24px, like the Google G on Login and Sign up (#70). */
  icon?: ReactNode;
};

/** Figma `Button/secondary` (402:5233), Icon=Yes and Icon=No. The width comes from the parent. */
export function ButtonSecondary({ type = 'button', icon, children, ...button }: ButtonSecondaryProps) {
  return (
    <button {...button} type={type === 'submit' ? 'submit' : 'button'} className={styles.button}>
      {icon != null && <span className={styles.icon}>{icon}</span>}
      <span>{children}</span>
    </button>
  );
}
