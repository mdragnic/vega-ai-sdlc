import {
  countryCallingCodes,
  type CountryCallingCode,
  type Profile,
  type ProfileUpdateRequest,
  profileUpdateRequestSchema,
} from '@finebank/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { z } from 'zod';

import { serverFieldErrors } from '../../api/client';
import { ButtonPrimary } from '../ButtonPrimary/ButtonPrimary';
import { FormError } from '../FormError/FormError';
import { FormSuccess } from '../FormSuccess/FormSuccess';
import { ProfilePhotoUpload } from '../ProfilePhotoUpload/ProfilePhotoUpload';
import { SettingsInput } from '../SettingsInput/SettingsInput';
import { SettingsPhoneInput } from '../SettingsPhoneInput/SettingsPhoneInput';
import styles from './ProfileForm.module.css';

/** The fields a failed request's `fieldErrors` can point to, in the form's order (#74). */
export const profileFieldNames = ['fullName', 'username', 'phoneCountryCode', 'phoneNumber'] as const;

type ProfileFormValues = z.input<typeof profileUpdateRequestSchema>;

const isListedCode = (code: string): code is CountryCallingCode =>
  countryCallingCodes.some((listed) => listed === code);

/**
 * A stored profile as the form's four values; the email is shown, never sent (#33). A stored code is always one of the
 * list (the API stores no other); were it not, the field would start on the default `+1` (#43).
 */
const valuesOf = ({ fullName, username, phoneCountryCode, phoneNumber }: Profile): ProfileFormValues => ({
  fullName,
  username,
  phoneCountryCode: isListedCode(phoneCountryCode) ? phoneCountryCode : countryCallingCodes[0],
  phoneNumber,
});

/** What a save tells the form back: the stored profile, a failure, and the end, either way. */
export type ProfileSaveHandlers = {
  onSuccess: (profile: Profile) => void;
  onError: (error: unknown) => void;
  onSettled: () => void;
};

type ProfileFormProps = {
  /** The profile as stored: the fields start from it, read once when the form mounts (a refetch keeps the typing). */
  profile: Profile;
  /**
   * "Save changes", or Enter in a text field, with a field changed and every field valid: the request as the shared
   * schema gives it, all four fields.
   */
  onSave: (request: ProfileUpdateRequest, handlers: ProfileSaveHandlers) => void;
  /** While the save runs: "Save changes" in its loading pattern, the text fields read-only, the code disabled. */
  saving: boolean;
  /** The message above the button for a failed save (#97 a), from `formErrorFor`. */
  formError?: string;
  /** "Profile updated" above the button (#52). */
  updated?: boolean;
  /** A field changed by the user: the page takes "Profile updated" away. */
  onFieldChange?: () => void;
};

/**
 * 111's Account tab form (Code-only): Full name, Email (read-only, #33), Username and Phone Number in the fields' column,
 * "Your Profile Picture" in the picture column (visual only until task 029), "Save changes" under the fields. A
 * react-hook-form form on the shared `profileUpdateRequestSchema` (#74, #126), as task 022's form: one submit at a time;
 * the rule's messages under their fields, focus on the first field with an error and nothing sent (#6, #95 a); the
 * server's field errors under their fields with focus on the first, other failures above the button with focus on it
 * (#97 a). "Save changes" is unavailable (aria-disabled, focus kept) until a field differs from the stored value, and
 * again once the values are back to it or a save stored them (#127); a save sends the four fields. After a save the
 * fields show the stored values and focus stays on the button.
 */
export function ProfileForm({ profile, onSave, saving, formError, updated = false, onFieldChange }: ProfileFormProps) {
  const {
    control,
    formState: { errors, isDirty },
    handleSubmit,
    register,
    reset,
    setError,
    setFocus,
  } = useForm<ProfileFormValues, unknown, ProfileUpdateRequest>({
    resolver: zodResolver(profileUpdateRequestSchema),
    defaultValues: valuesOf(profile),
  });
  // True from a submit until its save settles or the rules stop it, also before the next render shows the button busy.
  const submitting = useRef(false);
  const updateButton = useRef<HTMLButtonElement>(null);
  // A change the user makes (typing, a code chosen), not a reset to the stored values.
  const changed = { onChange: () => onFieldChange?.() };
  // Where focus goes after a failed save: the first field with the server's message, or the button. Moved once the form
  // shows it is no longer saving, as the country code is a disabled button until then and cannot take focus.
  const [focusAfterFailure, setFocusAfterFailure] = useState<{
    target: (typeof profileFieldNames)[number] | 'button';
  }>();
  // The request last moved: each failure sets a new one, moved once.
  const focusMoved = useRef<typeof focusAfterFailure>(undefined);
  useEffect(() => {
    if (saving || focusAfterFailure === undefined || focusMoved.current === focusAfterFailure) return;
    focusMoved.current = focusAfterFailure;
    if (focusAfterFailure.target === 'button') updateButton.current?.focus();
    else setFocus(focusAfterFailure.target);
  }, [saving, focusAfterFailure, setFocus]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Nothing changed: the button is unavailable, and Enter in a field submits nothing either (#127).
    if (submitting.current || saving || !isDirty) return;
    submitting.current = true;
    const done = () => {
      submitting.current = false;
    };
    void handleSubmit((request) => {
      onSave(request, {
        onSuccess: (saved) => {
          reset(valuesOf(saved));
          updateButton.current?.focus();
        },
        onError: (error) => {
          const fieldErrors = serverFieldErrors(error, profileFieldNames);
          for (const [name, message] of fieldErrors) setError(name, { type: 'server', message });
          setFocusAfterFailure({ target: fieldErrors[0]?.[0] ?? 'button' });
        },
        onSettled: done,
      });
    }, done)(event);
  };

  return (
    <form noValidate className={styles.form} onSubmit={submit}>
      <div className={styles.fields}>
        <SettingsInput
          label="Full name"
          autoComplete="name"
          busy={saving}
          error={errors.fullName?.message}
          {...register('fullName', changed)}
        />
        <SettingsInput label="Email" autoComplete="email" readOnly value={profile.email} />
        <SettingsInput
          label="Username"
          autoComplete="username"
          spellCheck={false}
          autoCapitalize="off"
          busy={saving}
          error={errors.username?.message}
          {...register('username', changed)}
        />
        <Controller
          control={control}
          name="phoneCountryCode"
          render={({ field }) => (
            <SettingsPhoneInput
              countryCode={field.value}
              onCountryCodeChange={(code) => {
                field.onChange(code);
                changed.onChange();
              }}
              autoComplete="tel-national"
              busy={saving}
              countryCodeError={errors.phoneCountryCode?.message}
              countryCodeRef={field.ref}
              numberError={errors.phoneNumber?.message}
              {...register('phoneNumber', changed)}
            />
          )}
        />
        <div className={styles.actions}>
          <FormError>{formError}</FormError>
          <FormSuccess>{updated ? 'Profile updated' : undefined}</FormSuccess>
          <div className={styles.button}>
            <ButtonPrimary ref={updateButton} type="submit" loading={saving} aria-disabled={!isDirty || undefined}>
              Save changes
            </ButtonPrimary>
          </div>
        </div>
      </div>
      <div className={styles.picture}>
        <ProfilePhotoUpload />
      </div>
    </form>
  );
}
