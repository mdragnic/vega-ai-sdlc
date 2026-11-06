import { ImagePlus } from '../../assets/icons';
import styles from './ProfilePhotoUpload.module.css';

/**
 * 111's "Your Profile Picture" column (Code-only): the label (Medium 16/24, Gray/01) and, 32 under it, the dashed upload
 * box with the image icon and "Upload your photo" on two lines, centred under the label. Empty, as no user has a photo
 * before task 029 (#38, #44), and visual only until then: no click, no file picker, not focusable, the default cursor,
 * hidden from assistive technology (`aria-hidden` and `inert`, the visual-only pattern of tasks 019 and 021).
 */
export function ProfilePhotoUpload() {
  return (
    <div className={styles.photo} aria-hidden="true" inert>
      <p className={styles.label}>Your Profile Picture</p>
      <div className={styles.box}>
        <ImagePlus className={styles.icon} />
        <p className={styles.text}>
          Upload your <br />
          photo
        </p>
      </div>
    </div>
  );
}
