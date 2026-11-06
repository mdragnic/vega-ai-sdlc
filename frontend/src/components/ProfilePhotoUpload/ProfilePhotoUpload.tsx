import { type ChangeEvent, type Ref, useEffect, useId, useRef, useState } from 'react';

import { ImagePlus } from '../../assets/icons';
import { FieldError } from '../FieldError/FieldError';
import styles from './ProfilePhotoUpload.module.css';

type ProfilePhotoUploadProps = {
  /** The stored photo's address, or none (#38: the empty box). */
  storedUrl?: string;
  /** The chosen file, kept but not saved: shown as a preview from a local object URL (#128 a2). */
  chosen?: Blob;
  /** A refused choice's message, or the server's under `photo` (#6, #95 a). */
  error?: string;
  /** While the save runs: the box and "Clear" disabled, their look unchanged. */
  saving?: boolean;
  /** A file the picker returned; nothing is kept until the form's check passes. */
  onChoose: (file: File) => void;
  /** "Clear": the choice dropped; focus returns to the box. */
  onClear: () => void;
  /** The box's button, for focus (the form's error focus, "Clear"). */
  ref?: Ref<HTMLButtonElement>;
};

/**
 * 111's "Your Profile Picture" column (Code-only), a control from task 029 (US-18 criteria 6, 12, 13; #44 and #128 a): the
 * label and, 32 under it, the dashed upload box, a button named "Upload your photo" that opens the browser's file picker
 * (a hidden file input, never a Tab stop; its `accept` only the picker's filter, the shared rule decides). Without a
 * photo the box is drawn as 111: the image icon and "Upload your photo". With the stored photo, or a chosen file's
 * preview, the image covers the box inside its dashed border; while it loads the box is empty, and an image that fails
 * (or a kept file the browser cannot draw) shows the empty look. A chosen file's preview comes from a local object URL,
 * made once per file in one effect and revoked in its cleanup (on "Clear", a new choice, after a save and on leaving),
 * so no URL outlives its file. Under the box: "Not saved" and "Clear" while a file is chosen, and the error, announced
 * through a polite live region. Not designed (hover, focus, error, the preview and its line): tokens only.
 */
export function ProfilePhotoUpload({
  storedUrl,
  chosen,
  error,
  saving = false,
  onChoose,
  onClear,
  ref,
}: ProfilePhotoUploadProps) {
  const labelId = useId();
  const notSavedId = useId();
  const errorId = useId();
  const input = useRef<HTMLInputElement>(null);
  const preview = useRef<HTMLImageElement>(null);

  // The preview's object URL lives exactly as long as its file is chosen and shown: made for it, given to the preview
  // image, and revoked when the file changes or the box goes.
  useEffect(() => {
    const image = preview.current;
    if (!chosen || !image) return undefined;
    const url = URL.createObjectURL(chosen);
    image.src = url;
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [chosen]);

  // What failed to draw (the chosen file, or the stored photo's address) shows the empty look until it changes.
  const [failed, setFailed] = useState<Blob | string>();
  const shown = chosen ?? storedUrl;
  const drawsImage = shown !== undefined && shown !== failed;

  const choose = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset, so the same file can be chosen again; a cancelled picker (no file) keeps the earlier choice.
    event.target.value = '';
    if (file) onChoose(file);
  };

  const describedBy = [chosen ? notSavedId : undefined, error ? errorId : undefined].filter(Boolean).join(' ');

  return (
    <div className={styles.photo} role="group" aria-labelledby={labelId}>
      <p id={labelId} className={styles.label}>
        Your Profile Picture
      </p>
      <button
        ref={ref}
        type="button"
        className={`${styles.box} ${error ? styles.invalid : ''}`}
        aria-label="Upload your photo"
        aria-describedby={describedBy || undefined}
        aria-invalid={error ? true : undefined}
        disabled={saving}
        onClick={() => input.current?.click()}
      >
        {drawsImage && chosen ? (
          // Its src is the object URL, set by the effect above.
          <img key="preview" ref={preview} className={styles.image} alt="" onError={() => setFailed(chosen)} />
        ) : drawsImage && storedUrl ? (
          <img key="stored" className={styles.image} src={storedUrl} alt="" onError={() => setFailed(storedUrl)} />
        ) : (
          <>
            <ImagePlus className={styles.icon} aria-hidden="true" />
            <span className={styles.text} aria-hidden="true">
              Upload your <br />
              photo
            </span>
          </>
        )}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png"
        hidden
        tabIndex={-1}
        aria-hidden="true"
        onChange={choose}
      />
      <div className={styles.below}>
        {chosen && (
          <p className={styles.note}>
            <span id={notSavedId}>Not saved</span>
            <button
              type="button"
              className={styles.clear}
              aria-label="Clear the chosen photo"
              disabled={saving}
              onClick={onClear}
            >
              Clear
            </button>
          </p>
        )}
        <div aria-live="polite">{error && <FieldError id={errorId}>{error}</FieldError>}</div>
      </div>
    </div>
  );
}
