import formStyles from '../ProfileForm/ProfileForm.module.css';
import skeletonStyles from '../ProfileFormSkeleton/ProfileFormSkeleton.module.css';
import inputStyles from '../SettingsInput/SettingsInput.module.css';
import { Skeleton } from '../Skeleton/Skeleton';

/** The four fields' places, in the form's order: the three passwords and the phone. */
const FIELDS = ['currentPassword', 'newPassword', 'retypePassword', 'phoneNumber'];

/**
 * The loading skeleton of the Security tab's form for `DataState` (#6, task 030). Not designed: the form's own grid and
 * boxes (`PasswordForm` on the Account tab's grid) and the Account skeleton's placeholders, so the card does not move
 * when a user with a password arrives: in each field's place a line in the label's 24 line and one in the 56 value box,
 * 24 in; a block in the place of "Update Password", 40 under the last field as the button. `DataState` hides it from
 * assistive technology.
 */
export function PasswordFormSkeleton() {
  return (
    <div className={formStyles.form}>
      <div className={formStyles.fields}>
        {FIELDS.map((field) => (
          <div key={field} className={inputStyles.field}>
            <span className={`${inputStyles.label} ${skeletonStyles.line}`}>
              <Skeleton shape="text" className={skeletonStyles.label} />
            </span>
            <span className={inputStyles.control}>
              <Skeleton shape="text" className={skeletonStyles.value} />
            </span>
          </div>
        ))}
      </div>
      <div className={formStyles.actions}>
        <Skeleton shape="block" className={skeletonStyles.button} />
      </div>
    </div>
  );
}
