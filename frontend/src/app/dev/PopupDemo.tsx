import { formatAmountInput, parseAmountInput } from '@finebank/shared';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';

import {
  AppLayout,
  ButtonSmall,
  Card,
  GoalPopupInput,
  Header,
  NavBar,
  PopupInputSmall,
  RemindMe,
  Section,
} from '../../components';
import { paths } from '../../routes/paths';
import styles from './PopupDemo.module.css';

type Amounts = { target: string; present: string };

// Logging out is task 011; here the button does nothing.
const noLogout = () => undefined;

const cents = (text: string) => {
  const value = parseAmountInput(text);
  return value === null ? 'empty' : `${value} cents`;
};

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type DemoPopupProps = {
  fields: 'two' | 'one';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saveFails: boolean;
  onSaved: (summary: string) => void;
};

/**
 * One popup with a react-hook-form form, as the screens will build it. The fields unregister when the content
 * unmounts on close, so a reopened popup shows the initial values again (#35).
 */
function DemoPopup({ fields, open, onOpenChange, saveFails, onSaved }: DemoPopupProps) {
  const { register, handleSubmit } = useForm<Amounts>({
    defaultValues: { target: formatAmountInput(50000000), present: '' },
    shouldUnregister: true,
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string>();
  // Counts the closes: a save still waiting when its popup closed is dropped.
  const closes = useRef(0);

  const save = async ({ target, present }: Amounts) => {
    setFormError(undefined);
    if (saveFails) {
      const close = closes.current;
      setSaving(true);
      await wait(800);
      if (close !== closes.current) return;
      setSaving(false);
      setFormError('The amounts could not be saved. Try again.');
      return;
    }
    onSaved(fields === 'two' ? `Target: ${cents(target)}. Present: ${cents(present)}.` : `Target: ${cents(target)}.`);
    onOpenChange(false);
  };

  return (
    <GoalPopupInput
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          closes.current += 1;
          setSaving(false);
          setFormError(undefined);
        }
        onOpenChange(next);
      }}
      title={fields === 'two' ? 'Goal amounts' : 'Category target'}
      onSubmit={(event) => void handleSubmit(save)(event)}
      saving={saving}
      formError={formError}
    >
      <PopupInputSmall label="Target Amounts" {...register('target')} />
      {fields === 'two' && (
        <PopupInputSmall label="Present Amounts" placeholder="Write present amount here" {...register('present')} />
      )}
    </GoalPopupInput>
  );
}

/** Screen content like 104, so the page scrolls behind the popup. */
function SampleCard({ title, tall = false }: { title: string; tall?: boolean }) {
  return (
    <Section title={title} gap="sm">
      <Card className={tall ? styles.tallCard : undefined}>
        <p className={styles.text}>Sample content behind the popup.</p>
      </Card>
    </Section>
  );
}

/**
 * Development-only page (/dev/popup): the goal popups over the real app shell, to check the overlay, the
 * blocked page and the fields (task 005). Save closes the popup and shows the cents read from each field.
 */
export function PopupDemo() {
  const [open, setOpen] = useState<'two' | 'one' | null>(null);
  const [saveFails, setSaveFails] = useState(false);
  const [saved, setSaved] = useState('Nothing saved yet.');

  return (
    <AppLayout
      navBar={<NavBar activeSection="overview" fullName="Tanzir Rahman" onLogout={noLogout} />}
      header={<Header greetingName="Tanzir" today="2023-05-19" />}
    >
      <div className={styles.row}>
        <Section title="Popup demo" gap="sm">
          <Card className={styles.controls}>
            <ButtonSmall onClick={() => setOpen('two')}>Open two-field popup</ButtonSmall>
            <ButtonSmall onClick={() => setOpen('one')}>Open one-field popup</ButtonSmall>
            <RemindMe label="Save fails" checked={saveFails} onCheckedChange={setSaveFails} />
            <p role="status" className={styles.text}>
              {saved}
            </p>
          </Card>
        </Section>
        <SampleCard title="Goals" />
        <Section title="Upcoming Bill" gap="sm" viewAllTo={paths.bills}>
          <Card>
            <p className={styles.text}>Sample content behind the popup.</p>
          </Card>
        </Section>
      </div>
      <div className={styles.row}>
        <SampleCard title="Recent Transaction" tall />
        <SampleCard title="Weekly Comparison" tall />
      </div>

      {(['two', 'one'] as const).map((fields) => (
        <DemoPopup
          key={fields}
          fields={fields}
          open={open === fields}
          onOpenChange={(next) => setOpen(next ? fields : null)}
          saveFails={saveFails}
          onSaved={setSaved}
        />
      ))}
    </AppLayout>
  );
}
