import { type FocusEvent, type KeyboardEvent, type PointerEvent, useRef, useState } from 'react';

type Handlers<Element extends HTMLElement> = {
  onPointerDown?: (event: PointerEvent<Element>) => void;
  onFocus?: (event: FocusEvent<Element>) => void;
  onKeyDown?: (event: KeyboardEvent<Element>) => void;
  onBlur?: (event: FocusEvent<Element>) => void;
};

/**
 * Chrome matches `:focus-visible` on a text input focused by the mouse, read-only too, but the #87 ring is for the
 * keyboard only: a focus that follows a pointer press is marked (`data-pointer-focus`), and a key pressed in the field
 * or leaving it drops the mark. The read-only Email (task 028) and the read-only phone (task 030) share it. `handlers`
 * are the field's own, called after the mark's.
 */
export function usePointerFocusMark<Element extends HTMLElement>(handlers: Handlers<Element> = {}) {
  const pointerPressed = useRef(false);
  const [pointerFocus, setPointerFocus] = useState(false);
  const keyboardFocus = () => {
    pointerPressed.current = false;
    setPointerFocus(false);
  };

  return {
    'data-pointer-focus': pointerFocus || undefined,
    onPointerDown: (event: PointerEvent<Element>) => {
      pointerPressed.current = true;
      handlers.onPointerDown?.(event);
    },
    onFocus: (event: FocusEvent<Element>) => {
      setPointerFocus(pointerPressed.current);
      handlers.onFocus?.(event);
    },
    onKeyDown: (event: KeyboardEvent<Element>) => {
      keyboardFocus();
      handlers.onKeyDown?.(event);
    },
    onBlur: (event: FocusEvent<Element>) => {
      keyboardFocus();
      handlers.onBlur?.(event);
    },
  };
}
