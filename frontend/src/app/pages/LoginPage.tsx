import { authMessages, googleSignIn, loginRequestSchema, type LoginRequest } from '@finebank/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { formErrorFor, serverFieldErrors } from '../../api/client';
import { startGoogleSignIn } from '../../api/google';
import { useLogin } from '../../api/session';
import { googleUrl } from '../../assets/brand';
import { AuthLayout, ButtonPrimary, ButtonSecondary, FormError, Input, RemindMe, TextDivider } from '../../components';
import { paths } from '../../routes/paths';
import { RETURN_TO_PARAM, returnTarget } from '../../routes/return-to';
import styles from './LoginPage.module.css';

/** The fields a failed request's `fieldErrors` can point to on this screen (#74). */
const fieldNames = ['email', 'password'] as const;

/**
 * 101. Login (US-01): email and password against the task 007 API. The shared schema checks the fields and
 * gives their messages (#14, #74, #95). Wrong credentials and server errors show above the Login button (#97 a).
 * After login the return target opens, or Overview (#3). "Continue with Google" starts Google sign-in with the
 * same return target (#75); a failed one comes back here with a marker, and its message shows above the Login
 * button too (#81).
 */
export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const login = useLogin();
  const [googleFailed, setGoogleFailed] = useState(
    () => searchParams.get(googleSignIn.failureParam) === googleSignIn.failureValue,
  );

  // The marker goes from the URL at once, so a reload or Back does not show the message again; returnTo stays.
  useEffect(() => {
    if (!googleFailed) return;
    setSearchParams(
      (params) => {
        const next = new URLSearchParams(params);
        next.delete(googleSignIn.failureParam);
        return next;
      },
      { replace: true },
    );
  }, [googleFailed, setSearchParams]);

  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    setError,
  } = useForm({
    resolver: zodResolver(loginRequestSchema),
    defaultValues: { email: '', password: '', keepSignedIn: true },
  });

  const submit = handleSubmit((request: LoginRequest) => {
    login.mutate(request, {
      onSuccess: () => {
        void navigate(returnTarget(searchParams.get(RETURN_TO_PARAM)), { replace: true });
      },
      onError: (error) => {
        for (const [name, message] of serverFieldErrors(error, fieldNames)) setError(name, { type: 'server', message });
      },
    });
  });

  // Above the Login button: the last attempt's message, or else a failed Google sign-in's (#81, #97 a).
  const googleError = googleFailed ? authMessages.googleFailed : undefined;
  const formError = login.isError ? formErrorFor(login.error, fieldNames) : googleError;

  const continueWithGoogle = () => {
    const returnTo = searchParams.get(RETURN_TO_PARAM);
    if (returnTo === null) startGoogleSignIn();
    else startGoogleSignIn(returnTarget(returnTo));
  };

  return (
    <AuthLayout className={styles.column}>
      <form
        className={styles.form}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (login.isPending || login.isSuccess) return;
          // The message of the last attempt, or of a failed Google sign-in, stays until the next submit starts.
          login.reset();
          setGoogleFailed(false);
          void submit(event);
        }}
      >
        <div className={styles.fields}>
          <Input
            label="Email Address"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register('email')}
          />
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            labelAction={<Link to={paths.forgotPassword}>Forgot Password?</Link>}
            error={errors.password?.message}
            {...register('password')}
          />
        </div>
        <div className={styles.keepSignedIn}>
          <Controller
            control={control}
            name="keepSignedIn"
            render={({ field: { value, onChange, ...field } }) => (
              <RemindMe label="Keep me signed in" checked={value} onCheckedChange={onChange} {...field} />
            )}
          />
        </div>
        <div className={styles.submit}>
          <FormError>{formError}</FormError>
          <ButtonPrimary type="submit" loading={login.isPending || login.isSuccess}>
            Login
          </ButtonPrimary>
        </div>
      </form>
      <div className={styles.divider}>
        <TextDivider>or sign in with</TextDivider>
      </div>
      <div className={styles.google}>
        <ButtonSecondary icon={<img src={googleUrl} alt="" />} onClick={continueWithGoogle}>
          Continue with Google
        </ButtonSecondary>
      </div>
      <Link className={styles.createAccount} to={paths.signUp}>
        Create an account
      </Link>
    </AuthLayout>
  );
}
