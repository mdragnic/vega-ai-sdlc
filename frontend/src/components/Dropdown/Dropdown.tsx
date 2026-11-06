import { Select } from 'radix-ui';
import { useCallback, useEffect, useRef, useState } from 'react';

import { ArrowDown2, DownArrow24 } from '../../assets/icons';
import styles from './Dropdown.module.css';

/**
 * One option: its value, its label, and the text typing matches (typeahead), the label by default; the country codes
 * are found by their digits, `880` for `+880` (task 028).
 */
export type DropdownOption = { value: string; label: string; textValue?: string };

type DropdownProps = {
  /** In display order. Each value is a non-empty string. */
  options: readonly DropdownOption[];
  value: string;
  /** Called once with the chosen value; not called when the selected option is chosen again. */
  onValueChange: (value: string) => void;
  /**
   * The closed look of one place: `box` the 110 Savings Goal period, `plain` the 110 Saving Summary period,
   * `inline` the 111 country code (the label only, in the font and color of its field), `input` the Account
   * Type select of 106 edit mode, styled like `Input` (#26), `comparison` the chart control of 104 Statistics
   * ("Weekly Comparison") and 109 ("Monthly Comparison").
   */
  variant: 'box' | 'plain' | 'inline' | 'input' | 'comparison';
  /** The field name, for a native form submit. */
  name?: string;
  /**
   * Radix Select's: the list does not open while it is set, as a form's fields while it saves (task 022). The look
   * stays the same; the trigger is a disabled button, out of the Tab order.
   */
  disabled?: boolean;
  /** Called with the trigger, for a form that focuses its first field with an error (react-hook-form's `field.ref`). */
  triggerRef?: (trigger: HTMLButtonElement | null) => void;
  /** The id of the message that describes the trigger, such as its field error (task 028). */
  'aria-describedby'?: string;
  /** Set while the field has an error (task 028). */
  'aria-invalid'?: boolean;
} & (
  | { 'aria-label': string; 'aria-labelledby'?: never; id?: never }
  | { 'aria-labelledby': string; 'aria-label'?: never; id?: never }
  /** The trigger's id, for a visible `<label htmlFor>` that names it; a click on the label focuses it (task 022). */
  | { id: string; 'aria-label'?: never; 'aria-labelledby'?: never }
);

/**
 * The one shared select (#60), on Radix Select: Account Type (#26), the Goals period selectors (#30), the
 * country code (#33, #43) and the chart comparisons (#20). Each variant keeps its Figma look closed; the open list
 * has one look for all (#90 a) and opens below the trigger, flipping above when there is no room, and scrolls when
 * it is long.
 */
export function Dropdown({
  options,
  value,
  onValueChange,
  variant,
  name,
  disabled,
  triggerRef,
  'aria-describedby': describedBy,
  'aria-invalid': invalid,
  ...label
}: DropdownProps) {
  // Radix moves focus by script, and Chrome then shows the focus ring on the trigger even after a mouse
  // choice. The ring is for the keyboard only (#87), so it is hidden when focus comes back after a pointer:
  // a choice in the list or a press outside it, which closes it.
  const pointerUsed = useRef(false);
  const [pointerFocus, setPointerFocus] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const triggerId = 'id' in label ? label.id : undefined;
  // The trigger kept here and given to the screen's ref too.
  const attachTrigger = useCallback(
    (node: HTMLButtonElement | null) => {
      trigger.current = node;
      triggerRef?.(node);
    },
    [triggerRef],
  );

  // A click on a visible `<label for>` focuses the trigger, as a label does for a native select, and opens nothing: the
  // label's own activation, which would forward a click that Radix takes for a touch and opens the list on, is
  // cancelled. The trigger's own clicks are left to Radix, so a click with no pointer press (assistive technology) still
  // opens the list.
  useEffect(() => {
    const element = trigger.current;
    if (triggerId === undefined || element === null) return undefined;
    const labels = [...element.labels];
    const focusOnly = (event: MouseEvent) => {
      event.preventDefault();
      element.focus();
    };
    for (const labelElement of labels) labelElement.addEventListener('click', focusOnly);
    return () => {
      for (const labelElement of labels) labelElement.removeEventListener('click', focusOnly);
    };
  }, [triggerId]);

  const notePointer = () => {
    pointerUsed.current = true;
  };
  const noteKeys = () => {
    pointerUsed.current = false;
    setPointerFocus(false);
  };

  return (
    <Select.Root value={value} onValueChange={onValueChange} name={name} disabled={disabled}>
      <Select.Trigger
        {...label}
        ref={attachTrigger}
        aria-describedby={describedBy}
        aria-invalid={invalid}
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
        {variant === 'comparison' && (
          <Select.Icon asChild>
            <DownArrow24 className={styles.comparisonChevron} />
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
              <Select.Item
                key={option.value}
                value={option.value}
                textValue={option.textValue}
                className={styles.option}
              >
                <Select.ItemText>{option.label}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
