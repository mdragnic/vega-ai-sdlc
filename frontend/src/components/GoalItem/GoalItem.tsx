import { type CategoryLimit, categoryLabel, formatMoney, hyphenatedCategoryLabel } from '@finebank/shared';
import { VisuallyHidden } from 'radix-ui';
import { useId, useState } from 'react';

import { AdjustButton } from '../AdjustButton/AdjustButton';
import { CategoryIcon } from '../CategoryIcon/CategoryIcon';
import { CategoryLimitPopup } from '../CategoryLimitPopup/CategoryLimitPopup';
import styles from './GoalItem.module.css';

type GoalItemProps = {
  /** One category and the user's limit for it, as the backend sent it; `limit: null` without one (#32, #125 a). */
  item: CategoryLimit;
};

/** The popup's state: open or not, and how many times it opened, so each opening starts a fresh form (#35). */
type PopupState = { open: boolean; opened: number };

/**
 * Figma `Goal Item` (413:8749), the content of one 110 Expenses Goals by Category card: the category icon on its 40x48
 * Gray/06 tile; 16 after it the name (with soft hyphens, hidden from assistive technology, which reads the clean name as
 * the card's heading) over the limit, or "No limit set" in its place without one (#125 a); and at the right "Adjust"
 * (compact, described by the name), which opens popup 110.2 for that category and its limit (#31). Where the text and
 * "Adjust" do not fit side by side with 16 between them, "Adjust" moves under the text, right-aligned, 16 below; a name
 * or amount wider than the text column wraps inside it (#106, #108 b, #111 a, #115 b). It shows what it is sent: no
 * spending, no comparison and no warning (#32), no arithmetic (#11).
 */
export function GoalItem({ item }: GoalItemProps) {
  const { category, limit } = item;
  const nameId = useId();
  const [popup, setPopup] = useState<PopupState>({ open: false, opened: 0 });

  return (
    <div className={styles.item}>
      <CategoryIcon category={category} variant="goal" decorative />
      <div className={styles.body}>
        <div className={styles.text}>
          <p className={styles.name} aria-hidden="true">
            {hyphenatedCategoryLabel(category)}
          </p>
          <VisuallyHidden.Root asChild>
            <h3 id={nameId}>{categoryLabel(category)}</h3>
          </VisuallyHidden.Root>
          {limit === null ? (
            <p className={styles.noLimit}>No limit set</p>
          ) : (
            <p className={styles.amount}>{formatMoney(limit)}</p>
          )}
        </div>
        <div className={styles.adjust}>
          <AdjustButton
            label="Adjust"
            compact
            aria-describedby={nameId}
            onClick={() => setPopup(({ opened }) => ({ open: true, opened: opened + 1 }))}
          />
        </div>
      </div>
      <CategoryLimitPopup
        key={popup.opened}
        open={popup.open}
        onOpenChange={(open) => setPopup(({ opened }) => ({ open, opened }))}
        category={category}
        limit={limit}
      />
    </div>
  );
}
