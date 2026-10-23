import { Checkbox } from 'radix-ui';
import { useId, type ComponentPropsWithRef } from 'react';

import { IconCheck } from '../../assets/icons';
import styles from './RemindMe.module.css';

type RemindMeProps = Omit<
  ComponentPropsWithRef<typeof Checkbox.Root>,
  'checked' | 'defaultChecked' | 'onCheckedChange' | 'className' | 'children' | 'asChild'
> & {
  label: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
};

/**
 * Figma `Remind me` (402:5226): Active=Yes is checked, teal with a white check; Active=No is unchecked.
 * Built on Radix Checkbox, so a click on the box or the label, or Space, toggles it. Use it with
 * react-hook-form through `Controller` (`checked`, `onCheckedChange`, `onBlur`, `name`, `ref`).
 */
export function RemindMe({ label, id, onCheckedChange, ...box }: RemindMeProps) {
  const generatedId = useId();
  const boxId = id ?? generatedId;

  return (
    <div className={styles.row}>
      <Checkbox.Root
        {...box}
        id={boxId}
        className={styles.box}
        onCheckedChange={(checked) => onCheckedChange?.(checked === true)}
      >
        <Checkbox.Indicator className={styles.indicator}>
          <IconCheck aria-hidden="true" />
        </Checkbox.Indicator>
      </Checkbox.Root>
      <label className={styles.label} htmlFor={boxId}>
        {label}
      </label>
    </div>
  );
}
