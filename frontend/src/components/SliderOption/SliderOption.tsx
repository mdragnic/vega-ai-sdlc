import { ChevronRight } from '../../assets/icons';
import styles from './SliderOption.module.css';

type SliderOptionProps = {
  /** How many accounts there are: one dot each (#17). */
  count: number;
  /** The shown account, from 0. */
  position: number;
  onPrevious: () => void;
  onNext: () => void;
};

/**
 * Figma frame `Slider option` (405:5480), under the Total Balance account card: "Previous", one dot per account
 * and "Next" (#17). Previous is disabled on the first account and Next on the last, both with one account:
 * `aria-disabled` with the click ignored, not the native `disabled`, so a button keeps keyboard focus when it
 * becomes disabled under it; muted as 104 draws Previous. The dots are visual only, the slide's name carries the
 * position.
 */
export function SliderOption({ count, position, onPrevious, onNext }: SliderOptionProps) {
  const atFirst = position <= 0;
  const atLast = position >= count - 1;

  return (
    <div className={styles.control}>
      <button
        type="button"
        className={[styles.button, atFirst && styles.disabled].filter(Boolean).join(' ')}
        aria-disabled={atFirst || undefined}
        onClick={() => {
          if (!atFirst) onPrevious();
        }}
      >
        <ChevronRight className={`${styles.chevron} ${styles.previous}`} aria-hidden="true" />
        Previous
      </button>
      <div className={styles.dots} aria-hidden="true">
        {Array.from({ length: count }, (_, index) => (
          <span key={index} className={[styles.dot, index === position && styles.active].filter(Boolean).join(' ')} />
        ))}
      </div>
      <button
        type="button"
        className={[styles.button, styles.next, atLast && styles.disabled].filter(Boolean).join(' ')}
        aria-disabled={atLast || undefined}
        onClick={() => {
          if (!atLast) onNext();
        }}
      >
        Next
        <ChevronRight className={styles.chevron} aria-hidden="true" />
      </button>
    </div>
  );
}
