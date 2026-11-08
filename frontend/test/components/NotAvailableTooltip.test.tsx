import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { describe, expect, it } from 'vitest';

import { NotAvailableTooltip } from '../../src/components';

/** A disabled control in the tooltip, between two plain buttons, under StrictMode as the app runs. */
function renderTooltip() {
  render(
    <StrictMode>
      <button type="button">Before</button>
      <NotAvailableTooltip>
        <button type="button" aria-disabled="true">
          Edit Accounts
        </button>
      </NotAvailableTooltip>
      <button type="button">After</button>
    </StrictMode>,
  );
  return { user: userEvent.setup(), control: screen.getByRole('button', { name: 'Edit Accounts' }) };
}

const tooltip = () => screen.queryByRole('tooltip');

// T10: task 032 AC11 and AC9. "Not available" on hover and keyboard focus, as an element on the page, and as the
// control's description at all times (#133, WCAG 1.4.13).
describe('NotAvailableTooltip', () => {
  it('describes the control as "Not available" at all times, with no title and nothing shown', () => {
    const { control } = renderTooltip();

    expect(control).toHaveAccessibleDescription('Not available');
    expect(control).not.toHaveAttribute('title');
    expect(tooltip()).toBeNull();
    expect(screen.queryByText('Not available')).not.toBeVisible();
  });

  it('shows "Not available" on hover and hides it when the pointer leaves', async () => {
    const { user, control } = renderTooltip();

    await user.hover(control);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Not available');
    expect(control).toHaveAccessibleDescription('Not available');

    // jsdom lays nothing out: every box is at 0,0, where Radix's grace area between the control and the text lies, so
    // the pointer leaves for a point away from it (the e2e tests leave on a real layout).
    await user.unhover(control);
    await user.pointer({ target: document.body, coords: { clientX: 400, clientY: 400 } });
    await waitFor(() => expect(tooltip()).toBeNull());
  });

  it('shows it on keyboard focus and hides it on blur', async () => {
    const { user, control } = renderTooltip();

    await user.tab();
    await user.tab();
    expect(control).toHaveFocus();
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Not available');

    await user.tab();
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
    await waitFor(() => expect(tooltip()).toBeNull());
  });

  it('hides it on Escape, focus kept on the control, and shows it again on the next focus', async () => {
    const { user, control } = renderTooltip();
    await user.tab();
    await user.tab();
    await screen.findByRole('tooltip');

    await user.keyboard('{Escape}');

    await waitFor(() => expect(tooltip()).toBeNull());
    expect(control).toHaveFocus();
    await user.tab({ shift: true });
    await user.tab();
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Not available');
  });

  it('hides it on Escape while hovered', async () => {
    const { user, control } = renderTooltip();
    await user.hover(control);
    await screen.findByRole('tooltip');

    await user.keyboard('{Escape}');

    await waitFor(() => expect(tooltip()).toBeNull());
  });

  // Task 032 code review: a description the control already has is kept, before "Not available", shown or not.
  it('keeps a description the control already has, before "Not available"', async () => {
    const user = userEvent.setup();
    render(
      <StrictMode>
        <p id="card">Checking AB Bank Ltd</p>
        <NotAvailableTooltip>
          <button type="button" aria-disabled="true" aria-describedby="card">
            Remove
          </button>
        </NotAvailableTooltip>
      </StrictMode>,
    );
    const control = screen.getByRole('button', { name: 'Remove' });
    expect(control).toHaveAccessibleDescription('Checking AB Bank Ltd Not available');

    await user.hover(control);
    await screen.findByRole('tooltip');

    expect(control).toHaveAccessibleDescription('Checking AB Bank Ltd Not available');
  });

  it('keeps it on a click: the control does nothing, so the pointer is still on it', async () => {
    const { user, control } = renderTooltip();
    await user.hover(control);
    await screen.findByRole('tooltip');

    await user.click(control);

    expect(control).toHaveFocus();
    expect(tooltip()).toHaveTextContent('Not available');
  });
});
