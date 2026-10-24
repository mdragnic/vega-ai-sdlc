import { Dialog, VisuallyHidden } from 'radix-ui';
import { use, useCallback, useEffect, useRef, type ReactNode } from 'react';

import { X32 } from '../../assets/icons';
import { ContentAreaContext } from '../AppLayout/AppLayout';
import styles from './Popup.module.css';

/** What Tab can reach, in document order: the content's first field, or else the X. */
const focusable = ['input:not([type="hidden"])', 'select', 'textarea', 'button', 'a[href]', '[tabindex]']
  .map((selector) => `${selector}:not([disabled]):not([tabindex="-1"])`)
  .join(', ');

type PopupProps = {
  open: boolean;
  /** Called with `false` once when the X, Esc or a click on the dimmed area closes the popup (#35). */
  onOpenChange: (open: boolean) => void;
  /** Names the dialog. Visually hidden: no popup title is designed. */
  title: string;
  /** Unmounted on close, so state inside it is discarded (#35); state kept above it, like a form, is not. */
  children: ReactNode;
};

/**
 * The modal shell of every popup (104.1, 110.1, 110.2), on Radix Dialog. The overlay dims the content area
 * only, right of the sidebar and below the header, as drawn; the whole page is blocked all the same: the
 * page does not scroll, focus stays inside and everything outside is hidden from assistive technology
 * (#35). Only the X, Esc and a click on the dimmed area close it. The panel's top edge is fixed and it is
 * centered on the content area (#90 c). Focus starts on the first field and returns to the opener.
 * Render it inside `AppLayout` (anywhere in the screen content): the dim starts at the content area that
 * `AppLayout` provides; outside it, the dim starts at the window top and covers the header too.
 */
export function Popup({ open, onOpenChange, title, children }: PopupProps) {
  const contentArea = use(ContentAreaContext);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<Element | null>(null);

  // The dim starts at the top of the content area, the header's bottom edge, or at the window top once the
  // header is scrolled away. The page cannot scroll while the popup is open, so it is placed once, as the
  // overlay mounts. React never sets `top` on it, so nothing overwrites this.
  const placeOverlay = useCallback(
    (node: HTMLDivElement | null) => {
      overlayRef.current = node;
      if (node) node.style.top = `${contentArea ? Math.max(0, contentArea.getBoundingClientRect().top) : 0}px`;
    },
    [contentArea],
  );

  // A press on the blocked sidebar or header lands on the page root, which would take focus out of the popup
  // to the page. Radix reports outside presses only on the click that follows, too late to stop that.
  useEffect(() => {
    if (!open) return undefined;
    const keepFocus = (event: PointerEvent) => {
      if (event.target === document.documentElement) event.preventDefault();
    };
    document.addEventListener('pointerdown', keepFocus, true);
    return () => document.removeEventListener('pointerdown', keepFocus, true);
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay ref={placeOverlay} className={styles.overlay} />
        <Dialog.Content
          ref={panelRef}
          className={styles.panel}
          aria-modal="true"
          // No description is designed.
          aria-describedby={undefined}
          // Runs before focus moves into the popup, so the opener is still focused. Radix would also select
          // the first field's text; it is drawn unselected, so the caret goes to its end instead.
          onOpenAutoFocus={(event) => {
            openerRef.current = document.activeElement;
            event.preventDefault();
            const first = panelRef.current?.querySelector<HTMLElement>(focusable);
            first?.focus();
            // Only text-like fields have a selection (selectionStart is null for number, checkbox and the like).
            if (first instanceof HTMLInputElement && first.selectionStart !== null) {
              first.setSelectionRange(first.value.length, first.value.length);
            }
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (openerRef.current instanceof HTMLElement) openerRef.current.focus();
          }}
          // A press outside the panel closes it only on the dimmed area. The sidebar and the header are not
          // dimmed but blocked: Radix turns off pointer events there, so the press lands on the page root.
          onPointerDownOutside={(event) => {
            const target = event.detail.originalEvent.target;
            if (!(target instanceof Node && overlayRef.current?.contains(target))) event.preventDefault();
          }}
        >
          <VisuallyHidden.Root asChild>
            <Dialog.Title>{title}</Dialog.Title>
          </VisuallyHidden.Root>
          {children}
          {/* After the content, so Tab reaches the fields first. */}
          <Dialog.Close className={styles.close} aria-label="Close">
            <X32 aria-hidden="true" />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
