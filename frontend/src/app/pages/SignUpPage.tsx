import { signUpRequestSchema, type SignUpRequest } from '@finebank/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';

import { ApiError, formErrorFor, serverFieldErrors } from '../../api/client';
import { startGoogleSignIn } from '../../api/google';
import { useSignUp } from '../../api/session';
import { googleUrl } from '../../assets/brand';
import { AuthLayout, ButtonPrimary, ButtonSecondary, FormError, Input, TextDivider } from '../../components';
import { paths } from '../../routes/paths';
import styles from './SignUpPage.module.css';

/** The fields a failed request's `fieldErrors` can point to on this screen (#74). */
const fieldNames = ['fullName', 'email', 'password'] as const;

/**
 * 102. Sign up (US-02): name, email and password against the task 007 API. The shared schema checks the fields
 * and gives their messages (#15, #74, #95). An email already registered shows its message under Email (#15);
 * other server errors show above the Sign up button (#97 a). The new account opens Overview (#3). "Continue with
 * Google" starts Google sign-in with no return target, so Overview opens after it too (#75, US-02 criterion 9).
 */
export function SignUpPage() {
  const navigate = useNavigate();
  const signUp = useSignUp();
  const {
    formState: { errors },
    handleSubmit,
    register,
    setError,
  } = useForm({
    resolver: zodResolver(signUpRequestSchema),
    defaultValues: { fullName: '', email: '', password: '' },
  });

  const submit = handleSubmit((request: SignUpRequest) => {
    signUp.mutate(request, {
      onSuccess: () => {
        void navigate(paths.overview, { replace: true });
      },
      onError: (error) => {
        // An email already registered (409): focus goes to Email, the field with the error, so a screen reader
        // reads its message (task 010 gate). A 400's field errors leave focus on Sign up, as on Login.
        const focusField = error instanceof ApiError && error.status === 409;
        serverFieldErrors(error, fieldNames).forEach(([name, message], index) => {
          setError(name, { type: 'server', message }, { shouldFocus: focusField && index === 0 });
        });
      },
    });
  });

  const formError = signUp.isError ? formErrorFor(signUp.error, fieldNames) : undefined;

  return (
    <AuthLayout className={styles.column}>
      <h1 className={styles.heading}>Create an account</h1>
      <form
        className={styles.form}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (signUp.isPending || signUp.isSuccess) return;
          // The message of the last attempt stays until the next submit starts.
          signUp.reset();
          void submit(event);
        }}
      >
        <div className={styles.fields}>
          <Input label="Name" autoComplete="name" error={errors.fullName?.message} {...register('fullName')} />
          <Input
            label="Email Address"
            type="email"
            placeholder="hello@example.com"
            autoComplete="email"
            error={errors.email?.message}
            {...register('email')}
          />
          <Input
            label="Password"
            type="password"
            autoComplete="new-password"
            error={errors.password?.message}
            {...register('password')}
          />
        </div>
        {/* "terms of service." is visual only (#15): plain text, not a link and not focusable. */}
        <p className={styles.terms}>
          By continuing, you agree to our <span className={styles.termsLink}>terms of service.</span>
        </p>
        <div className={styles.submit}>
          <FormError>{formError}</FormError>
          <ButtonPrimary type="submit" loading={signUp.isPending || signUp.isSuccess}>
            Sign up
          </ButtonPrimary>
        </div>
      </form>
      <div className={styles.divider}>
        <TextDivider>or sign up with</TextDivider>
      </div>
      <div className={styles.google}>
        <ButtonSecondary icon={<img src={googleUrl} alt="" />} onClick={() => startGoogleSignIn()}>
          Continue with Google
        </ButtonSecondary>
      </div>
      <p className={styles.signIn}>
        Already have an account?{' '}
        <Link className={styles.signInLink} to={paths.login}>
          Sign in here
        </Link>
      </p>
    </AuthLayout>
  );
}
