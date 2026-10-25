import { loginRequestSchema, type LoginRequest } from '@finebank/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { formErrorFor, serverFieldErrors } from '../../api/client';
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
 * After login the return target opens, or Overview (#3).
 */
export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const login = useLogin();
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

  const formError = login.isError ? formErrorFor(login.error, fieldNames) : undefined;

  return (
    <AuthLayout className={styles.column}>
      <form
        className={styles.form}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (login.isPending || login.isSuccess) return;
          // The message of the last attempt stays until the next submit starts.
          login.reset();
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
      {/* Visual only until Google sign-in (task 012). */}
      <div className={styles.google}>
        <ButtonSecondary icon={<img src={googleUrl} alt="" />}>Continue with Google</ButtonSecondary>
      </div>
      <Link className={styles.createAccount} to={paths.signUp}>
        Create an account
      </Link>
    </AuthLayout>
  );
}
