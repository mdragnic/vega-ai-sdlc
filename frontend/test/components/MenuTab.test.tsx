import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { MenuTab } from '../../src/components';
import { menuTabId } from '../../src/components/MenuTab/MenuTab';

type Direction = 'all' | 'income' | 'expense';

// The widgets map the labels to the transaction direction (#19).
const tabs = [
  { value: 'all', label: 'All' },
  { value: 'income', label: 'Revenue' },
  { value: 'expense', label: 'Expenses' },
] as const;

/** A widget that keeps the selection, as the screens will. */
function Widget({ onChange, initial = 'all' }: { onChange: (value: Direction) => void; initial?: Direction }) {
  const [value, setValue] = useState<Direction>(initial);
  return (
    <>
      <button type="button">Before</button>
      <MenuTab
        label="Recent Transaction"
        tabs={tabs}
        value={value}
        panelId="recent-panel"
        onChange={(next) => {
          onChange(next);
          setValue(next);
        }}
      />
      <div role="tabpanel" id="recent-panel" aria-labelledby={menuTabId('recent-panel', value)}>
        Showing {value}
      </div>
      <button type="button">After</button>
    </>
  );
}

const selected = () => screen.getAllByRole('tab').filter((each) => each.getAttribute('aria-selected') === 'true');
// Tabs by accessible name: each tab also holds an aria-hidden copy of its label, which keeps its width.
const tab = (name: string) => screen.getByRole('tab', { name });

// T5: an ARIA tablist with one selected tab (AC6).
describe('MenuTab', () => {
  it('renders a named tablist of 3 tabs with only the selected one selected and in the tab order', () => {
    const { rerender } = render(
      <MenuTab label="Recent Transaction" tabs={tabs} value="all" panelId="panel" onChange={() => undefined} />,
    );

    expect(screen.getByRole('tablist', { name: 'Recent Transaction' })).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toEqual([tab('All'), tab('Revenue'), tab('Expenses')]);
    expect(selected()).toEqual([screen.getByRole('tab', { name: 'All' })]);
    expect(screen.getAllByRole('tab').map((each) => each.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
    for (const each of screen.getAllByRole('tab')) expect(each).toHaveAttribute('aria-controls', 'panel');

    rerender(
      <MenuTab label="Recent Transaction" tabs={tabs} value="income" panelId="panel" onChange={() => undefined} />,
    );

    expect(selected()).toEqual([screen.getByRole('tab', { name: 'Revenue' })]);
    expect(screen.getAllByRole('tab').map((each) => each.getAttribute('tabindex'))).toEqual(['-1', '0', '-1']);
  });

  it('gives each tab the id the panel is labelled by', () => {
    render(<Widget onChange={() => undefined} initial="expense" />);

    expect(screen.getByRole('tabpanel', { name: 'Expenses' })).toHaveTextContent('Showing expense');
    expect(new Set(screen.getAllByRole('tab').map((each) => each.id)).size).toBe(3);
  });

  // T6: clicks and the keyboard (AC7).
  it('calls onChange once when an inactive tab is clicked, and not for the selected tab', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn<(value: Direction) => void>();
    render(<Widget onChange={onChange} />);

    await user.click(screen.getByRole('tab', { name: 'Revenue' }));
    await user.click(screen.getByRole('tab', { name: 'Revenue' }));

    expect(onChange.mock.calls).toEqual([['income']]);
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Showing income');
  });

  it('is one tab stop: Tab enters on the selected tab and the next Tab leaves the tablist', async () => {
    const user = userEvent.setup();
    render(<Widget onChange={() => undefined} initial="income" />);

    await user.click(screen.getByRole('button', { name: 'Before' }));
    await user.tab();
    expect(screen.getByRole('tab', { name: 'Revenue' })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('tab', { name: 'Revenue' })).not.toHaveFocus();
    expect(screen.queryAllByRole('tab').some((each) => each === document.activeElement)).toBe(false);
  });

  it('moves and activates the selection with Left and Right (wrapping), Home and End', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn<(value: Direction) => void>();
    render(<Widget onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: 'Before' }));
    await user.tab();

    const after: HTMLElement[] = [];
    for (const key of ['{ArrowRight}', '{ArrowRight}', '{ArrowRight}', '{Home}', '{End}', '{ArrowLeft}']) {
      await user.keyboard(key);
      const [current] = selected();
      expect(current).toHaveFocus();
      after.push(current!);
    }

    expect(after).toEqual([tab('Revenue'), tab('Expenses'), tab('All'), tab('All'), tab('Expenses'), tab('Revenue')]);
    // Home on the first tab does not move the selection, so it calls nothing.
    expect(onChange.mock.calls).toEqual([['income'], ['expense'], ['all'], ['expense'], ['income']]);
  });

  it('wraps from the first tab to the last with Left', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn<(value: Direction) => void>();
    render(<Widget onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: 'Before' }));
    await user.tab();

    await user.keyboard('{ArrowLeft}');

    expect(onChange.mock.calls).toEqual([['expense']]);
    expect(screen.getByRole('tab', { name: 'Expenses' })).toHaveFocus();
  });

  // Alt+Left is the browser's Back; modified keys belong to the browser and assistive technology.
  it.each([
    '{Alt>}{ArrowLeft}{/Alt}',
    '{Shift>}{ArrowRight}{/Shift}',
    '{Control>}{End}{/Control}',
    '{Meta>}{Home}{/Meta}',
  ])('leaves %s to the browser', async (keys) => {
    const user = userEvent.setup();
    const onChange = vi.fn<(value: Direction) => void>();
    render(<Widget onChange={onChange} initial="income" />);
    await user.click(screen.getByRole('button', { name: 'Before' }));
    await user.tab();
    const defaultPrevented: boolean[] = [];
    const tablist = screen.getByRole('tablist');
    tablist.addEventListener('keydown', (event) => defaultPrevented.push(event.defaultPrevented));

    await user.keyboard(keys);

    expect(onChange).not.toHaveBeenCalled();
    expect(tab('Revenue')).toHaveFocus();
    expect(defaultPrevented.every((prevented) => !prevented)).toBe(true);
  });

  // A value that matches no tab is a caller error; the tablist still has one tab stop and the arrows work.
  it('keeps the first tab in the tab order when the value matches no tab', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn<(value: Direction) => void>();
    render(<MenuTab label="Recent Transaction" tabs={tabs.slice(1)} value="all" panelId="panel" onChange={onChange} />);

    expect(screen.getAllByRole('tab').map((each) => each.getAttribute('tabindex'))).toEqual(['0', '-1']);
    await user.tab();
    await user.keyboard('{ArrowLeft}');

    expect(onChange.mock.calls).toEqual([['expense']]);
  });
});
