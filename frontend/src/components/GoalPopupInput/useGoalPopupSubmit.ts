import type { UseMutationResult } from '@tanstack/react-query';
import { type FormEvent, useRef } from 'react';
import type { FieldValues, Path, UseFormReturn } from 'react-hook-form';

import { formErrorFor, serverFieldErrors } from '../../api/client';

type GoalPopupSubmit<Fields extends FieldValues, Values, Variables> = {
  /** The popup's react-hook-form form. */
  form: Pick<UseFormReturn<Fields, unknown, Values>, 'handleSubmit' | 'setError'>;
  /** The save: a mutation from `useUserWrite`. */
  save: Pick<UseMutationResult<unknown, Error, Variables>, 'mutate' | 'reset' | 'isPending' | 'isError' | 'error'>;
  /** The request the form's values make: the popup adds what it opened with (a month, a category). */
  variables: (values: Values) => Variables;
  /** The fields a failed request's `fieldErrors` can point to (#74). */
  fieldNames: readonly Path<Fields>[];
  onOpenChange: (open: boolean) => void;
};

/**
 * The submit and close logic of the goal popups, 104.1, 110.1 and 110.2 (`SavingsGoalPopup`, `CategoryLimitPopup`): one
 * save at a time, also before the next render shows Save busy, and nothing sent while a rule is broken (#6); the last
 * attempt's message cleared when the next starts; the server's field errors under their fields, any other failure above
 * Save (#97 a); close on success; the save reset on close, so its typed amounts leave the mutation cache. Returns
 * `GoalPopupInput`'s props for it.
 */
export function useGoalPopupSubmit<Fields extends FieldValues, Values, Variables>({
  form,
  save,
  variables,
  fieldNames,
  onOpenChange,
}: GoalPopupSubmit<Fields, Values, Variables>) {
  // True from a submit until its save settles or the form stops it.
  const submitting = useRef(false);

  const close = () => {
    save.reset();
    onOpenChange(false);
  };

  // Save or Enter in a field.
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (submitting.current) return;
    submitting.current = true;
    // The last attempt's message stays until the next one starts.
    save.reset();
    const done = () => {
      submitting.current = false;
    };
    void form.handleSubmit((values) => {
      save.mutate(variables(values), {
        onSuccess: close,
        onError: (error) => {
          for (const [name, message] of serverFieldErrors(error, fieldNames)) {
            form.setError(name, { type: 'server', message });
          }
        },
        onSettled: done,
      });
    }, done)(event);
  };

  return {
    onOpenChange: (next: boolean) => (next ? onOpenChange(true) : close()),
    onSubmit,
    saving: save.isPending,
    formError: save.isError ? formErrorFor(save.error, fieldNames) : undefined,
  };
}
