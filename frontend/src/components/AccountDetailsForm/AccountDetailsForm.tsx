import {
  type AccountDetailsRequest,
  accountDetailsRequestSchema,
  type AccountDetailsResponse,
  accountTypeLabel,
  accountTypeSchema,
  formatMoney,
} from '@finebank/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { type FormEvent, type KeyboardEvent, useId, useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { serverFieldErrors } from '../../api/client';
import cardStyles from '../AccountDetailsCard/AccountDetailsCard.module.css';
import { ButtonPrimary } from '../ButtonPrimary/ButtonPrimary';
import { ButtonSecondary } from '../ButtonSecondary/ButtonSecondary';
import { Dropdown } from '../Dropdown/Dropdown';
import { FieldError } from '../FieldError/FieldError';
import { FormError } from '../FormError/FormError';
import { Input } from '../Input/Input';
import styles from './AccountDetailsForm.module.css';

/** The fields a failed request's `fieldErrors` can point to in this form (#74). */
const fieldNames = ['bankName', 'branchName', 'accountType'] as const;

/** The five types of #26, in their order, with their labels. */
const accountTypeOptions = accountTypeSchema.options.map((type) => ({ value: type, label: accountTypeLabel(type) }));

/** What a save tells the form back: a failure, for the server's field errors, and the end, either way. */
export type AccountDetailsSaveHandlers = { onError: (error: unknown) => void; onSettled: () => void };

type AccountDetailsFormProps = {
  /**
   * The account as the page shows it: the fields start from its Bank Name, Branch Name and type, read once when the form
   * mounts (a refetch while editing keeps the typing); the read-only Balance and Account Number follow it.
   */
  account: AccountDetailsResponse;
  /** Save, or Enter in a text field, with every field valid: the request as the shared schema gives it, names trimmed. */
  onSave: (request: AccountDetailsRequest, handlers: AccountDetailsSaveHandlers) => void;
  /** While the save runs: Save in its loading pattern, the fields read-only, the select disabled, Cancel and Escape off. */
  saving: boolean;
  /** The message above the buttons for a failed save (#97 a), from `formErrorFor`. */
  formError?: string;
  /** Cancel, or Escape in the form with the list closed: the page discards the typing. */
  onCancel: () => void;
  /** Focus in Bank Name when the form mounts, as edit mode opens (#26). The page decides; the gallery leaves it off. */
  autoFocus?: boolean;
};

/**
 * 106 edit mode (#26), not designed (Code-only): the Account Details card's content as a form, on view mode's insets and
 * three columns. Bank Name and Branch Name are `Input`s and Account Type the `Dropdown` `input` variant under a visible
 * label, each in its column less the 32 kept free at its end; Balance and Account Number stay read-only as in view mode;
 * Save and Cancel take "Edit Details"' place and "Remove" stays visual only (#23). A react-hook-form form on the shared
 * `accountDetailsRequestSchema` (#74), as task 014's popup: one submit at a time; the rule's messages under their fields
 * with the red border, focus on the first field with an error and nothing sent (#6, #87 b, #95 a, #120 b); the server's
 * field errors under their fields, other failures above the buttons, focus on Save (#97 a). With `autoFocus` it opens
 * with focus in Bank Name. The page owns the save and the focus after it.
 */
export function AccountDetailsForm({
  account,
  onSave,
  saving,
  formError,
  onCancel,
  autoFocus = false,
}: AccountDetailsFormProps) {
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    setError,
  } = useForm({
    resolver: zodResolver(accountDetailsRequestSchema),
    defaultValues: { bankName: account.bankName, branchName: account.branchName, accountType: account.accountType },
  });
  // True from a submit until its save settles or the form stops it, also before the next render shows Save busy.
  const submitting = useRef(false);
  const saveButton = useRef<HTMLButtonElement>(null);
  const accountTypeId = useId();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current || saving) return;
    submitting.current = true;
    const done = () => {
      submitting.current = false;
    };
    void handleSubmit((request) => {
      onSave(request, {
        onError: (error) => {
          for (const [name, message] of serverFieldErrors(error, fieldNames)) {
            setError(name, { type: 'server', message });
          }
          saveButton.current?.focus();
        },
        onSettled: done,
      });
    }, done)(event);
  };

  const cancel = () => {
    if (!saving) onCancel();
  };

  // Escape anywhere in the form discards; with the list open, Radix closes only the list (its keys come from the
  // list's portal, outside this element, and Radix has already handled them).
  const discardOnEscape = (event: KeyboardEvent<HTMLFormElement>) => {
    // An Escape that ends an IME composition belongs to the composition, not to the form.
    if (event.key !== 'Escape' || event.defaultPrevented || event.nativeEvent.isComposing) return;
    if (!(event.target instanceof Node) || !event.currentTarget.contains(event.target)) return;
    event.preventDefault();
    cancel();
  };

  return (
    <form noValidate className={cardStyles.content} onSubmit={submit} onKeyDown={discardOnEscape}>
      <div className={`${cardStyles.values} ${styles.values}`}>
        <div className={cardStyles.value}>
          <Input
            label="Bank Name"
            autoFocus={autoFocus}
            readOnly={saving}
            error={errors.bankName?.message}
            {...register('bankName')}
          />
        </div>
        <div className={cardStyles.value}>
          <label className={styles.label} htmlFor={accountTypeId}>
            Account Type
          </label>
          <Controller
            control={control}
            name="accountType"
            render={({ field }) => (
              <Dropdown
                id={accountTypeId}
                variant="input"
                options={accountTypeOptions}
                value={field.value}
                onValueChange={field.onChange}
                disabled={saving}
              />
            )}
          />
          {errors.accountType && <FieldError>{errors.accountType.message}</FieldError>}
        </div>
        <dl className={`${cardStyles.value} ${styles.readOnly}`}>
          <dt className={cardStyles.label}>Balance</dt>
          <dd className={cardStyles.oneLine}>{formatMoney(account.balance)}</dd>
        </dl>
        <div className={cardStyles.value}>
          <Input label="Branch Name" readOnly={saving} error={errors.branchName?.message} {...register('branchName')} />
        </div>
        <dl className={`${cardStyles.value} ${styles.readOnly}`}>
          <dt className={cardStyles.label}>Account Number</dt>
          <dd className={cardStyles.oneLine}>{account.maskedNumber}</dd>
        </dl>
      </div>
      <div className={styles.actions}>
        <FormError>{formError}</FormError>
        <div className={styles.buttons}>
          <div className={styles.button}>
            <ButtonPrimary ref={saveButton} type="submit" loading={saving}>
              Save
            </ButtonPrimary>
          </div>
          <div className={styles.button}>
            <ButtonSecondary aria-disabled={saving || undefined} onClick={cancel}>
              Cancel
            </ButtonSecondary>
          </div>
          {/* Visual only (#23), as in view mode. */}
          <span className={`${cardStyles.remove} ${styles.remove}`} aria-hidden="true" inert>
            Remove
          </span>
        </div>
      </div>
    </form>
  );
}
