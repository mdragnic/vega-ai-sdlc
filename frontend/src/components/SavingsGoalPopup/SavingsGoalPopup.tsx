import { formatAmountInput, type SavingsGoal, savingsGoalFormSchema } from '@finebank/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { type FormEvent, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';

import { formErrorFor, serverFieldErrors } from '../../api/client';
import { useSaveSavingsGoal } from '../../api/savings-goals';
import { GoalPopupInput } from '../GoalPopupInput/GoalPopupInput';
import { PopupInputSmall } from '../PopupInputSmall/PopupInputSmall';

/** The fields a failed request's `fieldErrors` can point to in this popup (#74). */
const fieldNames = ['target', 'present'] as const;

type SavingsGoalPopupProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * The month the card shows, `YYYY-MM`, read once when the popup mounts: the save names it, and the backend saves
   * only the current one (#108 d). A card that moves to the next month behind the open popup does not move the save.
   */
  month: string;
  /** The goal the card shows, read once when the popup mounts as the fields' values, or `null` without one (#58). */
  goal: SavingsGoal | null;
};

/** The fields' texts: the goal's amounts as `$500000`, `$1250.50` (#31, #64); both empty without a goal (#58, #69). */
const fieldsFor = (goal: SavingsGoal | null) =>
  goal
    ? { target: formatAmountInput(goal.target.cents), present: formatAmountInput(goal.present.cents) }
    : { target: '', present: '' };

/**
 * 104.1 (Figma `Popup Input` 416:6381): the Overview goal popup, Target Amounts and Present Amounts, prefilled with
 * the goal on the card (#18, #31). The shared form schema reads the texts and checks the amount rules the API checks
 * (#74, #84, #108 a). While saving, Save is disabled with its spinner and nothing else is sent; on success the popup
 * closes; on a failure the field errors show under their fields, or the message above Save (#6, #97 a), and the
 * typed values stay. X, Esc and the dimmed area discard the typing (#35). A save still running when the popup closes
 * is not cancelled: the card shows its answer (`useSaveSavingsGoal`). Mount one per opening (a new `key`), so the form
 * starts from the goal on the card.
 */
export function SavingsGoalPopup({ open, onOpenChange, month, goal }: SavingsGoalPopupProps) {
  // The month the prefilled values belong to: October's values are never saved as November's (#58, #108 d).
  const [openedMonth] = useState(month);
  const save = useSaveSavingsGoal();
  const {
    formState: { errors },
    handleSubmit,
    register,
    setError,
  } = useForm({ resolver: zodResolver(savingsGoalFormSchema), defaultValues: fieldsFor(goal) });
  // True from a submit until its save settles or the form stops it, also before the next render shows Save busy.
  const submitting = useRef(false);

  // The save's amounts leave the mutation cache with the popup.
  const close = () => {
    save.reset();
    onOpenChange(false);
  };

  // Save or Enter in a field: one save at a time, and nothing is sent while a rule is broken (#6).
  const submit = (event: FormEvent<HTMLFormElement>) => {
    if (submitting.current) return;
    submitting.current = true;
    // The last attempt's message stays until the next one starts.
    save.reset();
    const done = () => {
      submitting.current = false;
    };
    void handleSubmit((amounts) => {
      save.mutate(
        { month: openedMonth, ...amounts },
        {
          onSuccess: close,
          onError: (error) => {
            for (const [name, message] of serverFieldErrors(error, fieldNames)) {
              setError(name, { type: 'server', message });
            }
          },
          onSettled: done,
        },
      );
    }, done)(event);
  };

  return (
    <GoalPopupInput
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
      title="Edit savings goal"
      onSubmit={submit}
      saving={save.isPending}
      formError={save.isError ? formErrorFor(save.error, fieldNames) : undefined}
    >
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
