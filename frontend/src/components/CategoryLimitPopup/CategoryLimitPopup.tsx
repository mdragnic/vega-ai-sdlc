import {
  categoryLabel,
  categoryLimitFormSchema,
  type ExpenseCategory,
  formatAmountInput,
  type Money,
} from '@finebank/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { useSaveCategoryLimit } from '../../api/category-limits';
import { GoalPopupInput } from '../GoalPopupInput/GoalPopupInput';
import { useGoalPopupSubmit } from '../GoalPopupInput/useGoalPopupSubmit';
import { PopupInputSmall } from '../PopupInputSmall/PopupInputSmall';

/** The field a failed request's `fieldErrors` can point to in this popup (#74). */
const fieldNames = ['limit'] as const;

type CategoryLimitPopupProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The category of the card that opened it, read once when the popup mounts: the save names it. */
  category: ExpenseCategory;
  /** The limit the card shows, read once when the popup mounts as the field's value, or `null` without one (#125). */
  limit: Money | null;
};

/**
 * 110.2 (Figma `Popup Input` with one `Popup Input (small)`): a category's spending limit, one value for every month
 * (#32). The one-field `GoalPopupInput`, named "Adjust limit for <category>", with "Target Amounts" prefilled with the
 * card's limit (`$250`, #31, #64), or empty without one: the `$` alone, no placeholder, Target required (#69, #90 b,
 * #125 b). The shared form schema reads the text through the Target rule the API checks (#74, #84, #108 a); the submit
 * and close logic is the goal popups' (`useGoalPopupSubmit`): Save disabled with its spinner while saving, one request,
 * field errors under the field, other failures above Save (#6, #97 a), close on success. X, Esc and the dimmed area
 * discard the typing (#35). Mount one per opening (a new `key`), so the form starts from the card's limit.
 */
export function CategoryLimitPopup({ open, onOpenChange, category, limit }: CategoryLimitPopupProps) {
  // The category the prefilled value belongs to.
  const [openedCategory] = useState(category);
  const save = useSaveCategoryLimit();
  const form = useForm({
    resolver: zodResolver(categoryLimitFormSchema),
    defaultValues: { limit: limit === null ? '' : formatAmountInput(limit.cents) },
  });
  const {
    formState: { errors },
    register,
  } = form;
  const popup = useGoalPopupSubmit({
    form,
    save,
    variables: (values) => ({ category: openedCategory, ...values }),
    fieldNames,
    onOpenChange,
  });

  return (
    <GoalPopupInput open={open} title={`Adjust limit for ${categoryLabel(openedCategory)}`} {...popup}>
      <PopupInputSmall label="Target Amounts" error={errors.limit?.message} {...register('limit')} />
    </GoalPopupInput>
  );
}
