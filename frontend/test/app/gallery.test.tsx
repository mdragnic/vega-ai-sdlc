import { axisTicks, formatCompactMoney } from '@finebank/shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppProviders } from '../../src/app/AppProviders';
import { routes } from '../../src/app/routes';
import * as components from '../../src/components';

afterEach(() => {
  vi.restoreAllMocks();
});

async function renderGallery() {
  const router = createMemoryRouter(routes, { initialEntries: ['/dev/components'] });
  render(<AppProviders router={router} />);
  return screen.findByRole('heading', { level: 1, name: 'Component gallery' });
}

const figure = (region: string, name: string) =>
  within(screen.getByRole('region', { name: region })).getByRole('figure', { name });

const amountField = (name: string) => within(figure('PopupInputSmall', name)).getByRole('textbox');
const chartState = (name: string) => figure('ComparisonBarChart', name);
const dropdownTrigger = (name: string) => within(figure('Dropdown', name)).getByRole('combobox');
/** One column of a chart's hidden table, its header row left out. */
const cells = (table: HTMLElement, column: number) =>
  within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) => row.children[column]!.textContent);

/** The visible lines of an Expenses Breakdown item: its paragraphs' text. */
const itemLines = (element: HTMLElement) => [...element.querySelectorAll('p')].map((line) => line.textContent);

