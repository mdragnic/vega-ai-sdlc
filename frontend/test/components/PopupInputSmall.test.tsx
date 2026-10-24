import { formatAmountInput } from '@finebank/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ChangeEvent } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';

import { PopupInputSmall } from '../../src/components';

const follows = (a: Node, b: Node) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

/** The `$` shown before the number (#64): hidden from assistive technology, the field's text is the number. */
function dollarSign(field: HTMLElement): HTMLElement {
  const sign = screen.getByText('$');
  expect(sign).toHaveAttribute('aria-hidden', 'true');
  expect(follows(sign, field)).toBe(true);
  return sign;
}

describe('PopupInputSmall', () => {
  // T6: the prefilled value shows with the `$` directly before it, no separators (AC6, #64).
  it.each([
    [50000000, '500000'],
    [125050, '1250.50'],
  ])('shows %i cents prefilled as $ then %s', (cents, text) => {
    render(<PopupInputSmall label="Target Amounts" defaultValue={formatAmountInput(cents)} />);

    const field = screen.getByRole('textbox', { name: 'Target Amounts' });
    expect(field).toHaveValue(text);
    dollarSign(field);
  });

  // Cents are numbers and the field text is not: a number given as the value would show 100 times the amount,
  // so it does not compile, and the form has to go through formatAmountInput (#11, #84).
  it('takes its value and default value only as text', () => {
    // @ts-expect-error Cents go through formatAmountInput first.
    const { unmount } = render(<PopupInputSmall label="Target Amounts" defaultValue={50000000} />);
    unmount();
    // @ts-expect-error Cents go through formatAmountInput first.
    render(<PopupInputSmall label="Target Amounts" value={50000000} readOnly />);

    expect(screen.getByRole('textbox', { name: 'Target Amounts' })).toHaveValue('50000000');
  });

  // T6: an empty field keeps the `$`; with a placeholder, the placeholder is given to the field (AC7, #69, #71).
  // Whether the `$` shows next to the placeholder is CSS (:placeholder-shown), checked in e2e (T7).
  it('keeps the $ for an empty field and passes the placeholder on', () => {
    const { rerender } = render(<PopupInputSmall label="Target Amounts" />);
    const field = screen.getByRole('textbox', { name: 'Target Amounts' });
    expect(field).toHaveValue('');
    expect(field).not.toHaveAttribute('placeholder');
    dollarSign(field);

    rerender(<PopupInputSmall label="Target Amounts" placeholder="Write present amount here" />);
    expect(screen.getByRole('textbox', { name: 'Target Amounts' })).toHaveAttribute(
      'placeholder',
      'Write present amount here',
    );
  });

  it('focuses the field when the $ is clicked', async () => {
    const user = userEvent.setup();
    render(<PopupInputSmall label="Target Amounts" defaultValue="500000" />);
    const field = screen.getByRole('textbox', { name: 'Target Amounts' });

    await user.click(dollarSign(field));

    expect(field).toHaveFocus();
  });

  it('is a decimal text field', () => {
    render(<PopupInputSmall label="Target Amounts" />);

    const field = screen.getByRole('textbox', { name: 'Target Amounts' });
    expect(field).toHaveAttribute('type', 'text');
    expect(field).toHaveAttribute('inputmode', 'decimal');
  });

  // T8: digits and one point with at most 2 decimals stand, a lone point too (AC8, #64, #84).
  it.each(['1250.5', '.5', '.', '1250.50', '0'])('lets %s stand', async (text) => {
    const user = userEvent.setup();
    render(<PopupInputSmall label="Target Amounts" />);
    const field = screen.getByRole('textbox', { name: 'Target Amounts' });

    await user.type(field, text);

    expect(field).toHaveValue(text);
  });

  // T8: a rejected key changes neither the value nor the caret (AC8).
  it.each([
    ['a comma', '12', 1, ','],
    ['a $', '12', 0, '$'],
    ['a letter', '12', 1, 'a'],
    ['a space', '12', 1, ' '],
    ['a minus', '12', 0, '-'],
    ['a second point', '1.2', 1, '.'],
    ['a third decimal at the end', '1.25', 4, '5'],
    ['a third decimal between the decimals', '1.25', 3, '9'],
  ])('rejects %s', async (_, before, caret, key) => {
    const user = userEvent.setup();
    const onChange = vi.fn<(event: ChangeEvent<HTMLInputElement>) => void>();
    render(<PopupInputSmall label="Target Amounts" defaultValue={before} onChange={onChange} />);
    const field = screen.getByRole<HTMLInputElement>('textbox', { name: 'Target Amounts' });

    await user.type(field, key, { initialSelectionStart: caret, initialSelectionEnd: caret });

    expect(field).toHaveValue(before);
    expect(field.selectionStart).toBe(caret);
    expect(field.selectionEnd).toBe(caret);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('lets a key replace a selection when the result is allowed', async () => {
    const user = userEvent.setup();
    render(<PopupInputSmall label="Target Amounts" defaultValue="1.25" />);
    const field = screen.getByRole('textbox', { name: 'Target Amounts' });

    await user.type(field, '9', { initialSelectionStart: 2, initialSelectionEnd: 4 });

    expect(field).toHaveValue('1.9');
  });

  // T8: a paste is accepted or rejected as a whole (AC8, #64). A line break inside the text is one the browser
  // would paste as a space, so it is rejected too.
  it.each(['1,000', '12.345', '$5', '-3', '5\n00'])('rejects the paste of %j as a whole', async (text) => {
    const user = userEvent.setup();
    render(<PopupInputSmall label="Target Amounts" defaultValue="12" />);
    const field = screen.getByRole<HTMLInputElement>('textbox', { name: 'Target Amounts' });
    await user.click(field);

    await user.paste(text);

    expect(field).toHaveValue('12');
    expect(field.selectionStart).toBe(2);
  });

  it('accepts an allowed paste', async () => {
    const user = userEvent.setup();
    render(<PopupInputSmall label="Target Amounts" defaultValue="12" />);
    const field = screen.getByRole('textbox', { name: 'Target Amounts' });
    await user.click(field);

    await user.paste('.5');

    expect(field).toHaveValue('12.5');
  });

  // A spreadsheet cell is copied with a trailing line break (`\r\n` on Windows); the browser drops it on paste.
  it.each(['500\r\n', '500\n'])('accepts the paste of a spreadsheet cell %j', async (text) => {
    const user = userEvent.setup();
    render(<PopupInputSmall label="Target Amounts" />);
    const field = screen.getByRole('textbox', { name: 'Target Amounts' });
    await user.click(field);

    await user.paste(text);

    expect(field).toHaveValue('500');
  });

  // IME composition text cannot be cancelled before it lands: a change to text that is not allowed is undone.
  it('undoes a change that got past the key check, without telling the form', () => {
    const onChange = vi.fn<(event: ChangeEvent<HTMLInputElement>) => void>();
    render(<PopupInputSmall label="Target Amounts" defaultValue="12" onChange={onChange} />);
    const field = screen.getByRole('textbox', { name: 'Target Amounts' });

    fireEvent.change(field, { target: { value: '12５' } });

    expect(field).toHaveValue('12');
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.change(field, { target: { value: '125' } });

    expect(field).toHaveValue('125');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('lets text be deleted', async () => {
    const user = userEvent.setup();
    render(<PopupInputSmall label="Target Amounts" defaultValue="12.5" />);
    const field = screen.getByRole('textbox', { name: 'Target Amounts' });

    await user.type(field, '{Backspace}{Backspace}{Backspace}{Backspace}');

    expect(field).toHaveValue('');
  });

  // T10: the error look and its links (AC10, #6, #87).
  it('links the error message and marks the field invalid', () => {
    const { rerender } = render(<PopupInputSmall label="Target Amounts" />);
    const field = screen.getByRole('textbox', { name: 'Target Amounts' });
    expect(field).not.toHaveAttribute('aria-invalid');
    expect(field).not.toHaveAttribute('aria-describedby');

    rerender(<PopupInputSmall label="Target Amounts" error="Enter a target amount" />);

    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription('Enter a target amount');
    const message = screen.getByText('Enter a target amount');
    expect(follows(field, message)).toBe(true);
  });

  it('gives each field its own id', () => {
    render(
      <>
        <PopupInputSmall label="Target Amounts" error="First" />
        <PopupInputSmall label="Present Amounts" error="Second" />
      </>,
    );

    expect(screen.getByRole('textbox', { name: 'Target Amounts' })).toHaveAccessibleDescription('First');
    expect(screen.getByRole('textbox', { name: 'Present Amounts' })).toHaveAccessibleDescription('Second');
  });

  // T10: react-hook-form `register` reads the typed text, prefilled from defaultValues (AC10).
  it('works with react-hook-form register', async () => {
    const user = userEvent.setup();
    const onValid = vi.fn<(values: { target: string }) => void>();
    function Form() {
      const { register, handleSubmit } = useForm({ defaultValues: { target: '500000' } });
      return (
        <form onSubmit={handleSubmit(onValid)}>
          <PopupInputSmall label="Target Amounts" {...register('target')} />
          <button type="submit">Save</button>
        </form>
      );
    }
    render(<Form />);
    const field = screen.getByRole('textbox', { name: 'Target Amounts' });
    expect(field).toHaveValue('500000');

    await user.clear(field);
    await user.type(field, '12,5.75');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onValid).toHaveBeenCalledTimes(1);
    expect(onValid.mock.calls[0]![0]).toEqual({ target: '125.75' });
  });

  it('works with react-hook-form Controller', async () => {
    const user = userEvent.setup();
    const onValid = vi.fn<(values: { present: string }) => void>();
    function Form() {
      const { control, handleSubmit } = useForm({ defaultValues: { present: '' } });
      return (
        <form onSubmit={handleSubmit(onValid)}>
          <Controller
            name="present"
            control={control}
            render={({ field }) => (
              <PopupInputSmall label="Present Amounts" placeholder="Write present amount here" {...field} />
            )}
          />
          <button type="submit">Save</button>
        </form>
      );
    }
    render(<Form />);
    const field = screen.getByRole('textbox', { name: 'Present Amounts' });

    await user.type(field, 'a.5x');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(field).toHaveValue('.5');
    expect(onValid.mock.calls[0]![0]).toEqual({ present: '.5' });
  });
});
