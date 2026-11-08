import { Tooltip } from 'radix-ui';
import { cloneElement, type ReactElement, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import styles from './NotAvailableTooltip.module.css';

const TEXT = 'Not available';

type NotAvailableTooltipProps = {
  /**
   * The one control it describes: a `button` shown disabled with `aria-disabled`, so it keeps focus and does nothing.
   * It takes the tooltip's ref and event handlers.
   */
  children: ReactElement<{ 'aria-describedby'?: string }>;
  /** Where the text shows: above the control, or under it where above would cover another control. */
  side?: 'top' | 'bottom';
};

/** Whether the pointer is on the element. False where the environment keeps no hover state. */
const hovered = (element: Element | null) => element?.matches(':hover') ?? false;

/**
 * "Not available" for a control that does nothing yet (#133): Balances' Add Accounts, Edit Accounts and each card's
 * Remove, Account Details' Remove (#22, #23, #134 c). Code-only, not designed. The control is described by the text at
 * all times through `aria-describedby`, never a `title`: by a hidden copy kept in the document, and by the tooltip
 * itself while it shows. On Radix Tooltip, the text shows above the control (or under it, `side`) on mouse hover and
 * on keyboard focus, and stays while the pointer is on the control or on the text, or while the control has keyboard
 * focus; a press on the control keeps it, since the control does nothing. Escape hides it until the next hover or
 * focus; leaving and blur hide it (WCAG 1.4.13).
 */
export function NotAvailableTooltip({ children, side = 'top' }: NotAvailableTooltipProps) {
  const descriptionId = useId();
  const ownDescription = children.props['aria-describedby'];
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const escaped = useRef(false);

  // Radix asks to close on a press, a leave, a blur and Escape. Only Escape closes at once; the others close once the
  // pointer is off the control and the text and the control has no keyboard focus.
  const onOpenChange = (next: boolean) => {
    if (next) {
      setOpen(true);
      return;
    }
    if (escaped.current) {
      escaped.current = false;
      setOpen(false);
      return;
    }
    const trigger = triggerRef.current;
    if (trigger?.matches(':focus-visible') || hovered(trigger) || hovered(contentRef.current)) {
      return;
    }
    setOpen(false);
  };

  return (
    <Tooltip.Provider delayDuration={0}>
      <Tooltip.Root open={open} onOpenChange={onOpenChange}>
        <Tooltip.Trigger ref={triggerRef} asChild>
          {/* The control's own description first. While the tooltip shows, Radix adds it to the description; the
              hidden copy would then read the text twice. */}
          {cloneElement(children, {
            'aria-describedby': open ? ownDescription : [ownDescription, descriptionId].filter(Boolean).join(' '),
          })}
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            ref={contentRef}
            className={styles.tooltip}
            side={side}
            onEscapeKeyDown={() => {
              escaped.current = true;
            }}
          >
            {TEXT}
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
      {/* The description, outside the control's container so it adds nothing to the page's text. */}
      {createPortal(
        <span id={descriptionId} hidden>
          {TEXT}
        </span>,
        document.body,
      )}
    </Tooltip.Provider>
  );
}
