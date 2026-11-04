import type { ComponentPropsWithRef } from 'react';

import { Edit } from '../../assets/icons';
import styles from './AdjustButton.module.css';

type AdjustButtonProps = Omit<ComponentPropsWithRef<'button'>, 'type' | 'className' | 'children'> & {
  /** The visible label, also the button's name: "Adjust Goal" (110), "Adjust" (110's category cards, task 027). */
  label: string;
};

/**
 * 110's outlined "Adjust Goal" (and the category cards' "Adjust", task 027): the label, then the `Edit` pencil, both
 * Primary, in a 1px Primary border on white. The ring on keyboard focus only (#87); no hover style (not designed).
 */
export function AdjustButton({ label, ...button }: AdjustButtonProps) {
  return (
    <button {...button} type="button" className={styles.button}>
      {label}
      <Edit className={styles.icon} aria-hidden="true" />
    </button>
  );
}
