import { formatAmountInput, type SavingsGoal, savingsGoalFormSchema } from '@finebank/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { useSaveSavingsGoal } from '../../api/savings-goals';
import { GoalPopupInput } from '../GoalPopupInput/GoalPopupInput';
import { useGoalPopupSubmit } from '../GoalPopupInput/useGoalPopupSubmit';
import { PopupInputSmall } from '../PopupInputSmall/PopupInputSmall';

/** The fields a failed request's `fieldErrors` can point to in this popup (#74). */
const fieldNames = ['target', 'present'] as const;

type SavingsGoalPopupProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * The month the card shows, `YYYY-MM`, read once when the popup mounts: the save names it, and the backend saves any
   * month from the earliest the user can choose to the current one (#58 d, #123 b). A card that moves to the next month
   * behind the open popup does not move the save.
   */
  month: string;
  /** The goal the card shows, read once when the popup mounts as the fields' values, or `null` without one (#58). */
  goal: SavingsGoal | null;
  /**
   * The dialog's visually hidden title, its accessible name: "Edit savings goal" on Overview, "Adjust goal for Mar,
   * 2026" on Goals (task 025).
   */
  title: string;
};

/** The fields' texts: the goal's amounts as `$500000`, `$1250.50` (#31, #64); both empty without a goal (#58, #69). */
const fieldsFor = (goal: SavingsGoal | null) =>
  goal
    ? { target: formatAmountInput(goal.target.cents), present: formatAmountInput(goal.present.cents) }
    : { target: '', present: '' };

/**
 * 104.1 and 110.1 (Figma `Popup Input` 416:6381): the goal popup of Overview and Goals, Target Amounts and Present
 * Amounts, prefilled with the goal on the card (#18, #31). The shared form schema reads the texts and checks the amount
 * rules the API checks (#74, #84, #108 a). The submit and close logic is the goal popups' shared hook
 * (`useGoalPopupSubmit`, task 027): while saving, Save is disabled with its spinner and nothing else is sent; on success
 * the popup closes; on a failure the field errors show under their fields, or the message above Save (#6, #97 a), and
 * the typed values stay. X, Esc and the dimmed area discard the typing (#35). A save still running when the popup closes
 * is not cancelled: the card shows its answer (`useSaveSavingsGoal`). Mount one per opening (a new `key`), so the form
 * starts from the goal on the card.
 */
export function SavingsGoalPopup({ open, onOpenChange, month, goal, title }: SavingsGoalPopupProps) {
  // The month the prefilled values belong to: October's values are never saved as November's (#58, #123 b).
  const [openedMonth] = useState(month);
  const save = useSaveSavingsGoal();
  const form = useForm({ resolver: zodResolver(savingsGoalFormSchema), defaultValues: fieldsFor(goal) });
  const {
    formState: { errors },
    register,
  } = form;
  const popup = useGoalPopupSubmit({
    form,
    save,
    variables: (amounts) => ({ month: openedMonth, ...amounts }),
    fieldNames,
    onOpenChange,
  });

  return (
    <GoalPopupInput open={open} title={title} {...popup}>
      <PopupInputSmall label="Target Amounts" error={errors.target?.message} {...register('target')} />
      <PopupInputSmall
        label="Present Amounts"
        placeholder="Write present amount here"
        error={errors.present?.message}
        {...register('present')}
      />
    </GoalPopupInput>
  );
}