// The dev gallery (AC12): one section per shared component. Vitest runs in development mode.
describe('component gallery', () => {
  it('has a section for every exported component', async () => {
    const consoleError = vi.spyOn(console, 'error');

    await renderGallery();

    for (const name of Object.keys(components)) {
      expect(screen.getByRole('region', { name })).toBeInTheDocument();
    }
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('shows the undesigned states', async () => {
    await renderGallery();

    const input = screen.getByRole('region', { name: 'Input' });
    expect(within(input).getByRole('figure', { name: 'Field error' })).toHaveTextContent('Email is required');
    expect(within(input).getByRole('button', { name: 'Hide password' })).toBeInTheDocument();

    const primary = screen.getByRole('region', { name: 'ButtonPrimary' });
    expect(within(within(primary).getByRole('figure', { name: 'Disabled' })).getByRole('button')).toBeDisabled();
    expect(within(within(primary).getByRole('figure', { name: 'Loading' })).getByRole('button')).toHaveAttribute(
      'aria-busy',
      'true',
    );

    const remindMe = screen.getByRole('region', { name: 'RemindMe' });
    expect(within(within(remindMe).getByRole('figure', { name: 'Unchecked' })).getByRole('checkbox')).toHaveAttribute(
      'aria-checked',
      'false',
    );

    expect(within(screen.getByRole('region', { name: 'FormError' })).getByRole('alert')).toBeInTheDocument();
  });

  // Task 003 Scope: the app shell sections.
  it('shows the app shell parts in every listed state', async () => {
    await renderGallery();

    expect(within(figure('NavMenu', 'Active')).getAllByRole('link')).toHaveLength(7);
    expect(within(figure('NavMenu', 'Inactive')).getAllByRole('link')).toHaveLength(7);
    expect(
      within(figure('NavMenu', 'Active'))
        .getAllByRole('link')
        .every((link) => link.getAttribute('aria-current') === 'page'),
    ).toBe(true);
    expect(within(figure('NavMenu', 'Hover')).getAllByRole('link')).toHaveLength(7);

    expect(within(figure('Profile', 'With photo')).getByRole('img', { name: 'Tanzir Rahman' }).tagName).toBe('IMG');
    expect(
      within(figure('Profile', 'Initials, two words')).getByRole('img', { name: 'Tanzir Rahman' }),
    ).toHaveTextContent('TR');
    expect(within(figure('Profile', 'Initials, one word')).getByRole('img', { name: 'Marko' })).toHaveTextContent('M');

    expect(within(figure('Header', 'With greeting')).getByText('Hello Tanzir')).toBeInTheDocument();
    expect(within(figure('Header', 'Without greeting')).queryByText(/Hello/)).toBeNull();

    const like104 = figure('AppLayout', 'Like 104: Overview active, with greeting');
    expect(within(like104).getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
    expect(within(like104).getByText('Hello Tanzir')).toBeInTheDocument();
    expect(within(like104).getByText('19 May, 2023')).toBeInTheDocument();
    expect(within(like104).getByRole('img', { name: 'Tanzir Rahman' })).toHaveTextContent('TR');

    const like105 = figure('AppLayout', 'Like 105: Balances active, no greeting');
    expect(within(like105).getByRole('link', { name: 'Balances' })).toHaveAttribute('aria-current', 'page');
    expect(within(like105).queryByText(/Hello/)).toBeNull();
  });

  // Task 004 Scope: the content components.
  it('shows the content components in every listed state', async () => {
    await renderGallery();

    expect(
      within(figure('Section', 'Plain, like 104 Total Balance')).getByRole('region', { name: 'Total Balance' }),
    ).toBeInTheDocument();
    expect(
      within(figure('Section', 'With View All, like 104 Upcoming Bill')).getByRole('link', { name: 'View All' }),
    ).toHaveAccessibleDescription('Upcoming Bill');
    expect(
      within(figure('Section', 'With the note, like 104 Expenses Breakdown')).getByText('*Compare to last month'),
    ).toBeInTheDocument();

    for (const [name, label] of [
      ['All active', 'All'],
      ['Revenue active', 'Revenue'],
      ['Expenses active', 'Expenses'],
    ] as const) {
      expect(within(figure('MenuTab', name)).getByRole('tab', { name: label })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    }
    expect(within(figure('MenuTab', 'Interactive')).getAllByRole('tab')).toHaveLength(3);

    for (const variant of [
      'Recent Transaction (104)',
      'Expenses Breakdown (104)',
      'Card header (109)',
      'Goals (110)',
    ]) {
      const icons = within(figure('CategoryIcon', variant)).getAllByRole('img');
      expect(icons.map((icon) => icon.getAttribute('aria-label'))).toEqual([
        'Housing',
        'Food',
        'Transportation',
        'Entertainment',
        'Shopping',
        'Others',
        'Income',
      ]);
    }
    expect(within(figure('CategoryIcon', 'Table row (107)')).getAllByRole('img')).toHaveLength(7);

    for (const size of ['Compact (104)', 'Large (108)']) {
      const dates = [...figure('DateBox', size).querySelectorAll('time')];
      expect(dates.map((time) => time.getAttribute('datetime'))).toEqual(['2023-05-15', '2023-06-16', '2023-09-05']);
      expect(within(figure('AmountBox', size)).getByText('$1,000,000,000.00')).toBeInTheDocument();
    }

    expect(figure('DataState', 'Loading').querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(await within(figure('DataState', 'Empty')).findByText('No transactions yet')).toBeInTheDocument();
    expect(await within(figure('DataState', 'Error')).findByRole('alert')).toHaveTextContent('Something went wrong.');
    expect(await within(figure('DataState', 'Ready')).findByText('$150.00')).toBeInTheDocument();

    const demo = figure('DataState', 'Error boundary: one widget breaks, the other keeps working');
    expect(within(demo).getByRole('button', { name: 'Render a bad amount' })).toBeInTheDocument();
    expect(await within(demo).findAllByText(/^\$\d/)).toHaveLength(2);
  });

  // Task 005 Scope: the amount field states (T6, T10, AC19).
  it('shows every amount field state', async () => {
    await renderGallery();

    expect(amountField('Prefilled 500000')).toHaveValue('500000');
    expect(amountField('Prefilled 1250.50')).toHaveValue('1250.50');
    expect(amountField('Empty, no placeholder (Target)')).toHaveValue('');
    expect(amountField('Empty, no placeholder (Target)')).not.toHaveAttribute('placeholder');
    expect(amountField('Empty, with the placeholder (Present)')).toHaveAttribute(
      'placeholder',
      'Write present amount here',
    );
    expect(amountField('With an error')).toHaveAttribute('aria-invalid', 'true');
    expect(amountField('With an error')).toHaveAccessibleDescription('Enter a target amount');
  });

  // T9: the interactive field shows what parseAmountInput reads from its text (AC9, #84).
  it('shows the cents read from the interactive field', async () => {
    const user = userEvent.setup();
    await renderGallery();
    const example = figure('PopupInputSmall', 'Interactive: the cents read from the text');
    const field = within(example).getByRole('textbox', { name: 'Target Amounts' });
    expect(within(example).getByText('Cents: empty')).toBeInTheDocument();

    for (const [text, shown] of [
      ['1250.5', 'Cents: 125050'],
      ['.5', 'Cents: 50'],
      ['.', 'Cents: empty'],
      ['500000', 'Cents: 50000000'],
    ] as const) {
      await user.clear(field);
      await user.type(field, text);
      expect(within(example).getByText(shown)).toBeInTheDocument();
    }

    await user.clear(field);
    expect(within(example).getByText('Cents: empty')).toBeInTheDocument();
  });

  // Task 005 Scope: the Dropdown variants and their sample options (T13, AC19).
  it('shows every Dropdown variant with its sample options', async () => {
    const user = userEvent.setup();
    await renderGallery();

    expect(dropdownTrigger('box, like 110 Savings Goal')).toHaveTextContent('Mar, 2026');
    expect(dropdownTrigger('plain, like 110 Saving Summary')).toHaveTextContent('Mar, 2026');
    expect(dropdownTrigger('inline, like 111 country code')).toHaveTextContent('+880');
    expect(dropdownTrigger('input, Account Type (#26, not designed)')).toHaveTextContent('Checking');

    await user.click(dropdownTrigger('box, like 110 Savings Goal'));
    const months = screen.getAllByRole('option').map((option) => option.textContent);
    expect(months.slice(0, 3)).toEqual(['Oct, 2026', 'Sep, 2026', 'Aug, 2026']);
    expect(months).toContain('Mar, 2026');
    await user.keyboard('{Escape}');

    await user.click(dropdownTrigger('inline, like 111 country code'));
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['+1', '+44', '+880']);
    await user.keyboard('{Escape}');

    await user.click(dropdownTrigger('input, Account Type (#26, not designed)'));
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Credit Card',
      'Checking',
      'Savings',
      'Investment',
      'Loan',
    ]);
    await user.keyboard('{Escape}');

    await user.click(dropdownTrigger('60 months'));
    const long = screen.getAllByRole('option').map((option) => option.textContent);
    expect(long).toHaveLength(60);
    expect([long[0], long[59]]).toEqual(['Oct, 2026', 'Nov, 2021']);
  });

  // Task 006 Scope: the legend, the chart samples and the gauge samples (AC17).
  it('shows the chart and gauge samples', async () => {
    await renderGallery();

    for (const [name, labels] of [
      ['This week / Last week (104)', ['This week', 'Last week']],
      ['This year / Last year (109)', ['This year', 'Last year']],
    ] as const) {
      expect(
        within(figure('ChartLegend', name))
          .getAllByRole('listitem')
          .map((item) => item.textContent),
      ).toEqual(labels);
    }

    const statistics = figure('ComparisonBarChart', 'Statistics sample, like 104');
    expect(within(statistics).getByText('Weekly Comparison')).toBeInTheDocument();
    expect(
      within(statistics)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['This week', 'Last week']);
    const weekTable = within(statistics).getByRole('table', { name: 'Expenses per day, this week and last week' });
    expect(
      within(weekTable)
        .getAllByRole('rowheader')
        .map((cell) => cell.textContent),
    ).toEqual(['19 Mon', '20 Tue', '21 Wed', '22 Thu', '23 Fri', '24 Sat', '25 Sun']);
    expect(within(weekTable).getByRole('cell', { name: '$322.00' })).toBeInTheDocument();
    // The ticks are written in the gallery: the backend's axisTicks gives $0 to $400 for $322.00 (#91).
    for (const tick of axisTicks({ cents: 32_200, currency: 'USD' })) {
      expect(within(statistics).getByText(formatCompactMoney(tick))).toBeInTheDocument();
    }

    const expenses = figure('ComparisonBarChart', 'Expenses sample, like 109');
    const yearTable = within(expenses).getByRole('table', { name: 'Expenses per month, this year and last year' });
    expect(within(yearTable).getAllByRole('rowheader')).toHaveLength(12);
    expect(within(yearTable).getAllByRole('row').at(-1)).toHaveTextContent(/^Dec\$3,380\.00$/);
    for (const tick of axisTicks({ cents: 341_250, currency: 'USD' })) {
      expect(within(expenses).getByText(formatCompactMoney(tick))).toBeInTheDocument();
    }

    for (const groups of ['7 groups (104)', '12 groups (109)']) {
      // No text but the caption.
      expect(figure('ComparisonBarChartSkeleton', groups).textContent).toBe(groups);
    }

    for (const [name, valueText] of [
      ['$12,500 of $20,000 (104)', '$12.5k'],
      ['$16,250 of $20,000 (demo)', '$16.2k'],
      ['$0 of $20,000', '$0'],
      ['$25,000 of $20,000, over-achieved', '$25k'],
      ['$1,000,000,000 of $1,000,000,000', '$1,000M'],
    ] as const) {
      expect(
        within(figure('TargetVsAchievementMeter', name)).getByRole('meter', { name: 'Target vs Achievement' }),
      ).toHaveAttribute('aria-valuetext', valueText);
    }
  });

  // T13 (unit): the chart's states inside DataState, with the header row kept in each (AC12, #6, #89).
  it('shows the chart in every DataState state', async () => {
    const user = userEvent.setup();
    await renderGallery();

    for (const name of ['Loading', 'All zero', 'Error', 'Ready', 'Background refetch fails: the chart stays']) {
      expect(within(chartState(name)).getByText('Weekly Comparison')).toBeInTheDocument();
      expect(within(chartState(name)).getAllByRole('listitem')).toHaveLength(2);
    }
    expect(chartState('Loading').querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(await within(chartState('All zero')).findByText('No expenses this week or last week')).toBeInTheDocument();
    expect(await within(chartState('Error')).findByRole('alert')).toHaveTextContent('Something went wrong.');
    expect(within(chartState('Error')).getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(await within(chartState('Ready')).findByRole('table')).toBeInTheDocument();

    const refetch = chartState('Background refetch fails: the chart stays');
    expect(await within(refetch).findByRole('table')).toBeInTheDocument();
    await user.click(within(refetch).getByRole('button', { name: 'Refetch and fail' }));
    expect(await within(refetch).findByText('Query status: error')).toBeInTheDocument();
    expect(within(refetch).getByRole('table')).toBeInTheDocument();
    expect(within(refetch).queryByRole('alert')).toBeNull();
  });

  // Task 015: the Upcoming Bill card, its logos and its skeleton.
  it('shows the Upcoming Bill samples: two rows, one row, a long title and amount, the logos and the skeleton', async () => {
    await renderGallery();

    const rowsOf = (name: string) => within(figure('UpcomingBill', name)).getAllByRole('listitem');
    expect(rowsOf('The demo bills (104)').map((row) => row.textContent)).toEqual([
      'May15Figma - Yearly PlanLast Charge - 14 May, 2026$150.00',
      'Jun16Adobe Inc - Yearly PlanLast Charge - 17 Jun, 2026$559.00',
    ]);
    expect(rowsOf('One bill')).toHaveLength(1);
    expect(rowsOf('A long title and amount: the amount box moves under (#111 a)')[0]).toHaveTextContent(
      '$1,000,000,000.00',
    );
    expect(within(figure('UpcomingBillLogo', 'Figma (104)')).getByRole('img')).toHaveAccessibleName('Figma');
    expect(within(figure('UpcomingBillLogo', 'Adobe (104)')).getByRole('img')).toHaveAccessibleName('Adobe');
    // Two rows: a date box block, three lines (logo, title, last charge) and an amount box block.
    expect(figure('UpcomingBillSkeleton', 'Loading').querySelectorAll('span')).toHaveLength(10);
  });

  // Task 016: the Recent Transaction card, its row and its skeleton.
  // Task 017 T17: the comparison look and the Statistics card in every state, on sample data with no network.
  it('shows the comparison look and the Statistics samples: the demo week, a quiet week, all 0, loading and error', async () => {
    const user = userEvent.setup();
    await renderGallery();

    expect(dropdownTrigger('comparison, like 104 Statistics')).toHaveTextContent(/^Weekly Comparison$/);
    await user.click(dropdownTrigger('comparison, like 104 Statistics'));
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['Weekly Comparison']);
    await user.keyboard('{Escape}');

    const chartTable = (name: string) =>
      within(figure('Statistics', name)).findByRole('table', { name: 'Expenses per day, this week and last week' });
    const demo = await chartTable('The demo week (104)');
    expect(cells(demo, 0)).toEqual(['19 Mon', '20 Tue', '21 Wed', '22 Thu', '23 Fri', '24 Sat', '25 Sun']);
    expect(cells(demo, 2)).toEqual(['$10.64', '$24.64', '$17.64', '$266.00', '', '', '']);
    expect(
      within(figure('Statistics', 'The demo week (104)')).getByRole('combobox', { name: 'Statistics' }),
    ).toHaveTextContent('Weekly Comparison');
    expect(cells(await chartTable('This week all 0'), 2)).toEqual(['$0.00', '$0.00', '$0.00', '$0.00', '', '', '']);
    expect(
      await within(figure('Statistics', 'Every value 0')).findByText('No expenses this week or last week'),
    ).toBeVisible();
    expect(figure('Statistics', 'Loading').querySelector('[aria-busy="true"]')).not.toBeNull();
    const error = figure('Statistics', 'Error');
    expect(await within(error).findByRole('alert')).toHaveTextContent('Something went wrong.');
    expect(within(error).getByRole('combobox', { name: 'Statistics' })).toBeInTheDocument();
  });

  it('shows the Recent Transaction samples: the tabs, the states, a long row and the skeleton', async () => {
    const user = userEvent.setup();
    await renderGallery();

    const demo = figure('RecentTransaction', 'The demo transactions (104)');
    const demoRows = () => within(within(demo).getByRole('tabpanel')).getAllByRole('listitem');
    expect(await within(demo).findByRole('list')).toBeInTheDocument();
    expect(demoRows().map((row) => row.textContent)).toEqual([
      'JeansDenim House-$266.0022 Oct, 2026',
      'Movie ticketInox-$17.6421 Oct, 2026',
      'PizzaPizza Hit-$24.6420 Oct, 2026',
      'Taxi fareUber-$10.6419 Oct, 2026',
      'Restaurant billSpice Garden-$147.8418 Oct, 2026',
    ]);
    await user.click(within(demo).getByRole('tab', { name: 'Revenue' }));
    expect(demoRows()[0]).toHaveTextContent('Freelance paymentBright Studio+$179.2017 Oct, 2026');

    const fewer = figure('RecentTransaction', 'Fewer than 5: 3, 1 and none');
    expect(await within(fewer).findAllByRole('listitem')).toHaveLength(3);
    expect(
      await within(figure('RecentTransaction', 'Every list empty')).findByText('No transactions yet'),
    ).toBeVisible();
    expect(figure('RecentTransaction', 'Loading').querySelector('[role="tabpanel"] [aria-busy="true"]')).not.toBeNull();
    const error = figure('RecentTransaction', 'Error');
    expect(await within(error).findByRole('alert')).toHaveTextContent('Something went wrong.');
    expect(within(error).getByRole('tablist', { name: 'Recent Transaction' })).toBeInTheDocument();

    const itemRow = (name: string) => within(figure('RecentTransactionItem', name)).getByRole('listitem');
    expect(itemRow('Expense (104)')).toHaveTextContent('JeansDenim House-$266.0022 Oct, 2026');
    expect(within(itemRow('Income: the wallet')).getByRole('img')).toHaveAccessibleName('Income');
    expect(itemRow('A long item, shop and amount: the right column moves under (#111 a)')).toHaveTextContent(
      '-$1,000,000,000.00',
    );
    // Five rows: a tile block, two lines on the left and two on the right.
    expect(figure('RecentTransactionSkeleton', 'Loading').querySelectorAll('span')).toHaveLength(25);
  });

  // Task 018 T15: the Expenses Breakdown item, card and skeleton, on sample data with no network.
  it('shows the Expenses Breakdown samples: the item’s changes, the card in every state and the skeleton', async () => {
    await renderGallery();

    const item = (name: string) => within(figure('ExpensesItem', name)).getByRole('listitem');
    expect(itemLines(item('Up (104)'))).toEqual(['Food', '$510.04', '7%*']);
    expect(itemLines(item('Down'))).toEqual(['Hous­ing', '$252.00', '17%*']);
    expect(itemLines(item('0%: no arrow'))).toEqual(['Hous­ing', '$200.00', '0%*']);
    expect(itemLines(item('No change: last month $0.00'))).toEqual(['Trans­por­ta­tion', '$53.20', '']);
    expect(itemLines(item('$0.00 after a month with expenses'))).toEqual(['Food', '$0.00', '100%*']);
    expect(itemLines(item('A long total: the arrow moves under (#115 b)'))[1]).toBe('$1,000,000,000.00');
    expect(within(item('Up (104)')).getByRole('link', { name: 'Food expenses' })).toHaveAttribute('href', '/expenses');

    const cardItems = (name: string) =>
      within(figure('OverviewExpensesBreakdown', name))
        .findAllByRole('listitem')
        .then((all) => all.map((each) => itemLines(each)[1]));
    expect(await cardItems('The demo month (104)')).toEqual([
      '$252.00',
      '$510.04',
      '$53.20',
      '$282.24',
      '$658.00',
      '$138.32',
    ]);
    expect(await cardItems('Last month $0.00')).toEqual([
      '$237.50',
      '$273.79',
      '$36.11',
      '$74.10',
      '$305.91',
      '$111.15',
    ]);
    expect(await cardItems('No expenses at all')).toEqual(Array.from({ length: 6 }, () => '$0.00'));
    expect(figure('OverviewExpensesBreakdown', 'Loading').querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(await within(figure('OverviewExpensesBreakdown', 'Error')).findByRole('alert')).toHaveTextContent(
      'Something went wrong.',
    );
    // Six items: a tile block, three lines and an arrow block each.
    expect(figure('OverviewExpensesBreakdownSkeleton', 'Loading').querySelectorAll('span')).toHaveLength(30);
  });

  // Task 019 T15: the Balances parts on sample data, with no request.
  it('shows the Balances samples: the cards, a long Bank Name and balance, Details, the Add Accounts cell and the skeleton', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await renderGallery();

    const card = (name: string) => figure('AccountType', name);
    const headerOf = (name: string) => [
      within(card(name)).getByRole('heading', { level: 3 }).textContent,
      ...within(card(name))
        .queryAllByRole('img')
        .map((img) => img.getAttribute('alt')),
    ];
    expect(headerOf('Credit Card with Mastercard (105)')).toEqual(['Credit Card', 'Mastercard']);
    expect(headerOf('Checking with VISA')).toEqual(['Checking', 'VISA']);
    expect(headerOf('No card network')).toEqual(['Savings']);
    expect(within(card('Credit Card with Mastercard (105)')).getByText('Master Card')).toBeInTheDocument();
    expect(
      within(card('A 100-character Bank Name: under the type, wrapped (#106)')).getByText(
        'The First Community Cooperative Savings and Commercial Bank of Greater Dhaka and Chittagong Division',
      ),
    ).toBeInTheDocument();
    expect(
      within(card('The longest balance the contract allows')).getByText('-$90,071,992,547,409.91'),
    ).toBeInTheDocument();
    expect(within(card('Credit Card with Mastercard (105)')).getByRole('link', { name: 'Details' })).toHaveAttribute(
      'href',
      '/balances/1',
    );

    expect(
      within(figure('Button', 'Details (105): a link to Account Details')).getByRole('link', { name: 'Details' }),
    ).toHaveAttribute('href', '/balances/1');
    expect(figure('AddAccountsButtonBig', 'Add Accounts (105): visual only')).toHaveTextContent('Add Accounts');
    const cell = figure('AddAccountsCell', 'The last Balances cell (105): visual only');
    expect(cell).toHaveTextContent('Add AccountsEdit Accounts');
    expect(within(cell).queryAllByRole('button', { hidden: true })).toEqual([]);
    expect(cell.querySelector('[aria-hidden="true"]')).toHaveTextContent('Add AccountsEdit Accounts');
    // Two lines in the header row, two per value, a "Remove" line and the "Details" block.
    expect(figure('AccountTypeSkeleton', 'Loading').querySelectorAll('span')).toHaveLength(8);
    const fetched = fetchSpy.mock.calls.map(([input]) =>
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
    );
    expect(fetched.filter((url) => url.includes('/api/accounts'))).toEqual([]);
  });

  it('links the popup sections to /dev/popup', async () => {
    await renderGallery();

    for (const region of ['Popup', 'GoalPopupInput']) {
      expect(
        within(screen.getByRole('region', { name: region })).getByRole('link', { name: 'Open /dev/popup' }),
      ).toHaveAttribute('href', '/dev/popup');
    }
  });

  // #89: a failed background refetch keeps the data on screen, with no error state and no indicator.
  it('keeps the amount on screen when its background refetch fails', async () => {
    const user = userEvent.setup();
    await renderGallery();
    const example = figure('DataState', 'Background refetch fails: the data stays');
    expect(await within(example).findByText('$150.00')).toBeInTheDocument();
    expect(within(example).getByText('Query status: success')).toBeInTheDocument();

    await user.click(within(example).getByRole('button', { name: 'Refetch and fail' }));

    expect(await within(example).findByText('Query status: error')).toBeInTheDocument();
    expect(within(example).getByText('$150.00')).toBeInTheDocument();
    expect(within(example).queryByRole('alert')).toBeNull();
  });
});
