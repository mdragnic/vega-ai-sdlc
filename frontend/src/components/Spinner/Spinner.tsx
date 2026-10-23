import styles from './Spinner.module.css';

/**
 * The loading indicator inside buttons (#6). Not designed: a three-quarter ring in the text color
 * (currentColor), so it needs no new color. Decorative; the button carries `aria-busy`.
 */
export function Spinner() {
  return (
    <svg className={styles.spinner} viewBox="0 0 24 24" fill="none" aria-hidden="true" data-testid="spinner">
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="42 57"
      />
    </svg>
  );
}
