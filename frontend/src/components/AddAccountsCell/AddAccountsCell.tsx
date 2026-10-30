import { AddAccountsButtonBig } from '../AddAccountsButtonBig/AddAccountsButtonBig';
import { Card } from '../Card/Card';
import styles from './AddAccountsCell.module.css';

/**
 * The last cell of the Balances grid (Figma frame `410:5516`, 105): a white card with `AddAccountsButtonBig` and
 * "Edit Accounts" under it, centred both ways. Visual only (#22): nothing in it does anything, so the whole cell is
 * hidden from assistive technology.
 */
export function AddAccountsCell() {
  return (
    <div className={styles.cell} aria-hidden="true">
      <Card className={styles.card}>
        <AddAccountsButtonBig />
        <span className={styles.editAccounts}>Edit Accounts</span>
      </Card>
    </div>
  );
}
