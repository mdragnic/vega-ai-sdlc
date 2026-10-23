import { useRef, type KeyboardEvent } from 'react';

import styles from './MenuTab.module.css';

type MenuTabProps<T extends string> = {
  /** The tablist's accessible name, usually the widget title. */
  label: string;
  tabs: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** The id of the tabpanel the widget renders; every tab controls it. */
  panelId: string;
};

/** The id of the tab for `value`, so the widget's tabpanel can be labelled by the selected tab. */
export function menuTabId(panelId: string, value: string): string {
  return `${panelId}-tab-${value}`;
}

/**
 * Figma frame `Menu Tab` (66:4755): the All / Revenue / Expenses tabs of 104 and 107. The selected tab has
 * the designed Active style, whichever it is (#19). An ARIA tablist with one tab stop: Left and Right
 * (wrapping), Home and End move the selection and activate the tab.
 */
export function MenuTab<T extends string>({ label, tabs, value, onChange, panelId }: MenuTabProps<T>) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = tabs.findIndex((tab) => tab.value === value);
  // The tab stop: the selected tab, or the first one if the value matches none.
  const focusIndex = Math.max(selectedIndex, 0);

  function select(index: number) {
    tabRefs.current[index]?.focus();
    if (index !== selectedIndex) onChange(tabs[index]!.value);
  }

  function onKeyDown(event: KeyboardEvent) {
    // Modified keys stay with the browser and assistive technology: Alt+Left is Back.
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const last = tabs.length - 1;
    const target = {
      ArrowRight: focusIndex === last ? 0 : focusIndex + 1,
      ArrowLeft: focusIndex === 0 ? last : focusIndex - 1,
      Home: 0,
      End: last,
    }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    select(target);
  }

  return (
    <div role="tablist" aria-label={label} className={styles.tablist} onKeyDown={onKeyDown}>
      {tabs.map((tab, index) => {
        const active = index === selectedIndex;
        return (
          <button
            key={tab.value}
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            type="button"
            role="tab"
            id={menuTabId(panelId, tab.value)}
            aria-selected={active}
            aria-controls={panelId}
            tabIndex={index === focusIndex ? 0 : -1}
            className={active ? `${styles.tab} ${styles.active}` : styles.tab}
            onClick={() => select(index)}
          >
            <span className={styles.label}>{tab.label}</span>
            {/* Keeps each tab as wide as its bold Active label, so the tabs do not shift when the selection moves. */}
            <span className={styles.reserve} aria-hidden="true">
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
