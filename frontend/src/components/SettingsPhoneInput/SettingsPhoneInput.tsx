import { countryCallingCodes } from '@finebank/shared';
import { type ComponentPropsWithRef, useId } from 'react';

import { IconSeparator } from '../../assets/icons';
import { Dropdown } from '../Dropdown/Dropdown';
import { FieldError } from '../FieldError/FieldError';
import inputStyles from '../SettingsInput/SettingsInput.module.css';
import styles from './SettingsPhoneInput.module.css';

/** The country codes of #126 d in their order, each showing only the code (#43), found by its digits (`880`). */
const codeOptions = countryCallingCodes.map((code) => ({ value: code, label: code, textValue: code.slice(1) }));

type SettingsPhoneInputProps = Omit<ComponentPropsWithRef<'input'>, 'type' | 'className' | 'readOnly'> & {
  /** The chosen country code, one of `countryCallingCodes`. */
  countryCode: string;
  onCountryCodeChange: (code: string) => void;
  /** While the form saves: the number read-only and the code's list closed, their look unchanged (#6). */
  busy?: boolean;
  /** The country code's message: only a direct request can send a code outside the list. */
  countryCodeError?: string;
  /** The country code's trigger, so the form can focus it when its message shows (react-hook-form's `field.ref`). */
  countryCodeRef?: (trigger: HTMLButtonElement | null) => void;
  /** The number's message (#126 c). */
  numberError?: string;
};

/**
 * 111's Phone Number field (Code-only, on `SettingsInput`'s look): the label naming a group of the country code, the
 * shared `Dropdown` `inline` named "Country code" (the code alone, in the field's font and color, #43, #60), the
 * `IconSeparator`, and the number, a text input named by the label, numeric keyboard on touch devices, all in one box
 * with the app's bordered Input look (#127 a): its border, darker while either control has focus or the list is open,
 * red while either has an error. Each message under the box. The number's ref, `name`, `onChange` and `onBlur` go to
 * the native input (react-hook-form).
 */
export function SettingsPhoneInput({
  countryCode,
  onCountryCodeChange,
  busy = false,
  countryCodeError,
  countryCodeRef,
  numberError,
  id,
  ...number
}: SettingsPhoneInputProps) {
  const generatedId = useId();
  const numberId = id ?? generatedId;
  const labelId = `${numberId}-label`;
  const codeErrorId = `${numberId}-code-error`;
  const numberErrorId = `${numberId}-error`;

  return (
    <div role="group" aria-labelledby={labelId} className={inputStyles.field}>
      <label id={labelId} className={inputStyles.label} htmlFor={numberId}>
        Phone Number
      </label>
      <div
        className={[
          inputStyles.control,
          inputStyles.bordered,
          styles.row,
          (countryCodeError || numberError) && inputStyles.invalid,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <Dropdown
          variant="inline"
          aria-label="Country code"
          options={codeOptions}
          value={countryCode}
          onValueChange={onCountryCodeChange}
          disabled={busy}
          triggerRef={countryCodeRef}
          aria-describedby={countryCodeError ? codeErrorId : undefined}
          aria-invalid={countryCodeError ? true : undefined}
        />
        <IconSeparator className={styles.separator} aria-hidden="true" />
        <input
          {...number}
          id={numberId}
          type="text"
          inputMode="numeric"
          readOnly={busy}
          className={inputStyles.input}
          aria-invalid={numberError ? true : number['aria-invalid']}
          aria-describedby={numberError ? numberErrorId : undefined}
        />
      </div>
      {countryCodeError && <FieldError id={codeErrorId}>{countryCodeError}</FieldError>}
      {numberError && <FieldError id={numberErrorId}>{numberError}</FieldError>}
    </div>
  );
}
