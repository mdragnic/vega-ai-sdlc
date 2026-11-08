import { ButtonPrimary } from '../ButtonPrimary/ButtonPrimary';
import { NotAvailableTooltip } from '../NotAvailableTooltip/NotAvailableTooltip';
import styles from './AddAccountsButtonBig.module.css';

/**
 * Figma `Button Big` (410:5537), "Add Accounts" in the last Balances cell (105). It does nothing (#22), so it is shown
 * disabled (#133): `ButtonPrimary` with `aria-disabled`, its Active=No look in the designed 208x48, a Tab stop that
 * keeps focus and cancels its clicks, described as "Not available" by `NotAvailableTooltip`.
 */
export function AddAccountsButtonBig() {
  return (
    <div className={styles.button}>
      <NotAvailableTooltip>
        <ButtonPrimary aria-disabled>Add Accounts</ButtonPrimary>
      </NotAvailableTooltip>
    </div>
  );
}
