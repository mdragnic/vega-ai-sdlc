import type { FormEvent, ReactNode } from 'react';

import { ButtonPrimary } from '../ButtonPrimary/ButtonPrimary';
import { FormError } from '../FormError/FormError';
import { Popup } from '../Popup/Popup';
import styles from './GoalPopupInput.module.css';

type GoalPopupInputProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Names the dialog; visually hidden. */
  title: string;
  /** Save or Enter in a field. The browser's own submit is prevented first, so `handleSubmit` from react-hook-form fits. */
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  /** Save disabled with its spinner (#6). */
  saving?: boolean;
  /** The server error above Save (#6). */
  formError?: string;
  /** The `PopupInputSmall` fields: two in 104.1 and 110.1, one in 110.2. */
  children: ReactNode;
};

/**
 * Figma `Popup Input` (416:6381): the goal popup of 104.1, 110.1 and 110.2, a `Popup` holding a form with
 * the amount fields and Save. Presentational: the screens own the form rules and the saving.
 * A reopened popup must show the initial values (#35). The fields unmount on close, but a react-hook-form
 * `useForm` above the popup keeps the edited values unless it has `shouldUnregister: true` (as `/dev/popup`
 * does) or is reset on open.
 */
export function GoalPopupInput({
  open,
  onOpenChange,
  title,
  onSubmit,
  saving = false,
  formError,
  children,
}: GoalPopupInputProps) {
  return (
    <Popup open={open} onOpenChange={onOpenChange} title={title}>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(event);
        }}
      >
        <div className={styles.fields}>{children}</div>
        <div className={styles.actions}>
          <FormError>{formError}</FormError>
          <div className={styles.save}>
            <ButtonPrimary type="submit" loading={saving}>
              Save
            </ButtonPrimary>
          </div>
        </div>
      </form>
    </Popup>
  );
}
