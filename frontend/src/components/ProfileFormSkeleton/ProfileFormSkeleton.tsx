import formStyles from '../ProfileForm/ProfileForm.module.css';
import photoStyles from '../ProfilePhotoUpload/ProfilePhotoUpload.module.css';
import inputStyles from '../SettingsInput/SettingsInput.module.css';
import { Skeleton } from '../Skeleton/Skeleton';
import styles from './ProfileFormSkeleton.module.css';

/** The four fields' places, in the form's order. */
const FIELDS = ['fullName', 'email', 'username', 'phoneNumber'];

/**
 * The loading skeleton of the Account tab's form for `DataState` (#6). Not designed: the form's own grid and boxes, so
 * the card does not move when the profile arrives: in each field's place a line in the label's 24 line and one in the
 * 56 value box, 24 in; the picture column's label line and its box; a block in the place of "Save changes".
 * `DataState` hides it from assistive technology.
 */
export function ProfileFormSkeleton() {
  return (
    <div className={formStyles.form}>
      <div className={formStyles.fields}>
        {FIELDS.map((field) => (
          <div key={field} className={inputStyles.field}>
            <span className={`${inputStyles.label} ${styles.line}`}>
              <Skeleton shape="text" className={styles.label} />
            </span>
            <span className={inputStyles.control}>
              <Skeleton shape="text" className={styles.value} />
            </span>
          </div>
        ))}
        <div className={formStyles.actions}>
          <Skeleton shape="block" className={styles.button} />
        </div>
      </div>
      <div className={formStyles.picture}>
        <div className={photoStyles.photo}>
          <span className={`${photoStyles.label} ${styles.line}`}>
            <Skeleton shape="text" className={styles.label} />
          </span>
          <Skeleton shape="block" className={styles.box} />
        </div>
      </div>
    </div>
  );
}
