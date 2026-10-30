import styles from './AddAccountsButtonBig.module.css';

/**
 * Figma `Button Big` (410:5537), "Add Accounts" in the last Balances cell (105). Visual only (#22): drawn as designed,
 * but no button, no Tab stop, no pointer and nothing on a click. Its cell hides it from assistive technology.
 */
export function AddAccountsButtonBig() {
  return <span className={styles.button}>Add Accounts</span>;
}
