import { useForm } from 'react-hook-form';
import { Link } from 'react-router';

import { AuthLayout, ButtonPrimary, Input } from '../../components';
import { paths } from '../../routes/paths';
import styles from './ForgotPasswordPage.module.css';

/**
 * 103. Forgot Password (US-03): built as drawn, with no behavior yet (#16). "Password Reset" sends nothing and
 * shows nothing. The form is ready for a reset flow: it adds the shared `emailSchema` as the resolver, and the
 * request and its states in the submit handler; the markup stays.
 */
export function ForgotPasswordPage() {
  const { handleSubmit, register } = useForm({ defaultValues: { email: '' } });

  const submit = handleSubmit(() => {
    // No reset flow yet (#16).
  });

  return (
    <AuthLayout className={styles.column}>
      <h1 className={styles.heading}>Forgot Password?</h1>
      <p className={styles.text}>
        Enter your email address to get the
        <br />
        password reset link.
      </p>
      <form className={styles.form} noValidate onSubmit={(event) => void submit(event)}>
        <Input
          label="Email Address"
          type="email"
          placeholder="hello@example.com"
          autoComplete="email"
          {...register('email')}
        />
        <div className={styles.submit}>
          <ButtonPrimary type="submit">Password Reset</ButtonPrimary>
        </div>
      </form>
      <Link className={styles.back} to={paths.login}>
        Back to login
      </Link>
    </AuthLayout>
  );
}
