import disabledTextButton from '../../styles/disabledTextButton.module.css';
import { AddAccountsButtonBig } from '../AddAccountsButtonBig/AddAccountsButtonBig';
import { Card } from '../Card/Card';
import { NotAvailableTooltip } from '../NotAvailableTooltip/NotAvailableTooltip';
import styles from './AddAccountsCell.module.css';

/**
 * The last cell of the Balances grid (Figma frame `410:5516`, 105): a white card with `AddAccountsButtonBig` and
 * "Edit Accounts" under it, centred both ways. Neither does anything (#22), so both are buttons shown disabled and
 * described as "Not available" (#133); "Edit Accounts" keeps its designed gray text.
 */
export function AddAccountsCell() {
  return (
    <div className={styles.cell}>
      <Card className={styles.card}>
        <AddAccountsButtonBig />
        {/* Under it: above, the text would cover "Add Accounts". */}
        <NotAvailableTooltip side="bottom">
          <button type="button" aria-disabled="true" className={`${disabledTextButton.button} ${styles.editAccounts}`}>
            Edit Accounts
          </button>
        </NotAvailableTooltip>
      </Card>
    </div>
  );
}
