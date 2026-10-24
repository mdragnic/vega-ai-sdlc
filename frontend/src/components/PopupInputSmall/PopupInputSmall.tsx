import { isAllowedAmountInput } from '@finebank/shared';
import {
  useCallback,
  useId,
  useRef,
  type ChangeEvent,
  type ComponentPropsWithRef,
  type MouseEvent,
  type Ref,
} from 'react';

import { FieldError } from '../FieldError/FieldError';
import styles from './PopupInputSmall.module.css';

/** Gives `node` to a forwarded ref and returns how to take it back. */
function attachRef<T>(ref: Ref<T> | undefined, node: T): () => void {
  if (typeof ref === 'function') {
    const cleanup = ref(node);
    return typeof cleanup === 'function' ? cleanup : () => ref(null);
  }
  if (ref) ref.current = node;
  return () => {
    if (ref) ref.current = null;
  };
}

type PopupInputSmallProps = Omit<
  ComponentPropsWithRef<'input'>,
  'type' | 'inputMode' | 'className' | 'value' | 'defaultValue'
> & {
  /** The text above the field, linked to it. */
  label: string;
  /** Text only, from `formatAmountInput(cents)`: cents given as a number would show 100 times the amount. */
  value?: string;
  defaultValue?: string;
  /** The inline message under the field (#6). */
  error?: string;
};

/**
 * Figma `Popup Input (small)` (416:6338): the labelled amount field of the goal popups. The value is the
 * field text: prefill it with `formatAmountInput(cents)` and read it with `parseAmountInput(text)` (#84).
 * The `$` is shown before the number, never typed or stored (#64); an empty field with a placeholder shows
 * the placeholder alone (#90 b). A change stands only if `isAllowedAmountInput` accepts the new text, so
 * the value and the caret stay on a rejected key or paste. The ref, `name`, `onChange` and `onBlur` go to
 * the native input, so react-hook-form `register` and `Controller` work.
 */
export function PopupInputSmall({ label, error, id, ref, onChange, ...field }: PopupInputSmallProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const inputRef = useRef<HTMLInputElement | null>(null);
  // The allowed text before the current edit, restored if an edit that cannot be cancelled got through.
  const allowedText = useRef('');
  const describedBy = [field['aria-describedby'], error ? errorId : undefined].filter(Boolean).join(' ');

  const setInput = useCallback(
    (node: HTMLInputElement | null) => {
      // React passes null only to a ref that returned no cleanup, and this one always returns one.
      if (!node) return undefined;
      inputRef.current = node;
      const detachForwarded = attachRef(ref, node);
      allowedText.current = node.value;

      // React's onBeforeInput does not see pastes or drops, so the native event is used.
      const rejectNotAllowed = (event: InputEvent) => {
        allowedText.current = node.value;
        // Deleting from allowed text always leaves allowed text.
        if (!event.inputType.startsWith('insert')) return;
        // The browser drops a pasted text's trailing line breaks (a spreadsheet cell ends with one), so the
        // check does too. Other line breaks become spaces, which are rejected.
        const inserted = (event.data ?? event.dataTransfer?.getData('text/plain') ?? '').replace(/[\r\n]+$/, '');
        const start = node.selectionStart ?? node.value.length;
        const end = node.selectionEnd ?? start;
        const next = node.value.slice(0, start) + inserted + node.value.slice(end);
        if (!isAllowedAmountInput(next)) event.preventDefault();
      };
      node.addEventListener('beforeinput', rejectNotAllowed);
      // With a cleanup returned, React calls it instead of calling the ref with null.
      return () => {
        node.removeEventListener('beforeinput', rejectNotAllowed);
        inputRef.current = null;
        detachForwarded();
      };
    },
    [ref],
  );

  // IME composition cannot be cancelled before it changes the text: such a change is undone here.
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (!isAllowedAmountInput(event.target.value)) {
      event.target.value = allowedText.current;
      return;
    }
    allowedText.current = event.target.value;
    onChange?.(event);
  };

  // A click on the `$` or the padding focuses the field.
  const focusField = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === inputRef.current) return;
    event.preventDefault();
    inputRef.current?.focus();
  };

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={inputId}>
        {label}
      </label>
      <div className={error ? `${styles.control} ${styles.invalid}` : styles.control} onMouseDown={focusField}>
        <span className={styles.prefix} aria-hidden="true">
          $
        </span>
        <input
          {...field}
          ref={setInput}
          id={inputId}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          className={styles.input}
          onChange={handleChange}
          aria-invalid={error ? true : field['aria-invalid']}
          aria-describedby={describedBy || undefined}
        />
      </div>
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
}
