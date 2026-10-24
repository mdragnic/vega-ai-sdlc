import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppProviders } from '../../src/app/AppProviders';
import { routes } from '../../src/app/routes';

afterEach(() => {
  vi.restoreAllMocks();
});

async function renderDemo() {
  const router = createMemoryRouter(routes, { initialEntries: ['/dev/popup'] });
  render(<AppProviders router={router} />);
  // The route's lazy chunk is compiled on its first import, which takes longer while the whole suite runs.
  await screen.findByRole('button', { name: 'Open two-field popup' }, { timeout: 5000 });
  return userEvent.setup();
}

// While a popup is open, the page behind it is hidden from assistive technology (#35).
const result = () => screen.getByRole('status', { hidden: true });

// The /dev/popup page (Scope, T19): both popups over the real app shell. Vitest runs in development mode.
describe('popup demo page', () => {
  it('shows the app shell with the open buttons, without console errors', async () => {
    const consoleError = vi.spyOn(console, 'error');
    await renderDemo();

    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(screen.getByRole('banner')).toHaveTextContent('Hello Tanzir');
    expect(screen.getByRole('main')).toContainElement(screen.getByRole('button', { name: 'Open one-field popup' }));
    expect(consoleError).not.toHaveBeenCalled();
  });

  // 104.1: Target prefilled with formatAmountInput(50000000), Present empty with its placeholder.
  it('opens the two-field popup and shows the cents read on Save', async () => {
    const user = await renderDemo();

    await user.click(screen.getByRole('button', { name: 'Open two-field popup' }));
    const dialog = screen.getByRole('dialog');
    const target = within(dialog).getByRole('textbox', { name: 'Target Amounts' });
    const present = within(dialog).getByRole('textbox', { name: 'Present Amounts' });
    expect(target).toHaveValue('500000');
    expect(present).toHaveValue('');
    expect(present).toHaveAttribute('placeholder', 'Write present amount here');

    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(result()).toHaveTextContent('Target: 50000000 cents. Present: empty.');
  });

  // 110.2: the one-field popup.
  it('opens the one-field popup and shows the cents read on Save', async () => {
    const user = await renderDemo();

    await user.click(screen.getByRole('button', { name: 'Open one-field popup' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getAllByRole('textbox')).toHaveLength(1);
    const target = within(dialog).getByRole('textbox', { name: 'Target Amounts' });
    expect(target).toHaveValue('500000');

    await user.clear(target);
    await user.type(target, '1250.5{Enter}');

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(result()).toHaveTextContent('Target: 125050 cents.');
  });

  // "Save fails": Save shows the spinner while saving, then the server error; the popup stays open.
  it('shows saving and then the form error when Save fails', async () => {
    const user = await renderDemo();
    await user.click(screen.getByRole('checkbox', { name: 'Save fails' }));
    await user.click(screen.getByRole('button', { name: 'Open two-field popup' }));
    const dialog = screen.getByRole('dialog');

    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(within(dialog).getByRole('button', { name: 'Save' })).toHaveAttribute('aria-busy', 'true');
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('The amounts could not be saved. Try again.');
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeEnabled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(result()).toHaveTextContent('Nothing saved yet.');
  });

  // A popup closed while saving discards that save: a reopened one shows neither the spinner nor its error.
  it('forgets a failing save when the popup is closed while saving', async () => {
    const user = await renderDemo();
    await user.click(screen.getByRole('checkbox', { name: 'Save fails' }));
    await user.click(screen.getByRole('button', { name: 'Open two-field popup' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' }));

    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Open two-field popup' }));
    const save = within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' });
    expect(save).not.toHaveAttribute('aria-busy');

    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(save).toBeEnabled();
  });
});
