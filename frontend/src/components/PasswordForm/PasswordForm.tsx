import { type PasswordChangeRequest, passwordChangeFormSchema } from '@finebank/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { serverFieldErrors } from '../../api/client';
import { ButtonPrimary } from '../ButtonPrimary/ButtonPrimary';
import { FormError } from '../FormError/FormError';
import { FormSuccess } from '../FormSuccess/FormSuccess';
import formStyles from '../ProfileForm/ProfileForm.module.css';
import { SettingsInput } from '../SettingsInput/SettingsInput';
import { SettingsPhoneInput } from '../SettingsPhoneInput/SettingsPhoneInput';

/** The fields a failed request's `fieldErrors` can point to, in the form's Tab order (#74). */
export const passwordFieldNames = ['currentPassword', 'newPassword'] as const;

type PasswordFormValues = z.input<typeof passwordChangeFormSchema>;
type PasswordFormOutput = z.output<typeof passwordChangeFormSchema>;

/** A password form's stored values: none is shown, so all three start empty (#127 b). */
const emptyValues: PasswordFormValues = { currentPassword: '', newPassword: '', retypePassword: '' };

/** What a save tells the form back: success, a failure, and the end, either way. */
export type PasswordSaveHandlers = {
  onSuccess: () => void;
  onError: (error: unknown) => void;
  onSettled: () => void;
};

type PasswordFormProps = {
  /** The stored phone, shown read-only between the passwords and the button (#33, #34). */
  phoneCountryCode: string;
  phoneNumber: string;
  /** "Update Password", or Enter in a field, with a field typed and every rule met: the request, no retype. */
  onSave: (request: PasswordChangeRequest, handlers: PasswordSaveHandlers) => void;
  /** While the change runs: "Update Password" in its loading pattern, the fields read-only. */
  saving: boolean;
  /** The message above the button for a failed change (#97 a), from `formErrorFor`. */
  formError?: string;
  /** "Password updated" above the button (#34). */
  updated?: boolean;
  /** A field changed by the user: the page takes "Password updated" away. */
  onFieldChange?: () => void;
};

/**
 * 112's Security tab form (Code-only): Old Password, New Password and Retype Password, masked with no eye (#129 c), the
 * Phone Number read-only (#34), then "Update Password" with its messages above it, on the Account tab's grid (111's
 * fields column), so the fields keep 111's and 112's proportions. A react-hook-form form on the shared
 * `passwordChangeFormSchema` (#74), as the Account tab's: one submit at a time; each rule's one message under its field,
 * focus on the first field with an error and nothing sent (#6, #95 a); the server's field errors under their fields
 * (the wrong current password under Old Password, #34) with focus on the first, other failures above the button with
 * focus on it (#97 a). "Update Password" is unavailable (aria-disabled, focus kept) while the three fields are empty,
 * the stored values of a password form (#127 b). After a success the fields are cleared and focus stays on the button.
 */
export function PasswordForm({
  phoneCountryCode,
  phoneNumber,
  onSave,
  saving,
  formError,
  updated = false,
  onFieldChange,
}: PasswordFormProps) {
  const {
    formState: { errors, isDirty },
    handleSubmit,
    register,
    reset,
    setError,
    setFocus,
  } = useForm<PasswordFormValues, unknown, PasswordFormOutput>({
    resolver: zodResolver(passwordChangeFormSchema),
    defaultValues: emptyValues,
  });
  // True from a submit until its save settles or the rules stop it, also before the next render shows the button busy.
  const submitting = useRef(false);
  const updateButton = useRef<HTMLButtonElement>(null);
  // A change the user makes, not a reset to the empty values.
  const changed = { onChange: () => onFieldChange?.() };
  // Where focus goes after a failed save: the first field with the server's message, or the button. Moved once the form
  // shows it is no longer saving (the fields are read-only and the button busy until then).
  const [focusAfterFailure, setFocusAfterFailure] = useState<{
    target: (typeof passwordFieldNames)[number] | 'button';
  }>();
  const focusMoved = useRef<typeof focusAfterFailure>(undefined);
  useEffect(() => {
    if (saving || focusAfterFailure === undefined || focusMoved.current === focusAfterFailure) return;
    focusMoved.current = focusAfterFailure;
    if (focusAfterFailure.target === 'button') updateButton.current?.focus();
    else setFocus(focusAfterFailure.target);
  }, [saving, focusAfterFailure, setFocus]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Nothing typed: the button is unavailable, and Enter in a field submits nothing either (#127 b).
    if (submitting.current || saving || !isDirty) return;
    submitting.current = true;
    const done = () => {
      submitting.current = false;
    };
    void handleSubmit(({ currentPassword, newPassword }) => {
      onSave(
        { currentPassword, newPassword },
        {
          onSuccess: () => {
            reset(emptyValues);
            updateButton.current?.focus();
          },
          onError: (error) => {
            const fieldErrors = serverFieldErrors(error, passwordFieldNames);
            for (const [name, message] of fieldErrors) setError(name, { type: 'server', message });
            setFocusAfterFailure({ target: fieldErrors[0]?.[0] ?? 'button' });
          },
          onSettled: done,
        },
      );
    }, done)(event);
  };

  return (
    <form noValidate className={formStyles.form} onSubmit={submit}>
      <div className={formStyles.fields}>
        <SettingsInput
          label="Old Password"
          type="password"
          autoComplete="current-password"
          busy={saving}
          error={errors.currentPassword?.message}
          // New Password's "different" message depends on this field: checked again with it (after the first submit,
          // as every rule here).
          {...register('currentPassword', { ...changed, deps: ['newPassword'] })}
        />
        <SettingsInput
          label="New Password"
          type="password"
          autoComplete="new-password"
          busy={saving}
          error={errors.newPassword?.message}
          // Retype Password's match depends on this field: checked again with it.
          {...register('newPassword', { ...changed, deps: ['retypePassword'] })}
        />
        <SettingsInput
          label="Retype Password"
          type="password"
          autoComplete="new-password"
          busy={saving}
          error={errors.retypePassword?.message}
          {...register('retypePassword', changed)}
        />
        <SettingsPhoneInput readOnly countryCode={phoneCountryCode} value={phoneNumber} />
      </div>
      <div className={formStyles.actions}>
        <FormError>{formError}</FormError>
        <FormSuccess>{updated ? 'Password updated' : undefined}</FormSuccess>
        <div className={formStyles.button}>
          <ButtonPrimary ref={updateButton} type="submit" loading={saving} aria-disabled={!isDirty || undefined}>
            Update Password
          </ButtonPrimary>
        </div>
      </div>
    </form>
  );
}
