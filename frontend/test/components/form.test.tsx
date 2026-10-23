import { zodResolver } from '@hookform/resolvers/zod';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Controller, useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { ButtonPrimary, Input, RemindMe } from '../../src/components';

// A test-only schema: the real auth rules belong to tasks 009 and 010.
const schema = z.object({
  email: z.email({ error: 'Enter a valid email' }),
  password: z.string().min(1, { error: 'Password is required' }),
  remember: z.boolean(),
});
type Values = z.infer<typeof schema>;

function TestForm({ onValid }: { onValid: (values: Values) => void }) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '', remember: true } });

  return (
    <form noValidate onSubmit={handleSubmit(onValid)}>
      <Input label="Email Address" type="email" {...register('email')} error={errors.email?.message} />
      <Input label="Password" type="password" {...register('password')} error={errors.password?.message} />
      <Controller
        name="remember"
        control={control}
        render={({ field }) => (
          <RemindMe
            label="Keep me signed in"
            name={field.name}
            checked={field.value}
            onCheckedChange={field.onChange}
            onBlur={field.onBlur}
            ref={field.ref}
          />
        )}
      />
      <ButtonPrimary type="submit">Login</ButtonPrimary>
    </form>
  );
}

// T6: Input and RemindMe work with react-hook-form and a Zod resolver (AC5).
describe('react-hook-form with the form controls', () => {
  it('shows field errors and does not submit when the fields are invalid', async () => {
    const user = userEvent.setup();
    const onValid = vi.fn<(values: Values) => void>();
    render(<TestForm onValid={onValid} />);

    await user.click(screen.getByRole('button', { name: 'Login' }));

    expect(await screen.findByText('Enter a valid email')).toBeInTheDocument();
    expect(screen.getByLabelText('Email Address')).toHaveAccessibleDescription('Enter a valid email');
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('Password is required');
    expect(onValid).not.toHaveBeenCalled();
  });

  it('submits the typed values and the checkbox value', async () => {
    const user = userEvent.setup();
    const onValid = vi.fn<(values: Values) => void>();
    render(<TestForm onValid={onValid} />);

    await user.type(screen.getByLabelText('Email Address'), 'john@example.com');
    await user.type(screen.getByLabelText('Password'), 'secret12');
    await user.click(screen.getByRole('checkbox', { name: 'Keep me signed in' }));
    await user.click(screen.getByRole('button', { name: 'Login' }));

    await vi.waitFor(() => expect(onValid).toHaveBeenCalledTimes(1));
    expect(onValid.mock.calls[0]![0]).toEqual({ email: 'john@example.com', password: 'secret12', remember: false });
    expect(screen.queryByText('Enter a valid email')).not.toBeInTheDocument();
  });
});
