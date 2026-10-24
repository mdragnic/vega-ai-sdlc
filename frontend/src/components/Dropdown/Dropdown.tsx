import { Select } from 'radix-ui';
import { useRef, useState } from 'react';

import { ArrowDown2, DownArrow24 } from '../../assets/icons';
import styles from './Dropdown.module.css';

export type DropdownOption = { value: string; label: string };

type DropdownProps = {
  /** In display order. Each value is a non-empty string. */
  options: readonly DropdownOption[];
  value: string;
  /** Called once with the chosen value; not called when the selected option is chosen again. */
  onValueChange: (value: string) => void;
  /**
   * The closed look of one place: `box` the 110 Savings Goal period, `plain` the 110 Saving Summary period,
   * `inline` the 111 country code (the label only, in the font and color of its field), `input` the Account
   * Type select of 106 edit mode, styled like `Input` (#26).
   */
  variant: 'box' | 'plain' | 'inline' | 'input';
  /** The field name, for a native form submit. */
  name?: string;
} & ({ 'aria-label': string; 'aria-labelledby'?: never } | { 'aria-labelledby': string; 'aria-label'?: never });

/**
 * The one shared select (#60), on Radix Select: Account Type (#26), the Goals period selectors (#30) and the
 * country code (#33, #43). Each variant keeps its Figma look closed; the open list has one look for all (#90 a)
 * and opens below the trigger, flipping above when there is no room, and scrolls when it is long.
 */
export function Dropdown({ options, value, onValueChange, variant, name, ...label }: DropdownProps) {
  // Radix moves focus by script, and Chrome then shows the focus ring on the trigger even after a mouse
  // choice. The ring is for the keyboard only (#87), so it is hidden when focus comes back after a pointer:
  // a choice in the list or a press outside it, which closes it.
  const pointerUsed = useRef(false);
  const [pointerFocus, setPointerFocus] = useState(false);
  const notePointer = () => {
    pointerUsed.current = true;
  };
  const noteKeys = () => {
    pointerUsed.current = false;
    setPointerFocus(false);
  };

  return (
    <Select.Root value={value} onValueChange={onValueChange} name={name}>
      <Select.Trigger
        {...label}
        className={`${styles.trigger} ${styles[variant]}`}
        data-pointer-focus={pointerFocus || undefined}
        onPointerDown={notePointer}
        onKeyDown={noteKeys}
        onFocus={() => setPointerFocus(pointerUsed.current)}
        onBlur={() => {
          pointerUsed.current = false;
          setPointerFocus(false);
        }}
      >
        <Select.Value />
        {variant === 'input' && (
          <Select.Icon asChild>
            <DownArrow24 className={styles.inputChevron} />
          </Select.Icon>
        )}
        {(variant === 'box' || variant === 'plain') && (
          <Select.Icon asChild>
            <ArrowDown2 className={styles.chevron} />
          </Select.Icon>
        )}
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          className={styles.list}
          position="popper"
          side="bottom"
          align="start"
          onPointerDown={notePointer}
          onPointerUp={notePointer}
          onPointerDownOutside={notePointer}
          onKeyDown={noteKeys}
        >
          <Select.Viewport className={styles.viewport}>
            {options.map((option) => (
              <Select.Item key={option.value} value={option.value} className={styles.option}>
                <Select.ItemText>{option.label}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
