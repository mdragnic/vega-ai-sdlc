import {
  type AccountDetailsResponse,
  type AccountsResponse,
  type CategoryLimit,
  type CategoryLimitsResponse,
  categoryLabel,
  expenseCategorySchema,
  formatAmountInput,
  formatMonthLabel,
  parseAmountInput,
  type ExpenseCategory,
  type ExpenseLineItem,
  type ExpensesBreakdownCategory,
  type ExpensesBreakdownResponse,
  type Money,
  type MonthlyComparisonResponse,
  type Profile as ProfileData,
  type RecentTransactionRow,
  type RecentTransactionsResponse,
  type SavingSummaryDay,
  type SavingSummaryResponse,
  type SavingsGoalMonthsResponse,
  type SavingsGoalResponse,
  type TransactionHistoryPage,
  type TransactionHistoryRow,
  type TransactionRow,
  type TransactionsPage,
  type UpcomingBillsResponse,
  type WeeklyComparisonResponse,
} from '@finebank/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';

import { googleUrl } from '../../assets/brand';
import {
  AccountDetailsCard,
  AccountDetailsCardSkeleton,
  AccountDetailsForm,
  AccountType,
  AccountTypeSkeleton,
  AccountTypeSlide,
  AddAccountsButtonBig,
  AddAccountsCell,
  AdjustButton,
  AmountBox,
  AppLayout,
  AuthLayout,
  Avatar,
  BillTable,
  BillTableSkeleton,
  Button,
  ButtonPrimary,
  ButtonSecondary,
  ButtonSmall,
  Card,
  CategoryIcon,
  ChartLegend,
  ComparisonBarChart,
  ComparisonBarChartSkeleton,
  DataState,
  DateBox,
  Dropdown,
  type DropdownOption,
  ExpensesBreakdown,
  ExpensesBreakdownList,
  ExpensesBreakdownSkeleton,
  ExpensesComparison,
  ExpensesItem,
  ExpensesLineItem,
  FieldError,
  FormError,
  FormSuccess,
  GoalItem,
  GoalItemList,
  GoalItemSkeleton,
  Goals,
  GoalsSkeleton,
  Header,
  HeaderSearch,
  Input,
  LoadMore,
  Logout,
  MenuTab,
  NavBar,
  NavMenu,
  OverviewExpensesBreakdown,
  OverviewExpensesBreakdownSkeleton,
  PopupInputSmall,
  Profile,
  ProfileForm,
  ProfileFormSkeleton,
  ProfilePhotoUpload,
  RecentTransaction,
  RecentTransactionItem,
  RecentTransactionSkeleton,
  RemindMe,
  SavingSummary,
  SavingSummaryChart,
  SavingSummaryChartSkeleton,
  SavingsGoal,
  SavingsGoalSkeleton,
  SavingsGoalSummary,
  Section,
  SettingsInput,
  SettingsPhoneInput,
  Skeleton,
  SliderOption,
  Spinner,
  Statistics,
  TargetVsAchievementMeter,
  TextDivider,
  TotalBalance,
  TotalBalanceSkeleton,
  TransactionTable,
  TransactionTableSkeleton,
  TransactionsHistorySkeleton,
  TransactionsHistoryTable,
  UpcomingBill,
  UpcomingBillLogo,
  UpcomingBillSkeleton,
} from '../../components';
import { useLoadMore } from '../../components/LoadMore/LoadMore';
import { menuTabId } from '../../components/MenuTab/MenuTab';
import { navSections } from '../../components/NavMenu/NavMenu';
import { paths } from '../../routes/paths';
import styles from './ComponentGallery.module.css';
// A local photo for the photo examples: the profile photo cropped from docs/figma/104. Overview.png.
import sampleAvatarUrl from './sample-avatar.png';

function GallerySection({ name, wide = false, children }: { name: string; wide?: boolean; children: ReactNode }) {
  const headingId = useId();
  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.sectionTitle}>
        {name}
      </h2>
      <div className={wide ? undefined : styles.column}>{children}</div>
    </section>
  );
}

function Example({ name, children }: { name: string; children: ReactNode }) {
  const captionId = useId();
  return (
    <figure className={styles.example} aria-labelledby={captionId}>
      <figcaption id={captionId} className={styles.caption}>
        {name}
      </figcaption>
      {children}
    </figure>
  );
}

/** Show Password is the user's toggle (#51), not a prop, so the gallery clicks the eye once on mount. */
function ShowPasswordExample() {
  const wrapper = useRef<HTMLDivElement>(null);
  const clicked = useRef(false);
  useEffect(() => {
    if (clicked.current) return;
    clicked.current = true;
    wrapper.current?.querySelector<HTMLButtonElement>('button[aria-label="Show password"]')?.click();
  }, []);

  return (
    <div ref={wrapper}>
      <Input label="Password" type="password" defaultValue="152@@##PAss" />
    </div>
  );
}

// Logging out is task 011; here the button does nothing.
const noLogout = () => undefined;

/** The sidebar parts are drawn for the dark sidebar, so they are shown on it. */
function SidebarPanel({ children }: { children: ReactNode }) {
  return <div className={styles.sidebarPanel}>{children}</div>;
}

/** Screen content taller than the viewport, so the frame scrolls. */
function TallContent() {
  return (
    <>
      <div className={styles.tallBlock}>
        Screen content (tasks 013 onward). Taller than the viewport, so the page scrolls.
      </div>
      <div className={styles.tallBlock}>More screen content.</div>
    </>
  );
}

type Direction = 'all' | 'income' | 'expense';

// The widgets map the labels to the transaction direction (#19).
const directionTabs = [
  { value: 'all', label: 'All' },
  { value: 'income', label: 'Revenue' },
  { value: 'expense', label: 'Expenses' },
] as const;

const directionText: Record<Direction, string> = {
  all: 'All transactions',
  income: 'Income only',
  expense: 'Expenses only',
};

// Selecting a tab in a fixed example does nothing.
const keepSelection = () => undefined;

/** One tab set and the panel it controls. Fixed on `value`, or interactive. */
function TabsExample({ id, value, interactive = false }: { id: string; value: Direction; interactive?: boolean }) {
  const [selected, setSelected] = useState<Direction>(value);
  const shown = interactive ? selected : value;
  return (
    <Card>
      <MenuTab
        label="Recent Transaction"
        tabs={directionTabs}
        value={shown}
        panelId={id}
        onChange={interactive ? setSelected : keepSelection}
      />
      <p id={id} role="tabpanel" aria-labelledby={menuTabId(id, shown)} className={styles.panelText}>
        {directionText[shown]}
      </p>
    </Card>
  );
}

const settingsTabs = [
  { value: 'account', label: 'Account' },
  { value: 'security', label: 'Security' },
] as const;

/** 111's tabs: the `settings` look of `MenuTab` (task 028), Account selected. */
function SettingsTabsExample() {
  return (
    <Card>
      <MenuTab
        variant="settings"
        label="Settings"
        tabs={settingsTabs}
        value="account"
        panelId="tabs-settings"
        onChange={keepSelection}
      />
      <p id="tabs-settings" role="tabpanel" aria-labelledby={menuTabId('tabs-settings', 'account')} />
    </Card>
  );
}

/** 111's profile (Tanzir Rahman, the number digits only as stored, #126 c). */
const sampleProfile: ProfileData = {
  fullName: 'Tanzir Rahman',
  email: 'tanzir.rahman@email.com',
  username: 'tanzir.rahman',
  phoneCountryCode: '+880',
  phoneNumber: '5154758868',
};

/** The Account tab's form on a white card with 111's insets; a save here only ends (no request). */
function ProfileFormExample({
  profile = sampleProfile,
  saving = false,
  formError,
  updated = false,
}: {
  profile?: ProfileData;
  saving?: boolean;
  formError?: string;
  updated?: boolean;
}) {
  return (
    <Card>
      <ProfileForm
        profile={profile}
        saving={saving}
        formError={formError}
        updated={updated}
        onSave={(_request, { onSettled }) => onSettled()}
      />
    </Card>
  );
}

const categories: (ExpenseCategory | null)[] = [...expenseCategorySchema.options, null];

function CategoryIcons({ variant }: { variant: 'recent' | 'breakdown' | 'header' | 'goal' | 'plain' }) {
  return (
    <div className={styles.iconRow}>
      {categories.map((category) => (
        <CategoryIcon key={category ?? 'income'} category={category} variant={variant} />
      ))}
    </div>
  );
}

const usd = (cents: number): Money => ({ cents, currency: 'USD' });

/** A list row like 104 Recent Transaction: the tile, the name and shop, the amount and date. */
function RowSkeleton() {
  return (
    <div className={styles.skeletonRow}>
      <Skeleton shape="block" className={styles.skeletonTile} />
      <div className={styles.skeletonLines}>
        <Skeleton shape="text" className={styles.skeletonTitle} />
        <Skeleton shape="text" className={styles.skeletonDetail} />
      </div>
      <div className={styles.skeletonLinesEnd}>
        <Skeleton shape="text" className={styles.skeletonDetail} />
        <Skeleton shape="text" className={styles.skeletonDetail} />
      </div>
    </div>
  );
}

const listSkeleton = (
  <div className={styles.skeletonList}>
    <RowSkeleton />
    <RowSkeleton />
    <RowSkeleton />
  </div>
);

const waitThenFail = <TData,>() =>
  new Promise<TData>((_, reject) => {
    setTimeout(() => reject(new Error('The demo query always fails')), 800);
  });

// Local query functions only: the gallery never calls the network. No automatic retries, so each state stays put.
const demoQuery = { retry: false, refetchOnWindowFocus: false } as const;

function DataStateLoading() {
  const query = useQuery({
    ...demoQuery,
    queryKey: ['gallery', 'loading'],
    queryFn: () => new Promise<number[]>(() => undefined),
  });
  return (
    <Card>
      <DataState query={query} skeleton={listSkeleton}>
        {(rows) => <p>{rows.length} rows</p>}
      </DataState>
    </Card>
  );
}

function DataStateEmpty() {
  const query = useQuery({
    ...demoQuery,
    queryKey: ['gallery', 'empty'],
    queryFn: () => Promise.resolve<number[]>([]),
  });
  return (
    <Card className={styles.stateCard}>
      <DataState
        query={query}
        skeleton={listSkeleton}
        empty={{ isEmpty: (rows) => rows.length === 0, message: 'No transactions yet' }}
      >
        {(rows) => <p>{rows.length} rows</p>}
      </DataState>
    </Card>
  );
}

/** Fails on load and on every Retry, after a short wait, so the skeleton shows between. */
function DataStateError() {
  const query = useQuery({ ...demoQuery, queryKey: ['gallery', 'error'], queryFn: () => waitThenFail<number[]>() });
  return (
    <Card className={styles.stateCard}>
      <DataState query={query} skeleton={listSkeleton}>
        {(rows) => <p>{rows.length} rows</p>}
      </DataState>
    </Card>
  );
}

function DataStateReady() {
  const query = useQuery({ ...demoQuery, queryKey: ['gallery', 'ready'], queryFn: () => Promise.resolve(usd(15000)) });
  return (
    <Card>
      <DataState query={query} skeleton={<Skeleton shape="block" className={styles.skeletonAmount} />}>
        {(amount) => (
          // A block of its own, so DataState's column does not stretch the box.
          <div>
            <AmountBox amount={amount} size="compact" />
          </div>
        )}
      </DataState>
    </Card>
  );
}

/**
 * Shows an amount; "Refetch and fail" makes the next fetch fail. The query reports the error and the amount
 * stays, with no error state and no indicator (#89). The caption shows the query status, for the demo only.
 */
function BackgroundRefetchFails() {
  const failNext = useRef(false);
  const query = useQuery({
    ...demoQuery,
    queryKey: ['gallery', 'refetch-fails'],
    queryFn: () => {
      if (!failNext.current) return Promise.resolve(usd(15000));
      failNext.current = false;
      return Promise.reject(new Error('The demo refetch fails'));
    },
  });

  return (
    <div className={styles.demoStack}>
      <ButtonSmall
        onClick={() => {
          failNext.current = true;
          void query.refetch();
        }}
      >
        Refetch and fail
      </ButtonSmall>
      <Card className={styles.stateCard}>
        <DataState query={query} skeleton={<Skeleton shape="block" className={styles.skeletonAmount} />}>
          {(amount) => (
            // A block of its own, so the column of the card does not stretch the box.
            <div>
              <AmountBox amount={amount} size="compact" />
            </div>
          )}
        </DataState>
      </Card>
      <p className={styles.panelText}>Query status: {query.status}</p>
    </div>
  );
}

const boundaryKey = ['gallery', 'boundary', 'first'];

/**
 * Two widgets side by side. "Render a bad amount" puts 12.5 cents into the first widget's query, so its
 * `AmountBox` throws while rendering; Retry fetches the valid amount again.
 */
function ErrorBoundaryDemo() {
  const client = useQueryClient();
  const first = useQuery({ ...demoQuery, queryKey: boundaryKey, queryFn: () => Promise.resolve(usd(15000)) });
  const [direction, setDirection] = useState<Direction>('all');

  return (
    <>
      <ButtonSmall onClick={() => client.setQueryData(boundaryKey, usd(12.5))}>Render a bad amount</ButtonSmall>
      <div className={styles.widgetPair}>
        <Section title="First widget" gap="sm">
          <Card className={styles.stateCard}>
            <DataState query={first} skeleton={<Skeleton shape="block" className={styles.skeletonAmount} />}>
              {(amount) => (
                // A block of its own, so the column of the card does not stretch the box.
                <div>
                  <AmountBox amount={amount} size="compact" />
                </div>
              )}
            </DataState>
          </Card>
        </Section>
        <Section title="Second widget" gap="sm">
          <Card className={styles.stateCard}>
            <MenuTab
              label="Second widget"
              tabs={directionTabs}
              value={direction}
              panelId="boundary-second-panel"
              onChange={setDirection}
            />
            <div
              id="boundary-second-panel"
              role="tabpanel"
              aria-labelledby={menuTabId('boundary-second-panel', direction)}
              className={styles.panel}
            >
              <span className={styles.panelText}>{directionText[direction]}</span>
              <AmountBox amount={usd(55900)} size="compact" />
            </div>
          </Card>
        </Section>
      </div>
    </>
  );
}

/** The amount field that shows what `parseAmountInput` reads from its text (#84). */
function InteractiveAmount() {
  const [text, setText] = useState('');
  const cents = parseAmountInput(text);
  return (
    <div className={styles.demoStack}>
      <PopupInputSmall label="Target Amounts" value={text} onChange={(event) => setText(event.target.value)} />
      <p className={styles.panelText}>Cents: {cents ?? 'empty'}</p>
    </div>
  );
}

// The month list of the Goals selectors (#60): newest first, `formatMonthLabel` labels of `YYYY-MM` months. A fixed
// sample written out from Oct 2026; the screens list the months the backend sends (tasks 025, 026).
const sampleMonths = ['2026', '2025', '2024', '2023', '2022', '2021']
  .flatMap((year) =>
    ['12', '11', '10', '09', '08', '07', '06', '05', '04', '03', '02', '01'].map((m) => `${year}-${m}`),
  )
  .filter((month) => month <= '2026-10');

function monthOptions(count: number): DropdownOption[] {
  return sampleMonths.slice(0, count).map((month) => ({ value: month, label: formatMonthLabel(month) }));
}

// The Account Type values of #26 and sample country codes (#43); the full code list is task 028's.
const accountTypes: DropdownOption[] = [
  { value: 'credit-card', label: 'Credit Card' },
  { value: 'checking', label: 'Checking' },
  { value: 'savings', label: 'Savings' },
  { value: 'investment', label: 'Investment' },
  { value: 'loan', label: 'Loan' },
];
const countryCodes: DropdownOption[] = ['+1', '+44', '+880'].map((code) => ({ value: code, label: code }));

/** A Dropdown that keeps its own selection, so every example can be tried. */
function DropdownExample({
  variant,
  options,
  initial,
  label,
}: {
  variant: 'box' | 'plain' | 'inline' | 'input' | 'comparison';
  options: DropdownOption[];
  initial: string;
  label: string;
}) {
  const [value, setValue] = useState(initial);
  return <Dropdown variant={variant} options={options} value={value} onValueChange={setValue} aria-label={label} />;
}

/** The `input` Dropdown named by a visible `<label htmlFor>` through its `id`, as on 106 edit mode (task 022). */
function LabelledDropdownExample() {
  const [value, setValue] = useState('checking');
  const id = useId();
  return (
    <>
      <label className={styles.formLabel} htmlFor={id}>
        Account Type
      </label>
      <Dropdown id={id} variant="input" options={accountTypes} value={value} onValueChange={setValue} />
    </>
  );
}

// Task 006: chart samples as the backend will send them, ticks included (axisTicks of the highest value), so
// the gallery computes nothing (#11). `null` marks a period still to come (#55).
type ChartSample = Parameters<typeof ComparisonBarChart>[0];

const amounts = (values: (number | null)[]) => values.map((cents) => (cents === null ? null : usd(cents)));

// A week like the demo first login: last week's highest $322.00 on Thursday, no teal bar from Friday (#91).
const statisticsSample: ChartSample = {
  title: 'Expenses per day, this week and last week',
  labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  previous: { name: 'Last week', values: amounts([18000, 9550, 24000, 32200, 15000, 21025, 6000]) },
  current: { name: 'This week', values: amounts([12000, 26600, 7536, 28992, null, null, null]) },
  ticks: [0, 10000, 20000, 30000, 40000].map(usd),
};

// A year up to October: last year's highest $3,412.50 in July gives $0 to $4k.
const expensesSample: ChartSample = {
  title: 'Expenses per month, this year and last year',
  labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  previous: {
    name: 'Last year',
    values: amounts([214030, 187500, 251045, 199010, 276000, 230575, 341250, 298820, 220100, 265435, 312080, 338000]),
  },
  current: {
    name: 'This year',
    values: amounts([230015, 205000, 247560, 281025, 239040, 301500, 289075, 320510, 269030, 214055, null, null]),
  },
  ticks: [0, 100000, 200000, 300000, 400000].map(usd),
};

const allZeroSample: ChartSample = {
  ...statisticsSample,
  previous: { name: 'Last week', values: amounts([0, 0, 0, 0, 0, 0, 0]) },
  current: { name: 'This week', values: amounts([0, 0, 0, 0, null, null, null]) },
};

// The screens get the all-zero check from the backend (tasks 017, 024); the gallery reads its own sample.
const noExpenses = {
  isEmpty: ({ previous, current }: ChartSample) =>
    [...previous.values, ...current.values].every((value) => value === null || value.cents === 0),
  message: 'No expenses this week or last week',
};

/**
 * A chart card as in 104 and 109: the header row (a text stand-in for the screen's comparison control, then the
 * legend), and the chart's box, which every DataState state fills, so the card keeps its height.
 */
function ChartCard({
  control,
  current,
  previous,
  children,
}: {
  control: string;
  current: string;
  previous: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <div className={styles.chartHeader}>
        <span className={styles.chartControl}>{control}</span>
        <ChartLegend current={current} previous={previous} />
      </div>
      <div className={styles.chartBox}>{children}</div>
    </Card>
  );
}

function StatisticsCard({ children }: { children: ReactNode }) {
  return (
    <ChartCard control="Weekly Comparison" current="This week" previous="Last week">
      {children}
    </ChartCard>
  );
}

const statisticsSkeleton = <ComparisonBarChartSkeleton groups={7} />;
const drawChart = (sample: ChartSample) => <ComparisonBarChart {...sample} />;

function ChartLoading() {
  const query = useQuery({
    ...demoQuery,
    queryKey: ['gallery', 'chart', 'loading'],
    queryFn: () => new Promise<ChartSample>(() => undefined),
  });
  return (
    <StatisticsCard>
      <DataState query={query} skeleton={statisticsSkeleton}>
        {drawChart}
      </DataState>
    </StatisticsCard>
  );
}

function ChartAllZero() {
  const query = useQuery({
    ...demoQuery,
    queryKey: ['gallery', 'chart', 'all-zero'],
    queryFn: () => Promise.resolve(allZeroSample),
  });
  return (
    <StatisticsCard>
      <DataState query={query} skeleton={statisticsSkeleton} empty={noExpenses}>
        {drawChart}
      </DataState>
    </StatisticsCard>
  );
}

/** Fails on load and on every Retry, after a short wait, so the skeleton shows between. */
function ChartError() {
  const query = useQuery({
    ...demoQuery,
    queryKey: ['gallery', 'chart', 'error'],
    queryFn: () => waitThenFail<ChartSample>(),
  });
  return (
    <StatisticsCard>
      <DataState query={query} skeleton={statisticsSkeleton} empty={noExpenses}>
        {drawChart}
      </DataState>
    </StatisticsCard>
  );
}

function ChartReady() {
  const query = useQuery({
    ...demoQuery,
    queryKey: ['gallery', 'chart', 'ready'],
    queryFn: () => Promise.resolve(statisticsSample),
  });
  return (
    <StatisticsCard>
      <DataState query={query} skeleton={statisticsSkeleton} empty={noExpenses}>
        {drawChart}
      </DataState>
    </StatisticsCard>
  );
}

/** "Refetch and fail" makes the next fetch fail: the chart stays, with no error state and no indicator (#89). */
function ChartRefetchFails() {
  const failNext = useRef(false);
  const query = useQuery({
    ...demoQuery,
    queryKey: ['gallery', 'chart', 'refetch-fails'],
    queryFn: () => {
      if (!failNext.current) return Promise.resolve(statisticsSample);
      failNext.current = false;
      return Promise.reject(new Error('The demo refetch fails'));
    },
  });

  return (
    <div className={styles.demoStack}>
      <ButtonSmall
        onClick={() => {
          failNext.current = true;
          void query.refetch();
        }}
      >
        Refetch and fail
      </ButtonSmall>
      <div className={styles.chartStack}>
        <StatisticsCard>
          <DataState query={query} skeleton={statisticsSkeleton} empty={noExpenses}>
            {drawChart}
          </DataState>
        </StatisticsCard>
      </div>
      <p className={styles.panelText}>Query status: {query.status}</p>
    </div>
  );
}

/** A gauge sample: Present of Target with the progress the backend's goalProgress gives. */
function GaugeExample({ present, target, progress }: { present: number; target: number; progress: number }) {
  return (
    <Card className={styles.gaugeCard}>
      <TargetVsAchievementMeter present={usd(present)} target={usd(target)} progress={progress} />
    </Card>
  );
}

/** The demo accounts on 22 Oct 2026 (demo-data.md), as `GET /api/accounts` sends them (tasks 013 and 019). */
const sampleAccounts: AccountsResponse = {
  totalBalance: usd(13025467),
  accounts: [
    {
      id: 1,
      accountType: 'credit-card',
      bankName: 'Master Card',
      cardNetwork: 'mastercard',
      maskedNumber: '**** **** **** 2598',
      balance: usd(2101918),
    },
    {
      id: 2,
      accountType: 'checking',
      bankName: 'AB Bank Ltd',
      cardNetwork: 'visa',
      maskedNumber: '**** **** **** 7310',
      balance: usd(3336248),
    },
    {
      id: 3,
      accountType: 'savings',
      bankName: 'Brac Bank Ltd.',
      cardNetwork: null,
      maskedNumber: '**** **** **** 4421',
      balance: usd(2735680),
    },
    {
      id: 4,
      accountType: 'investment',
      bankName: 'AB Bank Ltd',
      cardNetwork: null,
      maskedNumber: '**** **** **** 6652',
      balance: usd(2950300),
    },
    {
      id: 5,
      accountType: 'loan',
      bankName: 'City Bank Ltd.',
      cardNetwork: null,
      maskedNumber: '**** **** **** 9083',
      balance: usd(1901321),
    },
  ],
};

/** A 100-character Bank Name in words, the longest #26 allows (task 019). */
const longBankName =
  'The First Community Cooperative Savings and Commercial Bank of Greater Dhaka and Chittagong Division';

/** The goal of a month, as `GET /api/savings-goals/current` sends it; the progress as the backend calculates it. */
const sampleGoal = (target: number, present: number, progress: number): SavingsGoalResponse => ({
  month: '2026-10',
  goal: { target: usd(target), present: usd(present), progress },
});

/** An upcoming bill as `GET /api/bills/upcoming` sends it. */
type SampleBill = UpcomingBillsResponse['bills'][number];

/** The description of every demo bill (demo-data.md, Bills). */
const sampleBillDescription =
  'For advanced security and more flexible controls, the Professional plan helps you scale design processes company-wide.';

/** The demo bills of a first login (demo-data.md): Figma due 15 May 2027, Adobe due 16 Jun 2027. */
const sampleFigmaBill: SampleBill = {
  title: 'Figma - Yearly Plan',
  description: sampleBillDescription,
  logo: 'figma',
  dueDate: '2027-05-15',
  lastChargeDate: '2026-05-14',
  amount: usd(15000),
};
const sampleAdobeBill: SampleBill = {
  title: 'Adobe Inc - Yearly Plan',
  description: sampleBillDescription,
  logo: 'adobe',
  dueDate: '2027-06-16',
  lastChargeDate: '2026-06-17',
  amount: usd(55900),
};

/** A 120-character title and the largest amount, for the wrap rule (#111 a). */
const sampleLongBill: SampleBill = {
  ...sampleFigmaBill,
  title: `Figma - ${'Organization Plan with every seat '.repeat(4)}`.slice(0, 120),
  amount: usd(100000000000),
};

/** A 120-character title and description with no space and the largest amount, for the Bills table (#115 b). */
const sampleNoSpaceBill: SampleBill = {
  ...sampleAdobeBill,
  title: 'AdobeIncCreativeCloudAllAppsPlan'.repeat(4).slice(0, 120),
  description: 'AdobeIncCreativeCloudAllAppsPlan'.repeat(4).slice(0, 120),
  amount: usd(100000000000),
};

/** The Bills table's bills of a first login on 22 Oct 2026: the demo's 4 (task 023 References). */
const sampleFourBills: SampleBill[] = [
  sampleFigmaBill,
  sampleAdobeBill,
  { ...sampleFigmaBill, dueDate: '2028-05-15', lastChargeDate: '2027-05-14' },
  { ...sampleAdobeBill, dueDate: '2028-06-16', lastChargeDate: '2027-06-17' },
];

/** The Bills card as the page draws it at 1440 (108): the content width, at least 420 high. */
function BillTableCard({ children }: { children: ReactNode }) {
  return (
    <div className={styles.billTableSample}>
      <Card padding="none" className={styles.billTableCard}>
        {children}
      </Card>
    </div>
  );
}

/** The Bills table with these bills, named as the page names it. */
function BillTableExample({ bills }: { bills: SampleBill[] }) {
  return (
    <BillTableCard>
      <BillTable bills={bills} label="Upcoming Bills" />
    </BillTableCard>
  );
}

/** The Upcoming Bill card as Overview draws it: 352 wide, inset 32, 24 and 28, at least 232 high. */
function BillsCard({ children }: { children: ReactNode }) {
  return (
    <div className={styles.sampleCard}>
      <Card padding="none" className={styles.billsCard}>
        {children}
      </Card>
    </div>
  );
}

/** A transaction as `GET /api/transactions/recent` sends it. */
type SampleTransaction = RecentTransactionRow;

const sampleTransaction = (
  item: string,
  shopName: string,
  category: SampleTransaction['category'],
  day: number,
  cents: number,
): SampleTransaction => ({
  item,
  shopName,
  category,
  direction: category === null ? 'income' : 'expense',
  occurredAt: `2026-10-${String(day).padStart(2, '0')}T12:00:00.000Z`,
  amount: usd(cents),
});

/** The demo expenses of a first login on 22 Oct 2026, newest first (demo-data.md). */
const sampleExpenses = [
  sampleTransaction('Jeans', 'Denim House', 'shopping', 22, 26600),
  sampleTransaction('Movie ticket', 'Inox', 'entertainment', 21, 1764),
  sampleTransaction('Pizza', 'Pizza Hit', 'food', 20, 2464),
  sampleTransaction('Taxi fare', 'Uber', 'transportation', 19, 1064),
  sampleTransaction('Restaurant bill', 'Spice Garden', 'food', 18, 14784),
];

/** The demo income of a first login on 22 Oct 2026, newest first. */
const sampleRevenue = [
  sampleTransaction('Freelance payment', 'Bright Studio', null, 17, 17920),
  sampleTransaction('Dividend', 'AB Bank Ltd', null, 15, 8400),
  sampleTransaction('Freelance payment', 'Bright Studio', null, 10, 17920),
  sampleTransaction('Freelance payment', 'Bright Studio', null, 3, 17920),
  sampleTransaction('Design project', 'Acme Ltd.', null, 1, 78400),
];

/** The three lists of a first login, as the backend sends them (task 016). */
const sampleRecent: RecentTransactionsResponse = {
  all: sampleExpenses,
  revenue: sampleRevenue,
  expenses: sampleExpenses,
};

/** A 120-character item and shop and the largest amount, for the wrap rule (#111 a; Marko's notes for task 016). */
const sampleLongTransaction = sampleTransaction(
  `Jeans ${'with a very long description '.repeat(5)}`.slice(0, 120),
  `Denim House ${'Flagship Store on the Main Street '.repeat(4)}`.slice(0, 120),
  'shopping',
  22,
  100000000000,
);

/** The Recent Transaction card as Overview draws it: 352 wide, inset 24, as high as its rows. */
function RecentCard({ children }: { children: ReactNode }) {
  return (
    <div className={styles.sampleCard}>
      <Card className={styles.recentCard}>{children}</Card>
    </div>
  );
}

/** The card on a local query that answers `answer`, never resolves (`pending`) or fails after a short wait. */
function RecentExample({ name, answer }: { name: string; answer: RecentTransactionsResponse | 'pending' | 'fails' }) {
  const query = useQuery({
    ...demoQuery,
    queryKey: ['gallery', 'recent-transaction', name],
    queryFn: () =>
      answer === 'pending'
        ? new Promise<RecentTransactionsResponse>(() => undefined)
        : answer === 'fails'
          ? waitThenFail<RecentTransactionsResponse>()
          : Promise.resolve(answer),
  });
  return (
    <RecentCard>
      <RecentTransaction query={query} />
    </RecentCard>
  );
}

/** One day of the weekly comparison as the backend sends it: this week's date, both weeks' cents, null after today. */
const comparisonDay = (date: string, lastWeek: number, thisWeek: number | null) => ({
  date,
  lastWeek: usd(lastWeek),
  thisWeek: thisWeek === null ? null : usd(thisWeek),
});

// Task 017: the Statistics samples as the backend sends them, ticks included, so the gallery computes nothing (#11).
const sampleWeek: WeeklyComparisonResponse = {
  days: [
    comparisonDay('2026-10-19', 5_880, 1_064),
    comparisonDay('2026-10-20', 1_064, 2_464),
    comparisonDay('2026-10-21', 2_016, 1_764),
    comparisonDay('2026-10-22', 32_200, 26_600),
    comparisonDay('2026-10-23', 1_478, null),
    comparisonDay('2026-10-24', 18_816, null),
    comparisonDay('2026-10-25', 14_784, null),
  ],
  ticks: [0, 10_000, 20_000, 30_000, 40_000].map(usd),
};

/** This week all 0: last week's gray bars only, the same ticks. */
const sampleQuietWeek: WeeklyComparisonResponse = {
  days: sampleWeek.days.map((day) => ({ ...day, thisWeek: day.thisWeek && usd(0) })),
  ticks: sampleWeek.ticks,
};

/** Every value 0: no ticks, the empty message (#55, #91 c). */
const sampleZeroWeek: WeeklyComparisonResponse = {
  days: sampleWeek.days.map(({ date, thisWeek }) => comparisonDay(date, 0, thisWeek === null ? null : 0)),
  ticks: null,
};

/** The Statistics card as Overview draws it at 1440 (728 wide, at least 260 high), on a local query. */
function StatisticsExample({ name, answer }: { name: string; answer: WeeklyComparisonResponse | 'pending' | 'fails' }) {
  const query = useQuery({
    ...demoQuery,
    queryKey: ['gallery', 'statistics', name],
    queryFn: () =>
      answer === 'pending'
        ? new Promise<WeeklyComparisonResponse>(() => undefined)
        : answer === 'fails'
          ? waitThenFail<WeeklyComparisonResponse>()
          : Promise.resolve(answer),
  });
  return (
    <div className={styles.sampleWide}>
      <Card className={styles.statisticsCard}>
        <Statistics query={query} />
      </Card>
    </div>
  );
}

/**
 * One category as `GET /api/expenses/breakdown` sends it: this month's total so far, its change (null without) and its
 * most recent items (task 024; Overview's card never shows them).
 */
const breakdownItem = (
  category: ExpenseCategory,
  cents: number,
  change: ExpensesBreakdownCategory['change'],
  recent: ExpenseLineItem[] = [],
): ExpensesBreakdownCategory => ({ category, total: usd(cents), change, recent });

const changeUp = (percent: number) => ({ percent, direction: 'up' }) as const;
const changeDown = (percent: number) => ({ percent, direction: 'down' }) as const;

// Task 018: the Expenses Breakdown samples as the backend sends them, changes included, so the gallery computes
// nothing (#11).
const sampleBreakdown: ExpensesBreakdownResponse = {
  categories: [
    breakdownItem('housing', 25_200, changeDown(17)),
    breakdownItem('food', 51_004, changeUp(7)),
    breakdownItem('transportation', 5_320, changeDown(32)),
    breakdownItem('entertainment', 28_224, changeUp(16)),
    breakdownItem('shopping', 65_800, changeUp(14)),
    breakdownItem('others', 13_832, changeDown(31)),
  ],
};

/** Last month $0.00 for every category: no percentage and no arrow (#21). */
const sampleNoLastMonth: ExpensesBreakdownResponse = {
  categories: [
    breakdownItem('housing', 23_750, null),
    breakdownItem('food', 27_379, null),
    breakdownItem('transportation', 3_611, null),
    breakdownItem('entertainment', 7_410, null),
    breakdownItem('shopping', 30_591, null),
    breakdownItem('others', 11_115, null),
  ],
};

/** No expenses in either month: six $0.00, still all shown (#61). */
const sampleNoExpenses: ExpensesBreakdownResponse = {
  categories: sampleBreakdown.categories.map(({ category }) => breakdownItem(category, 0, null)),
};

/** The Expenses Breakdown card as Overview draws it at 1440 (728 wide, inset 20 and 24, at least 212 high). */
function ExpensesBreakdownCard({ children }: { children: ReactNode }) {
  return (
    <div className={styles.sampleWide}>
      <Card padding="none" className={styles.expensesBreakdownCard}>
        {children}
      </Card>
    </div>
  );
}

/** The card's content on a local query that answers `answer`, never resolves (`pending`) or fails after a short wait. */
function ExpensesBreakdownExample({
  name,
  answer,
}: {
  name: string;
  answer: ExpensesBreakdownResponse | 'pending' | 'fails';
}) {
  const query = useQuery({
    ...demoQuery,
    queryKey: ['gallery', 'expenses-breakdown', name],
    queryFn: () =>
      answer === 'pending'
        ? new Promise<ExpensesBreakdownResponse>(() => undefined)
        : answer === 'fails'
          ? waitThenFail<ExpensesBreakdownResponse>()
          : Promise.resolve(answer),
  });
  return (
    <ExpensesBreakdownCard>
      <OverviewExpensesBreakdown query={query} />
    </ExpensesBreakdownCard>
  );
}

/** One item in the first of three columns, as wide as on Overview at 1440 (200). */
function ExpensesItemExample({ item }: { item: ExpensesBreakdownCategory }) {
  return (
    <ExpensesBreakdownCard>
      <ul className={styles.expensesItemList}>
        <ExpensesItem item={item} />
      </ul>
    </ExpensesBreakdownCard>
  );
}

/** A line item of an Expenses card as the backend sends it: every demo row at 12:00 UTC (task 024). */
const lineItem = (item: string, cents: number, date: string): ExpenseLineItem => ({
  item,
  amount: usd(cents),
  occurredAt: `${date}T12:00:00.000Z`,
});

const sampleHousingItems = [lineItem('Parking', 2_016, '2026-10-14'), lineItem('House Rent', 23_184, '2026-10-01')];
const sampleFoodItems = [lineItem('Pizza', 2_464, '2026-10-20'), lineItem('Restaurant bill', 14_784, '2026-10-18')];

/** A 120-character item name in words, and one with no space (task 024 AC23). */
const sampleLongItemInWords = 'Annual premium subscription renewal for the whole family '.repeat(3).slice(0, 120);
const sampleLongItemNoSpace = 'Annualpremiumsubscriptionrenewalforthewholefamily'.repeat(3).slice(0, 120);

// Task 024: the Expenses page's samples as the backend sends them, the ticks and the items included, so the gallery
// computes nothing (#11).
const sampleExpensesCards: ExpensesBreakdownResponse = {
  categories: [
    breakdownItem('housing', 25_200, changeDown(17), sampleHousingItems),
    breakdownItem('food', 51_004, changeUp(7), sampleFoodItems),
    breakdownItem('transportation', 5_320, changeDown(32), [
      lineItem('Taxi fare', 1_064, '2026-10-19'),
      lineItem('Taxi fare', 1_064, '2026-10-13'),
    ]),
    breakdownItem('entertainment', 28_224, changeUp(16), [
      lineItem('Movie ticket', 1_764, '2026-10-21'),
      lineItem('GTR 5', 18_816, '2026-10-17'),
    ]),
    breakdownItem('shopping', 65_800, changeUp(14), [
      lineItem('Jeans', 26_600, '2026-10-22'),
      lineItem('Shirt', 32_200, '2026-10-15'),
    ]),
    breakdownItem('others', 13_832, changeDown(31), [
      lineItem('Donation', 3_192, '2026-10-11'),
      lineItem('Loan installment', 10_640, '2026-10-10'),
    ]),
  ],
};

/** A month of the Expenses chart: this year's `YYYY-MM`, last year's value, this year's (null after the current one). */
const sampleMonth = (month: string, lastYear: number, thisYear: number | null) => ({
  month,
  lastYear: usd(lastYear),
  thisYear: thisYear === null ? null : usd(thisYear),
});

/** The demo first login's chart (task 024 References): 2025 against 2026 to October, the ticks $0 to $4k. */
const sampleYear: MonthlyComparisonResponse = {
  months: [
    sampleMonth('2026-01', 199_240, 206_616),
    sampleMonth('2026-02', 165_261, 171_383),
    sampleMonth('2026-03', 179_972, 186_636),
    sampleMonth('2026-04', 174_445, 180_909),
    sampleMonth('2026-05', 197_844, 204_616),
    sampleMonth('2026-06', 247_912, 255_026),
    sampleMonth('2026-07', 193_421, 200_588),
    sampleMonth('2026-08', 191_231, 198_312),
    sampleMonth('2026-09', 180_894, 187_595),
    sampleMonth('2026-10', 198_295, 189_380),
    sampleMonth('2026-11', 183_411, null),
    sampleMonth('2026-12', 234_036, null),
  ],
  ticks: [0, 100_000, 200_000, 300_000, 400_000].map(usd),
};

/** Every value of both years 0 (31 Dec 2021): no ticks, the empty message (#55, #91 c). */
const sampleZeroYear: MonthlyComparisonResponse = {
  months: sampleYear.months.map(({ month }) => sampleMonth(month.replace('2026', '2021'), 0, 0)),
  ticks: null,
};

/** A local query that answers `answer`, never resolves (`pending`) or fails after a short wait. */
function useSampleQuery<TData>(key: string[], answer: TData | 'pending' | 'fails') {
  return useQuery({
    ...demoQuery,
    queryKey: ['gallery', ...key],
    queryFn: () =>
      answer === 'pending'
        ? new Promise<TData>(() => undefined)
        : answer === 'fails'
          ? waitThenFail<TData>()
          : Promise.resolve(answer),
  });
}

/** The Expenses chart card as the page draws it at 1440 (the content's 1104, 260 high). */
function ExpensesComparisonExample({
  name,
  answer,
}: {
  name: string;
  answer: MonthlyComparisonResponse | 'pending' | 'fails';
}) {
  const query = useSampleQuery(['expenses-comparison', name], answer);
  return (
    <div className={styles.chartThreeCards}>
      <Card>
        <ExpensesComparison query={query} />
      </Card>
    </div>
  );
}

/** One Expenses card in the first of three columns, as wide as on the page at 1440 (352). */
function ExpensesCardExample({ item }: { item: ExpensesBreakdownCategory }) {
  return (
    <ul className={`${styles.chartThreeCards} ${styles.expensesCardList}`}>
      <ExpensesBreakdown item={item} />
    </ul>
  );
}

/** The Expenses cards' grid at 1440 on a local query. */
function ExpensesListExample({
  name,
  answer,
}: {
  name: string;
  answer: ExpensesBreakdownResponse | 'pending' | 'fails';
}) {
  const query = useSampleQuery(['expenses-cards', name], answer);
  return (
    <div className={styles.chartThreeCards}>
      <ExpensesBreakdownList query={query} />
    </div>
  );
}

/** A Transactions row as `GET /api/transactions` sends it: a Recent Transaction row with its Payment Method. */
const sampleRow = (transaction: SampleTransaction, paymentMethod: TransactionRow['paymentMethod']): TransactionRow => ({
  ...transaction,
  paymentMethod,
});

/** A first page of All as the backend sends it on 22 Oct 2026: the demo's newest 5 and 5 of its income (107). */
const sampleTransactionsPage: TransactionsPage = {
  transactions: [
    sampleRow(sampleExpenses[0]!, 'checking'),
    sampleRow(sampleExpenses[1]!, 'credit-card'),
    sampleRow(sampleExpenses[2]!, 'credit-card'),
    sampleRow(sampleExpenses[3]!, 'credit-card'),
    sampleRow(sampleExpenses[4]!, 'checking'),
    sampleRow(sampleRevenue[0]!, 'checking'),
    sampleRow(sampleRevenue[1]!, 'investment'),
    sampleRow(sampleRevenue[2]!, 'checking'),
    sampleRow(sampleRevenue[3]!, 'checking'),
    sampleRow(sampleRevenue[4]!, 'checking'),
  ],
  nextCursor: 'MjAyNi0xMC0wMVQxMjowMDowMC4wMDBaXzEw',
};

/** The Transactions card as the page draws it (107), with a label that names the table, as the selected tab does. */
function TransactionsCard({ children }: { children: (labelledBy: string) => ReactNode }) {
  const labelId = useId();
  return (
    <div className={styles.transactionsSample}>
      <p id={labelId} className={styles.transactionsLabel}>
        All
      </p>
      <Card padding="none">{children(labelId)}</Card>
    </div>
  );
}

/** The table on fixed pages: "Load More" here only adds the sample page again, as a stand-in for the next page. */
function TransactionTableExample({
  pages,
  loadingMore = false,
  loadMoreFailure = null,
}: {
  pages: TransactionsPage[];
  loadingMore?: boolean;
  loadMoreFailure?: number | null;
}) {
  const [shown, setShown] = useState(pages);
  return (
    <TransactionsCard>
      {(labelledBy) => (
        <TransactionTable
          pages={shown}
          labelledBy={labelledBy}
          loadingMore={loadingMore}
          loadMoreFailure={loadMoreFailure}
          onLoadMore={() => setShown([...shown, { ...sampleTransactionsPage, nextCursor: null }])}
        />
      )}
    </TransactionsCard>
  );
}

/** One Transactions row on its own, in the table as the page draws it at 1440. */
function TransactionItemExample({ row }: { row: TransactionRow }) {
  return <TransactionTableExample pages={[{ transactions: [row], nextCursor: null }]} />;
}

/** Checking's details as `GET /api/accounts/:accountId` sends them on 22 Oct 2026 (106, task 021). */
const sampleAccountDetails: AccountDetailsResponse = {
  accountType: 'checking',
  bankName: 'AB Bank Ltd',
  branchName: 'Park Street Branch',
  maskedNumber: '**** **** **** 7310',
  balance: usd(3_336_248),
};

/** A history row of Oct 2026 as the backend sends it, stored at 12:00 UTC. */
const sampleHistoryRow = (
  day: number,
  status: TransactionHistoryRow['status'],
  direction: TransactionHistoryRow['direction'],
  receipt: string,
  cents: number,
): TransactionHistoryRow => ({
  occurredAt: `2026-10-${String(day).padStart(2, '0')}T12:00:00.000Z`,
  status,
  direction,
  receipt,
  amount: usd(cents),
});

/** Checking's first page on 22 Oct 2026 (106, task 021 References). */
const sampleHistoryPage: TransactionHistoryPage = {
  transactions: [
    sampleHistoryRow(22, 'complete', 'expense', 'z7YBsODpLNW', 26_600),
    sampleHistoryRow(18, 'complete', 'expense', 'nPcvc24YHB7', 14_784),
    sampleHistoryRow(17, 'complete', 'income', 'SVqWhlvmJqw', 17_920),
    sampleHistoryRow(15, 'complete', 'expense', '5vSKgU8NCTh', 32_200),
    sampleHistoryRow(14, 'complete', 'expense', '93i3nSBYFAa', 2_016),
    sampleHistoryRow(12, 'complete', 'expense', 'UYdw2FRyetE', 5_880),
    sampleHistoryRow(11, 'complete', 'expense', 'UK5fQ9kfUyy', 3_192),
    sampleHistoryRow(10, 'complete', 'income', 'IhN8Byqe5aj', 17_920),
    sampleHistoryRow(7, 'complete', 'expense', 'nPAdhi6fo6A', 2_128),
    sampleHistoryRow(4, 'complete', 'expense', 'CrSNatgkImu', 28_336),
  ],
  nextCursor: 'MjAyNi0xMC0wNFQxMjowMDowMC4wMDBaXzEyOTA',
};

/** A 120-character receipt with no space, for the wrap rule. */
const longReceipt = 'Zq7XyWv3Ut9Sr5Qp1On8Ml4Kj2Ih6Gf0Ed'.repeat(4).slice(0, 120);

/** A white card as wide as Account Details' cards at 1440 (106), at least as high as the page draws it. */
function AccountDetailsSampleCard({ history = false, children }: { history?: boolean; children: ReactNode }) {
  return (
    <div className={styles.transactionsSample}>
      <Card padding="none" className={history ? styles.historySampleCard : styles.detailsSampleCard}>
        {children}
      </Card>
    </div>
  );
}

/** "Edit Details" in the gallery: no edit mode to open here (the page opens it, task 022). */
const noEdit = () => undefined;

/**
 * 106 edit mode on a sample account (task 022): Save checks the shared rule and shows its messages, but saves nothing
 * here (the page saves through the API); Cancel does nothing.
 */
function AccountDetailsFormExample({
  account = sampleAccountDetails,
  saving = false,
  formError,
}: {
  account?: AccountDetailsResponse;
  saving?: boolean;
  formError?: string;
}) {
  return (
    <AccountDetailsSampleCard>
      <AccountDetailsForm
        account={account}
        saving={saving}
        formError={formError}
        onSave={(_request, { onSettled }) => onSettled()}
        onCancel={noEdit}
      />
    </AccountDetailsSampleCard>
  );
}

/** The history table on fixed pages: "Load More" here only adds the sample page again, as a stand-in for the next. */
function TransactionsHistoryTableExample({
  pages,
  loadingMore = false,
  loadMoreFailure = null,
}: {
  pages: TransactionHistoryPage[];
  loadingMore?: boolean;
  loadMoreFailure?: number | null;
}) {
  const [shown, setShown] = useState(pages);
  return (
    <AccountDetailsSampleCard history>
      <TransactionsHistoryTable
        pages={shown}
        label="Transactions History"
        loadingMore={loadingMore}
        loadMoreFailure={loadMoreFailure}
        onLoadMore={() => setShown([...shown, { ...sampleHistoryPage, nextCursor: null }])}
      />
    </AccountDetailsSampleCard>
  );
}

/** One history row on its own, in the table as the page draws it at 1440. */
function TransactionsHistoryItemExample({ row }: { row: TransactionHistoryRow }) {
  return <TransactionsHistoryTableExample pages={[{ transactions: [row], nextCursor: null }]} />;
}

/** "Load More" on its own: a click shows the loading pattern. */
function LoadMoreExample({ loading = false, failure = null }: { loading?: boolean; failure?: number | null }) {
  const [clicked, setClicked] = useState(false);
  const { buttonRef, loadMore } = useLoadMore(0, () => setClicked(true));
  return (
    <div className={styles.loadMoreSample}>
      <LoadMore buttonRef={buttonRef} onClick={loadMore} loading={loading || clicked} failure={failure} />
    </div>
  );
}

/** One row on its own, in a card as wide as Overview's at 1440. */
function ItemCard({ transaction }: { transaction: SampleTransaction }) {
  return (
    <RecentCard>
      <ul className={styles.itemList}>
        <RecentTransactionItem transaction={transaction} divided={false} />
      </ul>
    </RecentCard>
  );
}

/** A top row card as Overview draws it (Total Balance, Goals): 352 wide, inset 20 and 24, at least 232 high. */
function TopRowCard({ children }: { children: ReactNode }) {
  return (
    <div className={styles.sampleCard}>
      <Card padding="none" className={styles.topRowCard}>
        {children}
      </Card>
    </div>
  );
}

/** The Savings Goal card as Goals draws it at 1440: 368 wide, inset 20 at the top and 24 at the sides and the bottom. */
function SavingsGoalCard({ children }: { children: ReactNode }) {
  return (
    <div className={styles.savingsGoalSample}>
      <Card padding="none" className={styles.savingsGoalCard}>
        {children}
      </Card>
    </div>
  );
}

/** A sample month's goal: the demo Target and a Present that changes with the month, so a pick shows. */
const sampleMonthGoal = (month: string): SavingsGoalResponse =>
  month === '2026-10' ? sampleGoal(2000000, 1625000, 0.8125) : { ...sampleGoal(2000000, 1100000, 0.55), month };

/**
 * The Savings Goal card on local queries: the months as `months` answers them, each month's goal as `goal` does
 * (`sample`: the demo goal of Oct 2026, then $11,000.00 for every other month; `none`: no goal). The selection as
 * GoalsPage keeps it: the newest month until one is picked.
 */
function SavingsGoalExample({
  name,
  months,
  goal,
}: {
  name: string;
  months: SavingsGoalMonthsResponse | 'pending' | 'fails';
  goal: 'sample' | 'none' | 'pending' | 'fails';
}) {
  const monthsQuery = useSampleQuery(['savings-goal-months', name], months);
  const [picked, setPicked] = useState<string | null>(null);
  const list = monthsQuery.data?.months;
  const selected = list === undefined ? undefined : picked !== null && list.includes(picked) ? picked : list[0];
  const goalQuery = useQuery({
    ...demoQuery,
    queryKey: ['gallery', 'savings-goal', name, selected],
    queryFn: () =>
      goal === 'pending'
        ? new Promise<SavingsGoalResponse>(() => undefined)
        : goal === 'fails'
          ? waitThenFail<SavingsGoalResponse>()
          : Promise.resolve(goal === 'none' ? { month: selected!, goal: null } : sampleMonthGoal(selected!)),
    enabled: selected !== undefined,
  });
  return (
    <SavingsGoalCard>
      <SavingsGoal
        months={monthsQuery}
        selected={selected}
        onSelect={setPicked}
        onPopupOpenChange={() => undefined}
        goal={goalQuery}
      />
    </SavingsGoalCard>
  );
}

/** A month's days for the Saving Summary samples: this month's values in cents (null after today), the month before's. */
function savingDays(month: string, thisMonth: (number | null)[], lastMonth: (number | null)[]): SavingSummaryDay[] {
  return thisMonth.map((value, index) => ({
    date: `${month}-${String(index + 1).padStart(2, '0')}`,
    thisMonth: value === null ? null : usd(value),
    lastMonth: lastMonth[index] === undefined || lastMonth[index] === null ? null : usd(lastMonth[index]),
  }));
}

const usdTicks = (ticks: number[]) => ticks.map(usd);

/** October 2026 at the fixed clock (the demo data, task 026): to the 22nd, against September's 30 days. */
const octoberSavings = [
  55216, -2800, 16856, -28336, -1478, -1764, -2128, -2464, -4200, 7280, -3192, -5880, -1064, -2016, -23800, -1478, -896,
  -14784, -1064, -2464, -1764, -26600,
];
const septemberSavings = [
  52640, -2352, 16800, -24472, -1277, -1428, -2240, -2128, -3528, 4480, -4032, -4760, -1120, -2240, -18648, -1277, 2688,
  -12768, -1120, -2128, -1428, -22344, -1277, 15232, -1120, -2352, 48160, 2352, -1120, -1428,
];
const sampleSavingSummary: SavingSummaryResponse = {
  month: '2026-10',
  days: savingDays('2026-10', [...octoberSavings, ...Array<null>(9).fill(null)], septemberSavings),
  ticks: usdTicks([-30000, -15000, 0, 15000, 30000, 45000, 60000]),
};

/** June 2022 against May (the demo data): the 17th -$574.20, 10 labels, the most in the dataset. */
const juneSavingSummary: SavingSummaryResponse = {
  month: '2022-06',
  days: savingDays(
    '2022-06',
    [
      43557, -2280, 14392, -19665, -1026, -1568, -1615, -1710, -3420, 4750, -3135, -5225, -808, -1995, -19095, -1026,
      -57420, -10260, -808, -1710, -1568, -21660, -1026, 13110, -808, -2280, 40755, 2090, -808, -1568,
    ],
    [
      44650, -1900, 14250, -21850, -1140, -1425, -1900, -1900, -2850, 5700, -2850, -4750, -950, -16900, -14725, -1140,
      0, -11400, -950, -1900, -1425, -18050, -1140, 13300, -950, -1900, 40850, 1900, -950, -1425,
    ],
  ),
  ticks: usdTicks([-62500, -50000, -37500, -25000, -12500, 0, 12500, 25000, 37500, 50000]),
};

/** No day above $0 (#72): every day an expense or nothing, the lowest -$283.36; $0 at the top and 4 steps down. */
const belowZeroSavings = [
  -1478, -2800, -16856, -28336, -1478, -1764, -2128, -2464, -4200, 0, -3192, -5880, -1064, -2016, -23800, -1478, -896,
  -14784, -1064, -2464, -1764, -26600,
];
const belowZeroSavingSummary: SavingSummaryResponse = {
  month: '2026-10',
  days: savingDays(
    '2026-10',
    [...belowZeroSavings, ...Array<null>(9).fill(null)],
    [...belowZeroSavings, -1277, 0, -1120, -2352, 0, 0, -1120, -1428],
  ),
  ticks: usdTicks([-40000, -30000, -20000, -10000, 0]),
};

/** 1 Nov at 2026-10-31T23:30:00Z in Belgrade: one teal value, against October's 1st to 30th. */
const lonePointSavingSummary: SavingSummaryResponse = {
  month: '2026-11',
  days: savingDays(
    '2026-11',
    [51352, ...Array<null>(29).fill(null)],
    [...octoberSavings, -1478, 15792, -1064, -2800, 48384, 2016, -1064, -1764],
  ),
  ticks: usdTicks([-30000, -15000, 0, 15000, 30000, 45000, 60000]),
};

/** February 2026 against January (the demo data): 28 days, so no label on the 30th. */
const februarySavingSummary: SavingSummaryResponse = {
  month: '2026-02',
  days: savingDays(
    '2026-02',
    [
      53928, -1904, 16800, -24472, -1277, -1512, -2240, -2128, -2856, 6160, -3528, -5040, -1120, -2128, -13496, -1277,
      1792, -12768, -1120, -2128, -1512, -18088, -1277, 15568, -1120, -1904, 48272, 2352,
    ],
    [
      52640, -2576, 16856, -28336, -1478, -2016, -2128, -2464, -3864, 7840, -3024, -6720, -1064, -2240, -21224, -1478,
      -3584, -14784, -1064, -2464, -2016, -24472, -1478, 15904, -1064, -2576, 48160, 2016,
    ],
  ),
  ticks: usdTicks([-30000, -15000, 0, 15000, 30000, 45000, 60000]),
};

/** Every value of both lines $0: the empty state (#124 e). */
const emptySavingSummary: SavingSummaryResponse = {
  month: '2026-10',
  days: savingDays(
    '2026-10',
    Array.from({ length: 31 }, (_, index) => (index < 22 ? 0 : null)),
    Array.from({ length: 30 }, () => 0),
  ),
  ticks: null,
};

/** The Saving Summary card as Goals draws it at 1440: the top row's second column, 712 wide, inset 20, 24 and 24. */
function SavingSummaryCard({ children, narrow = false }: { children: ReactNode; narrow?: boolean }) {
  if (narrow) {
    return (
      <div className={styles.savingSummaryNarrow}>
        <Card padding="none" className={styles.savingSummaryCard}>
          {children}
        </Card>
      </div>
    );
  }
  return (
    <div className={styles.savingsGoalSample}>
      <div />
      <Card padding="none" className={styles.savingSummaryCard}>
        {children}
      </Card>
    </div>
  );
}

/**
 * The Saving Summary card on local queries: the months as `months` answers them, the summary as `summary` does
 * (`sample`: October's demo answer for every month). Its own selection, as GoalsPage keeps it.
 */
function SavingSummaryExample({
  name,
  months,
  summary,
  narrow = false,
}: {
  name: string;
  months: SavingsGoalMonthsResponse | 'pending' | 'fails';
  summary: SavingSummaryResponse | 'pending' | 'fails';
  /** One card wide (352): too narrow for the header row, so the legend moves under it (#108 b). */
  narrow?: boolean;
}) {
  const monthsQuery = useSampleQuery(['saving-summary-months', name], months);
  const [picked, setPicked] = useState<string | null>(null);
  const list = monthsQuery.data?.months;
  const selected = list === undefined ? undefined : picked !== null && list.includes(picked) ? picked : list[0];
  const summaryQuery = useQuery({
    ...demoQuery,
    queryKey: ['gallery', 'saving-summary', name, selected],
    queryFn: () =>
      summary === 'pending'
        ? new Promise<SavingSummaryResponse>(() => undefined)
        : summary === 'fails'
          ? waitThenFail<SavingSummaryResponse>()
          : Promise.resolve(summary),
    enabled: selected !== undefined,
  });
  return (
    <SavingSummaryCard narrow={narrow}>
      <SavingSummary months={monthsQuery} selected={selected} onSelect={setPicked} summary={summaryQuery} />
    </SavingSummaryCard>
  );
}

/** A first login's limits as `GET /api/category-limits` sends them: $250.00 for each of the six (demo-data.md). */
const sampleCategoryLimits: CategoryLimitsResponse = {
  limits: expenseCategorySchema.options.map((category) => ({ category, limit: { cents: 25_000, currency: 'USD' } })),
};

/** One category card as Goals draws it at 1440: a 352 wide `Card`, at least 104 high, its content centred. */
function GoalItemCard({ item }: { item: CategoryLimit }) {
  return (
    <div className={styles.sampleCard}>
      <Card className={styles.goalItemCard}>
        <GoalItem item={item} />
      </Card>
    </div>
  );
}

/** The category cards on a local query, as the page's grid at 1440 (three 352 cards). */
function GoalItemListExample({ name, answer }: { name: string; answer: CategoryLimitsResponse | 'pending' | 'fails' }) {
  const query = useSampleQuery(['category-limits', name], answer);
  return (
    <div className={styles.chartThreeCards}>
      <GoalItemList query={query} />
    </div>
  );
}

/** The chart alone in the card's content box at 1440 (664 wide). */
function SavingSummaryChartSample({ answer }: { answer: SavingSummaryResponse }) {
  return (
    <SavingSummaryCard>
      <SavingSummaryChart
        title="Savings per day, this month and the same period last month"
        days={answer.days}
        ticks={answer.ticks ?? []}
      />
    </SavingSummaryCard>
  );
}

/** The carousel control with its own position, so Previous and Next can be tried. */
function SliderOptionExample({ count, start = 0 }: { count: number; start?: number }) {
  const [position, setPosition] = useState(start);
  return (
    <SliderOption
      count={count}
      position={position}
      onPrevious={() => setPosition(position - 1)}
      onNext={() => setPosition(position + 1)}
    />
  );
}

/**
 * Development-only page with every shared component in every state (/dev/components). Each later
 * shared-component task adds its section; test/app/gallery.test.tsx checks that every component has one.
 */
export function ComponentGallery() {
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Component gallery</h1>
      <p className={styles.note}>Development only. Focus a field for the Active style (#63).</p>

      <GallerySection name="Input">
        <Example name="Name-Email, empty">
          <Input label="Email Address" type="email" />
        </Example>
        <Example name="Name-Email, placeholder">
          <Input label="Email Address" type="email" placeholder="hello@example.com" />
        </Example>
        <Example name="Name-Email, filled">
          <Input label="Email Address" type="email" defaultValue="johndoe@email.com" />
        </Example>
        <Example name="Name, filled">
          <Input label="Name" defaultValue="Tanzir Rahman" />
        </Example>
        <Example name="Password, masked, with label action">
          <Input
            label="Password"
            type="password"
            defaultValue="password123456"
            labelAction={<a href="#forgot-password">Forgot Password?</a>}
          />
        </Example>
        <Example name="Show Password">
          <ShowPasswordExample />
        </Example>
        <Example name="Field error">
          <Input label="Email Address" type="email" error="Email is required" />
        </Example>
      </GallerySection>

      <GallerySection name="ButtonPrimary">
        <Example name="Default">
          <ButtonPrimary>Login</ButtonPrimary>
        </Example>
        <Example name="Disabled">
          <ButtonPrimary disabled>Login</ButtonPrimary>
        </Example>
        <Example name="Loading">
          <ButtonPrimary loading>Login</ButtonPrimary>
        </Example>
      </GallerySection>

      <GallerySection name="ButtonSecondary">
        <Example name="With icon">
          <ButtonSecondary icon={<img src={googleUrl} alt="" />}>Continue with Google</ButtonSecondary>
        </Example>
        <Example name="Without icon">
          <ButtonSecondary>Continue with Google</ButtonSecondary>
        </Example>
      </GallerySection>

      <GallerySection name="RemindMe">
        <Example name="Checked">
          <RemindMe label="Keep me signed in" defaultChecked />
        </Example>
        <Example name="Unchecked">
          <RemindMe label="Keep me signed in" />
        </Example>
      </GallerySection>

      <GallerySection name="FieldError">
        <Example name="Message">
          <FieldError>Email is required</FieldError>
        </Example>
      </GallerySection>

      <GallerySection name="FormError">
        <Example name="Message">
          <FormError>Email or password is incorrect</FormError>
        </Example>
      </GallerySection>

      <GallerySection name="FormSuccess">
        <Example name="Message (#52, not designed)">
          <FormSuccess>Profile updated</FormSuccess>
        </Example>
      </GallerySection>

      <GallerySection name="SettingsInput">
        <Example name="Filled (111)">
          <Card>
            <SettingsInput label="Full name" defaultValue="Tanzir Rahman" />
          </Card>
        </Example>
        <Example name="Read-only, like Email">
          <Card>
            <SettingsInput label="Email" readOnly value="tanzir.rahman@email.com" />
          </Card>
        </Example>
        <Example name="Field error, no border">
          <Card>
            <SettingsInput label="Username" defaultValue="ta" error="Username must be at least 3 characters" />
          </Card>
        </Example>
      </GallerySection>

      <GallerySection name="SettingsPhoneInput">
        <Example name="Like 111: +880 and the number">
          <Card>
            <SettingsPhoneInput countryCode="+880" onCountryCodeChange={keepSelection} defaultValue="5154758868" />
          </Card>
        </Example>
        <Example name="A new user: +1 and no number">
          <Card>
            <SettingsPhoneInput countryCode="+1" onCountryCodeChange={keepSelection} defaultValue="" />
          </Card>
        </Example>
        <Example name="Field error">
          <Card>
            <SettingsPhoneInput
              countryCode="+1"
              onCountryCodeChange={keepSelection}
              defaultValue="064a123"
              numberError="Phone Number can only contain digits"
            />
          </Card>
        </Example>
      </GallerySection>

      <GallerySection name="ProfilePhotoUpload">
        <Example name="Empty, visual only (111)">
          <Card>
            <ProfilePhotoUpload />
          </Card>
        </Example>
      </GallerySection>

      <GallerySection name="ProfileForm" wide>
        <Example name="Prefilled (111)">
          <ProfileFormExample />
        </Example>
        <Example name="Field errors: Save changes checks the shared rule (after a change)">
          <ProfileFormExample profile={{ ...sampleProfile, fullName: '   ', username: 'Ta', phoneNumber: '064a123' }} />
        </Example>
        <Example name="Saving">
          <ProfileFormExample saving />
        </Example>
        <Example name="The server error above the button">
          <ProfileFormExample formError="Something went wrong." />
        </Example>
        <Example name={'"Profile updated"'}>
          <ProfileFormExample updated />
        </Example>
        <Example name="A 100-character name, on one line in its field">
          <ProfileFormExample profile={{ ...sampleProfile, fullName: 'Ana Marija '.repeat(10).slice(0, 100) }} />
        </Example>
      </GallerySection>

      <GallerySection name="ProfileFormSkeleton" wide>
        <Example name="Loading">
          <Card>
            <ProfileFormSkeleton />
          </Card>
        </Example>
      </GallerySection>

      <GallerySection name="Spinner">
        <Example name="Default">
          <Spinner />
        </Example>
      </GallerySection>

      <GallerySection name="TextDivider">
        <Example name="Sign in">
          <TextDivider>or sign in with</TextDivider>
        </Example>
        <Example name="Sign up">
          <TextDivider>or sign up with</TextDivider>
        </Example>
      </GallerySection>

      <GallerySection name="AuthLayout" wide>
        <Example name="Page frame">
          <AuthLayout className={styles.authOffset}>
            <p className={styles.note}>The screen content goes here.</p>
          </AuthLayout>
        </Example>
      </GallerySection>

      <GallerySection name="NavMenu">
        <Example name="Active">
          <SidebarPanel>
            {navSections.map((section) => (
              <NavMenu key={section} section={section} active />
            ))}
          </SidebarPanel>
        </Example>
        <Example name="Inactive">
          <SidebarPanel>
            {navSections.map((section) => (
              <NavMenu key={section} section={section} />
            ))}
          </SidebarPanel>
        </Example>
        <Example name="Hover">
          <p className={styles.note}>Point at an item: Inactive items show Hover, as in the Figma component set.</p>
          <SidebarPanel>
            {navSections.map((section) => (
              <NavMenu key={section} section={section} />
            ))}
          </SidebarPanel>
        </Example>
      </GallerySection>

      <GallerySection name="Logout">
        <Example name="Default">
          <SidebarPanel>
            <Logout onLogout={noLogout} />
          </SidebarPanel>
        </Example>
      </GallerySection>

      <GallerySection name="Avatar">
        <Example name="Photo">
          <SidebarPanel>
            <Avatar fullName="Tanzir Rahman" photoUrl={sampleAvatarUrl} />
          </SidebarPanel>
        </Example>
        <Example name="Initials, two words">
          <SidebarPanel>
            <Avatar fullName="Tanzir Rahman" />
          </SidebarPanel>
        </Example>
        <Example name="Initials, one word">
          <SidebarPanel>
            <Avatar fullName="Marko" />
          </SidebarPanel>
        </Example>
      </GallerySection>

      <GallerySection name="Profile">
        <Example name="With photo">
          <SidebarPanel>
            <Profile fullName="Tanzir Rahman" photoUrl={sampleAvatarUrl} />
          </SidebarPanel>
        </Example>
        <Example name="Initials, two words">
          <SidebarPanel>
            <Profile fullName="Tanzir Rahman" />
          </SidebarPanel>
        </Example>
        <Example name="Initials, one word">
          <SidebarPanel>
            <Profile fullName="Marko" />
          </SidebarPanel>
        </Example>
      </GallerySection>

      <GallerySection name="NavBar">
        <Example name="Overview active">
          <NavBar activeSection="overview" fullName="Tanzir Rahman" onLogout={noLogout} />
        </Example>
      </GallerySection>

      <GallerySection name="HeaderSearch">
        <Example name="Empty">
          <HeaderSearch />
        </Example>
      </GallerySection>

      <GallerySection name="Header" wide>
        <Example name="With greeting">
          <div className={styles.headerFrame}>
            <Header greetingName="Tanzir" today="2023-05-19" />
          </div>
        </Example>
        <Example name="Without greeting">
          <div className={styles.headerFrame}>
            <Header today="2023-05-19" />
          </div>
        </Example>
      </GallerySection>

      <GallerySection name="AppLayout" wide>
        <Example name="Like 104: Overview active, with greeting">
          <AppLayout
            navBar={<NavBar activeSection="overview" fullName="Tanzir Rahman" onLogout={noLogout} />}
            header={<Header greetingName="Tanzir" today="2023-05-19" />}
          >
            <TallContent />
          </AppLayout>
        </Example>
        <Example name="Like 105: Balances active, no greeting">
          <AppLayout
            navBar={<NavBar activeSection="balances" fullName="Tanzir Rahman" onLogout={noLogout} />}
            header={<Header today="2023-05-19" />}
          >
            <TallContent />
          </AppLayout>
        </Example>
      </GallerySection>

      <GallerySection name="Section" wide>
        <Example name="Plain, like 104 Total Balance">
          <div className={styles.sampleCard}>
            <Section title="Total Balance" gap="sm">
              <Card>
                <p className={styles.panelText}>Card content</p>
              </Card>
            </Section>
          </div>
        </Example>
        <Example name="With View All, like 104 Upcoming Bill">
          <div className={styles.sampleCard}>
            <Section title="Upcoming Bill" gap="sm" viewAllTo={paths.bills}>
              <Card>
                <p className={styles.panelText}>Card content</p>
              </Card>
            </Section>
          </div>
        </Example>
        <Example name="With the note, like 104 Expenses Breakdown">
          <div className={styles.sampleWide}>
            <Section title="Expenses Breakdown" gap="sm" note="*Compare to last month">
              <Card>
                <p className={styles.panelText}>Card content</p>
              </Card>
            </Section>
          </div>
        </Example>
        <Example name="16px gap, like 105 Balances">
          <div className={styles.sampleCard}>
            <Section title="Balances" gap="lg">
              <Card>
                <p className={styles.panelText}>Card content</p>
              </Card>
            </Section>
          </div>
        </Example>
      </GallerySection>

      <GallerySection name="Card">
        <Example name="Default">
          <Card>
            <p className={styles.panelText}>Content with the 24px card padding</p>
          </Card>
        </Example>
        <Example name="No padding">
          <Card padding="none">
            <p className={styles.panelText}>Content that sets its own insets</p>
          </Card>
        </Example>
      </GallerySection>

      <GallerySection name="MenuTab">
        <Example name="All active">
          <TabsExample id="tabs-all" value="all" />
        </Example>
        <Example name="Revenue active">
          <TabsExample id="tabs-income" value="income" />
        </Example>
        <Example name="Expenses active">
          <TabsExample id="tabs-expense" value="expense" />
        </Example>
        <Example name="Interactive">
          <TabsExample id="tabs-interactive" value="all" interactive />
        </Example>
        <Example name="Settings: Account active (111)">
          <SettingsTabsExample />
        </Example>
      </GallerySection>

      <GallerySection name="CategoryIcon">
        <Example name="Recent Transaction (104)">
          <Card>
            <CategoryIcons variant="recent" />
          </Card>
        </Example>
        <Example name="Expenses Breakdown (104)">
          <Card>
            <CategoryIcons variant="breakdown" />
          </Card>
        </Example>
        <Example name="Card header (109)">
          <div className={styles.cardHeader}>
            <CategoryIcons variant="header" />
          </div>
        </Example>
        <Example name="Goals (110)">
          <Card>
            <CategoryIcons variant="goal" />
          </Card>
        </Example>
        <Example name="Table row (107)">
          <Card>
            <CategoryIcons variant="plain" />
          </Card>
        </Example>
      </GallerySection>

      <GallerySection name="DateBox">
        <Example name="Compact (104)">
          <Card className={styles.boxRow}>
            <DateBox date="2023-05-15" size="compact" />
            <DateBox date="2023-06-16" size="compact" />
            <DateBox date="2023-09-05" size="compact" />
          </Card>
        </Example>
        <Example name="Large (108)">
          <Card className={styles.boxRow}>
            <DateBox date="2023-05-15" size="large" />
            <DateBox date="2023-06-16" size="large" />
            <DateBox date="2023-09-05" size="large" />
          </Card>
        </Example>
      </GallerySection>

      <GallerySection name="AmountBox">
        <Example name="Compact (104)">
          <Card className={styles.boxColumn}>
            <AmountBox amount={usd(15000)} size="compact" />
            <AmountBox amount={usd(55900)} size="compact" />
            {/* A slot as narrow as the smallest box: the long amount widens past it and stays on one line. */}
            <div className={styles.narrowSlot}>
              <AmountBox amount={usd(100000000000)} size="compact" />
            </div>
          </Card>
        </Example>
        <Example name="Large (108)">
          <Card className={styles.boxColumn}>
            <AmountBox amount={usd(15000)} size="large" />
            <AmountBox amount={usd(55900)} size="large" />
            {/* A slot as narrow as the smallest box: the long amount widens past it and stays on one line. */}
            <div className={styles.narrowSlot}>
              <AmountBox amount={usd(100000000000)} size="large" />
            </div>
          </Card>
        </Example>
      </GallerySection>

      <GallerySection name="ButtonSmall">
        <Example name="Default">
          <ButtonSmall>Details</ButtonSmall>
        </Example>
      </GallerySection>

      <GallerySection name="Skeleton">
        <Example name="Shapes: text, block, circle">
          <Card className={styles.boxRow}>
            <Skeleton shape="text" className={styles.skeletonTitle} />
            <Skeleton shape="block" className={styles.skeletonTile} />
            <Skeleton shape="circle" className={styles.skeletonCircle} />
          </Card>
        </Example>
        <Example name="A list, like 104 Recent Transaction">
          <Card>{listSkeleton}</Card>
        </Example>
      </GallerySection>

      <GallerySection name="DataState" wide>
        <Example name="Loading">
          <div className={styles.sampleCard}>
            <DataStateLoading />
          </div>
        </Example>
        <Example name="Empty">
          <div className={styles.sampleCard}>
            <DataStateEmpty />
          </div>
        </Example>
        <Example name="Error">
          <div className={styles.sampleCard}>
            <DataStateError />
          </div>
        </Example>
        <Example name="Ready">
          <div className={styles.sampleCard}>
            <DataStateReady />
          </div>
        </Example>
        <Example name="Background refetch fails: the data stays">
          <div className={styles.sampleCard}>
            <BackgroundRefetchFails />
          </div>
        </Example>
        <Example name="Error boundary: one widget breaks, the other keeps working">
          <div className={styles.sampleWide}>
            <ErrorBoundaryDemo />
          </div>
        </Example>
      </GallerySection>
      <GallerySection name="Popup">
        <Example name="Over the app shell">
          <p className={styles.panelText}>
            The popup dims the content area of the real app shell, so it has its own page.{' '}
            <Link className={styles.devLink} to="/dev/popup">
              Open /dev/popup
            </Link>
          </p>
        </Example>
      </GallerySection>

      <GallerySection name="GoalPopupInput">
        <Example name="104.1, 110.1 and 110.2">
          <p className={styles.panelText}>
            The two-field and the one-field popup, with Save, saving and the server error.{' '}
            <Link className={styles.devLink} to="/dev/popup">
              Open /dev/popup
            </Link>
          </p>
        </Example>
      </GallerySection>

      <GallerySection name="PopupInputSmall" wide>
        <Example name="Prefilled 500000">
          <div className={styles.popupSurface}>
            <PopupInputSmall label="Target Amounts" defaultValue={formatAmountInput(50000000)} />
          </div>
        </Example>
        <Example name="Prefilled 1250.50">
          <div className={styles.popupSurface}>
            <PopupInputSmall label="Target Amounts" defaultValue={formatAmountInput(125050)} />
          </div>
        </Example>
        <Example name="Empty, no placeholder (Target)">
          <div className={styles.popupSurface}>
            <PopupInputSmall label="Target Amounts" />
          </div>
        </Example>
        <Example name="Empty, with the placeholder (Present)">
          <div className={styles.popupSurface}>
            <PopupInputSmall label="Present Amounts" placeholder="Write present amount here" />
          </div>
        </Example>
        <Example name="With an error">
          <div className={styles.popupSurface}>
            <PopupInputSmall label="Target Amounts" error="Enter a target amount" />
          </div>
        </Example>
        <Example name="Interactive: the cents read from the text">
          <div className={styles.popupSurface}>
            <InteractiveAmount />
          </div>
        </Example>
      </GallerySection>

      <GallerySection name="Dropdown">
        <Example name="box, like 110 Savings Goal">
          <Card>
            <DropdownExample variant="box" options={monthOptions(12)} initial="2026-03" label="Savings Goal month" />
          </Card>
        </Example>
        <Example name="plain, like 110 Saving Summary">
          <Card>
            <DropdownExample
              variant="plain"
              options={monthOptions(12)}
              initial="2026-03"
              label="Saving Summary month"
            />
          </Card>
        </Example>
        <Example name="inline, like 111 country code">
          <Card>
            <div className={styles.inlineField}>
              <DropdownExample variant="inline" options={countryCodes} initial="+880" label="Country code" />
            </div>
          </Card>
        </Example>
        <Example name="input, Account Type (#26, not designed)">
          <Card>
            <DropdownExample variant="input" options={accountTypes} initial="checking" label="Account Type" />
          </Card>
        </Example>
        <Example name="input with a visible label (task 022, the id prop)">
          <Card>
            <LabelledDropdownExample />
          </Card>
        </Example>
        <Example name="comparison, like 104 Statistics">
          <Card>
            <DropdownExample
              variant="comparison"
              options={[{ value: 'weekly', label: 'Weekly Comparison' }]}
              initial="weekly"
              label="Statistics"
            />
          </Card>
        </Example>
        <Example name="60 months">
          <Card>
            <DropdownExample variant="box" options={monthOptions(60)} initial="2026-10" label="Month" />
          </Card>
        </Example>
      </GallerySection>

      <GallerySection name="ChartLegend">
        <Example name="This week / Last week (104)">
          <Card>
            <ChartLegend current="This week" previous="Last week" />
          </Card>
        </Example>
        <Example name="This year / Last year (109)">
          <Card>
            <ChartLegend current="This year" previous="Last year" />
          </Card>
        </Example>
      </GallerySection>

      <GallerySection name="ComparisonBarChart" wide>
        <Example name="Statistics sample, like 104">
          <div className={styles.chartTwoCards}>
            <StatisticsCard>{drawChart(statisticsSample)}</StatisticsCard>
          </div>
        </Example>
        <Example name="Expenses sample, like 109">
          <div className={styles.chartThreeCards}>
            <ChartCard control="Monthly Comparison" current="This year" previous="Last year">
              {drawChart(expensesSample)}
            </ChartCard>
          </div>
        </Example>
        <Example name="Loading">
          <div className={styles.chartTwoCards}>
            <ChartLoading />
          </div>
        </Example>
        <Example name="All zero">
          <div className={styles.chartTwoCards}>
            <ChartAllZero />
          </div>
        </Example>
        <Example name="Error">
          <div className={styles.chartTwoCards}>
            <ChartError />
          </div>
        </Example>
        <Example name="Ready">
          <div className={styles.chartTwoCards}>
            <ChartReady />
          </div>
        </Example>
        <Example name="Background refetch fails: the chart stays">
          <div className={styles.chartTwoCards}>
            <ChartRefetchFails />
          </div>
        </Example>
      </GallerySection>

      <GallerySection name="ComparisonBarChartSkeleton" wide>
        <Example name="7 groups (104)">
          <div className={styles.chartTwoCards}>
            <Card>
              <div className={styles.chartBox}>
                <ComparisonBarChartSkeleton groups={7} />
              </div>
            </Card>
          </div>
        </Example>
        <Example name="12 groups (109)">
          <div className={styles.chartThreeCards}>
            <Card>
              <div className={styles.chartBox}>
                <ComparisonBarChartSkeleton groups={12} />
              </div>
            </Card>
          </div>
        </Example>
      </GallerySection>

      <GallerySection name="TargetVsAchievementMeter">
        <Example name="$12,500 of $20,000 (104)">
          <GaugeExample present={1250000} target={2000000} progress={0.625} />
        </Example>
        <Example name="$16,250 of $20,000 (demo)">
          <GaugeExample present={1625000} target={2000000} progress={0.8125} />
        </Example>
        <Example name="$0 of $20,000">
          <GaugeExample present={0} target={2000000} progress={0} />
        </Example>
        <Example name="$25,000 of $20,000, over-achieved">
          <GaugeExample present={2500000} target={2000000} progress={1} />
        </Example>
        <Example name="$1,000,000,000 of $1,000,000,000">
          <GaugeExample present={100000000000} target={100000000000} progress={1} />
        </Example>
      </GallerySection>

      <GallerySection name="TotalBalance" wide>
        <Example name="The demo accounts (104), from the first">
          <TopRowCard>
            <TotalBalance data={sampleAccounts} />
          </TopRowCard>
        </Example>
        <Example name="One account: both buttons disabled">
          <TopRowCard>
            <TotalBalance data={{ totalBalance: usd(2101918), accounts: sampleAccounts.accounts.slice(0, 1) }} />
          </TopRowCard>
        </Example>
      </GallerySection>

      <GallerySection name="AccountTypeSlide" wide>
        {sampleAccounts.accounts.slice(0, 3).map((account, index) => (
          <Example
            key={account.id}
            name={`${account.maskedNumber.slice(-4)}: ${account.cardNetwork ?? 'no card network'}`}
          >
            <div className={styles.slideSample}>
              <AccountTypeSlide account={account} label={`Account ${index + 1} of 5`} />
            </div>
          </Example>
        ))}
        <Example name="A narrow column: the balance wraps under the number (#106)">
          <div className={styles.slideSampleNarrow}>
            <AccountTypeSlide account={sampleAccounts.accounts[1]!} label="Account 2 of 5" />
          </div>
        </Example>
      </GallerySection>

      <GallerySection name="SliderOption" wide>
        <Example name="First of 5: Previous disabled">
          <div className={styles.slideSample}>
            <SliderOptionExample count={5} />
          </div>
        </Example>
        <Example name="Last of 5: Next disabled">
          <div className={styles.slideSample}>
            <SliderOptionExample count={5} start={4} />
          </div>
        </Example>
        <Example name="One account: both disabled">
          <div className={styles.slideSample}>
            <SliderOptionExample count={1} />
          </div>
        </Example>
      </GallerySection>

      <GallerySection name="TotalBalanceSkeleton" wide>
        <Example name="Loading">
          <TopRowCard>
            <TotalBalanceSkeleton />
          </TopRowCard>
        </Example>
      </GallerySection>

      <GallerySection name="AccountType" wide>
        <Example name="Credit Card with Mastercard (105)">
          <div className={styles.sampleCard}>
            <AccountType account={sampleAccounts.accounts[0]!} />
          </div>
        </Example>
        <Example name="Checking with VISA">
          <div className={styles.sampleCard}>
            <AccountType account={sampleAccounts.accounts[1]!} />
          </div>
        </Example>
        <Example name="No card network">
          <div className={styles.sampleCard}>
            <AccountType account={sampleAccounts.accounts[2]!} />
          </div>
        </Example>
        <Example name="A 100-character Bank Name: under the type, wrapped (#106)">
          <div className={styles.sampleCard}>
            <AccountType account={{ ...sampleAccounts.accounts[1]!, bankName: longBankName }} />
          </div>
        </Example>
        <Example name="The longest balance the contract allows">
          <div className={styles.sampleCard}>
            <AccountType account={{ ...sampleAccounts.accounts[3]!, balance: usd(-9007199254740991) }} />
          </div>
        </Example>
      </GallerySection>

      <GallerySection name="Button">
        <Example name="Details (105): a link to Account Details">
          <Button to="/balances/1">Details</Button>
        </Example>
      </GallerySection>

      <GallerySection name="AddAccountsButtonBig">
        <Example name="Add Accounts (105): visual only">
          <AddAccountsButtonBig />
        </Example>
      </GallerySection>

      <GallerySection name="AddAccountsCell" wide>
        <Example name="The last Balances cell (105): visual only">
          <div className={styles.sampleCard}>
            <AddAccountsCell />
          </div>
        </Example>
      </GallerySection>

      <GallerySection name="AccountTypeSkeleton" wide>
        <Example name="Loading">
          <div className={styles.sampleCard}>
            <AccountTypeSkeleton />
          </div>
        </Example>
      </GallerySection>

      <GallerySection name="Goals" wide>
        <Example name="The demo goal (104): $16,250 of $20,000">
          <TopRowCard>
            <Goals data={sampleGoal(2000000, 1625000, 0.8125)} />
          </TopRowCard>
        </Example>
        <Example name="Over-achieved: the whole arc">
          <TopRowCard>
            <Goals data={sampleGoal(2000000, 2500000, 1)} />
          </TopRowCard>
        </Example>
        <Example name="No goal for this month (#108 c)">
          <TopRowCard>
            <Goals data={{ month: '2026-10', goal: null }} />
          </TopRowCard>
        </Example>
        <Example name="Long amounts: the month and the gauge move under (#108 b)">
          <TopRowCard>
            <Goals data={sampleGoal(100000000000, 100000000000, 1)} />
          </TopRowCard>
        </Example>
      </GallerySection>

      <GallerySection name="SavingsGoalSummary" wide>
        <Example name="The demo goal (104, 110): $16,250 of $20,000">
          <SavingsGoalCard>
            <SavingsGoalSummary goal={sampleGoal(2000000, 1625000, 0.8125).goal!} />
          </SavingsGoalCard>
        </Example>
        <Example name="Long amounts: the gauge moves under the amounts (#108 b)">
          <SavingsGoalCard>
            <SavingsGoalSummary goal={sampleGoal(100000000000, 100000000000, 1).goal!} />
          </SavingsGoalCard>
        </Example>
      </GallerySection>

      <GallerySection name="SavingsGoal" wide>
        <Example name="The demo months and goals (110)">
          <SavingsGoalExample name="demo" months={{ months: sampleMonths }} goal="sample" />
        </Example>
        <Example name="No goal for this month (#58)">
          <SavingsGoalExample name="none" months={{ months: sampleMonths.slice(0, 3) }} goal="none" />
        </Example>
        <Example name="The months loading">
          <SavingsGoalExample name="months-pending" months="pending" goal="sample" />
        </Example>
        <Example name="The goal loading">
          <SavingsGoalExample name="goal-pending" months={{ months: sampleMonths }} goal="pending" />
        </Example>
        <Example name="Error">
          <SavingsGoalExample name="fails" months={{ months: sampleMonths }} goal="fails" />
        </Example>
      </GallerySection>

      <GallerySection name="SavingsGoalSkeleton" wide>
        <Example name="Loading">
          <SavingsGoalCard>
            <SavingsGoalSkeleton />
          </SavingsGoalCard>
        </Example>
      </GallerySection>

      <GallerySection name="SavingSummary" wide>
        <Example name="The demo month (110)">
          <SavingSummaryExample name="demo" months={{ months: sampleMonths }} summary={sampleSavingSummary} />
        </Example>
        <Example name="Every value $0 (#124 e)">
          <SavingSummaryExample
            name="empty"
            months={{ months: sampleMonths.slice(0, 1) }}
            summary={emptySavingSummary}
          />
        </Example>
        <Example name="Narrow: the legend under the title row (#108 b)">
          <SavingSummaryExample
            name="narrow"
            months={{ months: sampleMonths.slice(0, 1) }}
            summary={emptySavingSummary}
            narrow
          />
        </Example>
        <Example name="The months loading">
          <SavingSummaryExample name="months-pending" months="pending" summary={sampleSavingSummary} />
        </Example>
        <Example name="The summary loading">
          <SavingSummaryExample name="summary-pending" months={{ months: sampleMonths }} summary="pending" />
        </Example>
        <Example name="Error">
          <SavingSummaryExample name="fails" months={{ months: sampleMonths }} summary="fails" />
        </Example>
      </GallerySection>

      <GallerySection name="SavingSummaryChart" wide>
        <Example name="October at the fixed clock (110, #68)">
          <SavingSummaryChartSample answer={sampleSavingSummary} />
        </Example>
        <Example name="June 2022: 10 labels, the cap (#124 d2)">
          <SavingSummaryChartSample answer={juneSavingSummary} />
        </Example>
        <Example name="No day above $0 (#72)">
          <SavingSummaryChartSample answer={belowZeroSavingSummary} />
        </Example>
        <Example name="A lone point: 1 Nov in Belgrade">
          <SavingSummaryChartSample answer={lonePointSavingSummary} />
        </Example>
        <Example name="February: 28 days, no 30">
          <SavingSummaryChartSample answer={februarySavingSummary} />
        </Example>
      </GallerySection>

      <GallerySection name="SavingSummaryChartSkeleton" wide>
        <Example name="Loading">
          <SavingSummaryCard>
            <SavingSummaryChartSkeleton />
          </SavingSummaryCard>
        </Example>
      </GallerySection>

      <GallerySection name="AdjustButton">
        <Example name="Adjust Goal (110)">
          <AdjustButton label="Adjust Goal" />
        </Example>
        <Example name="Adjust, compact (110 category cards)">
          <AdjustButton label="Adjust" compact />
        </Example>
      </GallerySection>

      <GallerySection name="GoalItem" wide>
        {sampleCategoryLimits.limits.map((item) => (
          <Example key={item.category} name={categoryLabel(item.category)}>
            <GoalItemCard item={item} />
          </Example>
        ))}
        <Example name='A $1,000,000,000.00 limit: "Adjust" under the text'>
          <GoalItemCard item={{ category: 'transportation', limit: { cents: 100_000_000_000, currency: 'USD' } }} />
        </Example>
        <Example name="No limit set (#125)">
          <GoalItemCard item={{ category: 'food', limit: null }} />
        </Example>
      </GallerySection>

      <GallerySection name="GoalItemList" wide>
        <Example name="The demo limits (110)">
          <GoalItemListExample name="demo" answer={sampleCategoryLimits} />
        </Example>
        <Example name="Loading">
          <GoalItemListExample name="loading" answer="pending" />
        </Example>
        <Example name="Error">
          <GoalItemListExample name="error" answer="fails" />
        </Example>
      </GallerySection>

      <GallerySection name="GoalItemSkeleton" wide>
        <Example name="Loading">
          <div className={styles.chartThreeCards}>
            <GoalItemSkeleton />
          </div>
        </Example>
      </GallerySection>

      <GallerySection name="CategoryLimitPopup">
        <Example name="110.2 from a category card">
          <p className={styles.panelText}>
            Adjust on a GoalItem card above opens it. It saves through the API, so Save works when signed in.
          </p>
        </Example>
      </GallerySection>

      <GallerySection name="GoalsSkeleton" wide>
        <Example name="Loading">
          <TopRowCard>
            <GoalsSkeleton />
          </TopRowCard>
        </Example>
      </GallerySection>

      <GallerySection name="UpcomingBill" wide>
        <Example name="The demo bills (104)">
          <BillsCard>
            <UpcomingBill data={{ bills: [sampleFigmaBill, sampleAdobeBill] }} />
          </BillsCard>
        </Example>
        <Example name="One bill">
          <BillsCard>
            <UpcomingBill data={{ bills: [sampleAdobeBill] }} />
          </BillsCard>
        </Example>
        <Example name="A long title and amount: the amount box moves under (#111 a)">
          <BillsCard>
            <UpcomingBill data={{ bills: [sampleLongBill, sampleAdobeBill] }} />
          </BillsCard>
        </Example>
      </GallerySection>

      <GallerySection name="UpcomingBillLogo">
        <Example name="Figma (104)">
          <UpcomingBillLogo logo="figma" />
        </Example>
        <Example name="Adobe (104)">
          <UpcomingBillLogo logo="adobe" />
        </Example>
      </GallerySection>

      <GallerySection name="UpcomingBillSkeleton" wide>
        <Example name="Loading">
          <BillsCard>
            <UpcomingBillSkeleton />
          </BillsCard>
        </Example>
      </GallerySection>

      <GallerySection name="BillTable" wide>
        <Example name="The demo bills (108)">
          <BillTableExample bills={[sampleFigmaBill, sampleAdobeBill]} />
        </Example>
        <Example name="One bill">
          <BillTableExample bills={[sampleAdobeBill]} />
        </Example>
        <Example name="Four bills, not paginated">
          <BillTableExample bills={sampleFourBills} />
        </Example>
        <Example name="Long titles, descriptions and amounts: the texts wrap (#115 b)">
          <BillTableExample bills={[{ ...sampleLongBill, description: sampleLongBill.title }, sampleNoSpaceBill]} />
        </Example>
      </GallerySection>

      <GallerySection name="BillItem" wide>
        <Example name="Figma (108)">
          <BillTableExample bills={[sampleFigmaBill]} />
        </Example>
        <Example name="Adobe (108)">
          <BillTableExample bills={[sampleAdobeBill]} />
        </Example>
        <Example name="A long title, description and amount (#115 b)">
          <BillTableExample bills={[{ ...sampleLongBill, description: sampleLongBill.title }]} />
        </Example>
      </GallerySection>

      <GallerySection name="BillTableSkeleton" wide>
        <Example name="Loading">
          <BillTableCard>
            <BillTableSkeleton />
          </BillTableCard>
        </Example>
      </GallerySection>

      <GallerySection name="RecentTransaction" wide>
        <Example name="The demo transactions (104)">
          <RecentExample name="demo" answer={sampleRecent} />
        </Example>
        <Example name="Fewer than 5: 3, 1 and none">
          <RecentExample
            name="fewer"
            answer={{
              all: [sampleExpenses[0]!, sampleRevenue[0]!, sampleExpenses[1]!],
              revenue: [sampleRevenue[0]!],
              expenses: [],
            }}
          />
        </Example>
        <Example name="Every list empty">
          <RecentExample name="empty" answer={{ all: [], revenue: [], expenses: [] }} />
        </Example>
        <Example name="Loading">
          <RecentExample name="loading" answer="pending" />
        </Example>
        <Example name="Error">
          <RecentExample name="error" answer="fails" />
        </Example>
      </GallerySection>

      <GallerySection name="RecentTransactionItem" wide>
        <Example name="Expense (104)">
          <ItemCard transaction={sampleExpenses[0]!} />
        </Example>
        <Example name="Income: the wallet">
          <ItemCard transaction={sampleRevenue[0]!} />
        </Example>
        <Example name="A long item, shop and amount: the right column moves under (#111 a)">
          <ItemCard transaction={sampleLongTransaction} />
        </Example>
      </GallerySection>

      <GallerySection name="RecentTransactionSkeleton" wide>
        <Example name="Loading">
          <RecentCard>
            <RecentTransactionSkeleton />
          </RecentCard>
        </Example>
      </GallerySection>

      <GallerySection name="TransactionTable" wide>
        <Example name="A first page (107): Load More adds a last page">
          <TransactionTableExample pages={[sampleTransactionsPage]} />
        </Example>
        <Example name="Load More while the next page loads">
          <TransactionTableExample pages={[sampleTransactionsPage]} loadingMore />
        </Example>
        <Example name="A failed Load More (#117 b)">
          <TransactionTableExample pages={[sampleTransactionsPage]} loadMoreFailure={1} />
        </Example>
        <Example name="The end of the list: no Load More">
          <TransactionTableExample pages={[{ ...sampleTransactionsPage, nextCursor: null }]} />
        </Example>
      </GallerySection>

      <GallerySection name="TransactionItem" wide>
        <Example name="Expense (107)">
          <TransactionItemExample row={sampleRow(sampleExpenses[0]!, 'checking')} />
        </Example>
        <Example name="Income: the wallet">
          <TransactionItemExample row={sampleRow(sampleRevenue[1]!, 'investment')} />
        </Example>
        <Example name="A long item, shop and amount: the texts wrap, the amount stays on one line (#115 b)">
          <TransactionItemExample row={sampleRow(sampleLongTransaction, 'credit-card')} />
        </Example>
      </GallerySection>

      <GallerySection name="TransactionTableSkeleton" wide>
        <Example name="Loading">
          <TransactionsCard>{() => <TransactionTableSkeleton />}</TransactionsCard>
        </Example>
      </GallerySection>

      <GallerySection name="LoadMore" wide>
        <Example name="Under a paged table (107, 106): a click shows the loading pattern">
          <LoadMoreExample />
        </Example>
        <Example name="While the next page loads">
          <LoadMoreExample loading />
        </Example>
        <Example name="A failed Load More (#117 b)">
          <LoadMoreExample failure={1} />
        </Example>
      </GallerySection>

      <GallerySection name="AccountDetailsCard" wide>
        <Example name="Checking (106)">
          <AccountDetailsSampleCard>
            <AccountDetailsCard account={sampleAccountDetails} onEdit={noEdit} />
          </AccountDetailsSampleCard>
        </Example>
        <Example name="100-character names wrap inside their columns (#115 b)">
          <AccountDetailsSampleCard>
            <AccountDetailsCard
              account={{ ...sampleAccountDetails, bankName: longBankName, branchName: longBankName.toUpperCase() }}
              onEdit={noEdit}
            />
          </AccountDetailsSampleCard>
        </Example>
        <Example name="The lowest balance the contract allows, on one line">
          <AccountDetailsSampleCard>
            <AccountDetailsCard
              account={{ ...sampleAccountDetails, balance: usd(-9_007_199_254_740_991) }}
              onEdit={noEdit}
            />
          </AccountDetailsSampleCard>
        </Example>
      </GallerySection>

      <GallerySection name="AccountDetailsCardSkeleton" wide>
        <Example name="Loading">
          <AccountDetailsSampleCard>
            <AccountDetailsCardSkeleton />
          </AccountDetailsSampleCard>
        </Example>
      </GallerySection>

      <GallerySection name="AccountDetailsForm" wide>
        <Example name="Prefilled with Checking (106 edit mode, not designed)">
          <AccountDetailsFormExample />
        </Example>
        <Example name="Field errors: Save checks the shared rule (a Bank Name of spaces, a 101-character Branch Name)">
          <AccountDetailsFormExample
            account={{ ...sampleAccountDetails, bankName: '   ', branchName: 'P'.repeat(101) }}
          />
        </Example>
        <Example name="Saving: Save in its loading pattern, the fields locked">
          <AccountDetailsFormExample saving />
        </Example>
        <Example name="The server error above the buttons (#97 a)">
          <AccountDetailsFormExample formError="Something went wrong." />
        </Example>
        <Example name="100-character names in words and with no space, on one line in their fields">
          <AccountDetailsFormExample
            account={{ ...sampleAccountDetails, bankName: longBankName, branchName: longBankName.replaceAll(' ', '') }}
          />
        </Example>
      </GallerySection>

      <GallerySection name="TransactionsHistoryTable" wide>
        <Example name="A first page (106): Load More adds a last page">
          <TransactionsHistoryTableExample pages={[sampleHistoryPage]} />
        </Example>
        <Example name="Load More while the next page loads">
          <TransactionsHistoryTableExample pages={[sampleHistoryPage]} loadingMore />
        </Example>
        <Example name="A failed Load More (#117 b)">
          <TransactionsHistoryTableExample pages={[sampleHistoryPage]} loadMoreFailure={1} />
        </Example>
        <Example name="The end of the list: no Load More">
          <TransactionsHistoryTableExample pages={[{ ...sampleHistoryPage, nextCursor: null }]} />
        </Example>
      </GallerySection>

      <GallerySection name="TransactionsHistoryItem" wide>
        <Example name="A Complete Credit (106)">
          <TransactionsHistoryItemExample row={sampleHistoryRow(17, 'complete', 'income', 'SVqWhlvmJqw', 17_920)} />
        </Example>
        <Example name="A Failed Debit">
          <TransactionsHistoryItemExample row={sampleHistoryRow(16, 'failed', 'expense', 'CFP5E9VV2Fn', 2_464)} />
        </Example>
        <Example name="A long receipt wraps, the amount stays on one line (#115 b)">
          <TransactionsHistoryItemExample
            row={sampleHistoryRow(15, 'pending', 'expense', longReceipt, 100_000_000_000)}
          />
        </Example>
      </GallerySection>

      <GallerySection name="TransactionsHistorySkeleton" wide>
        <Example name="Loading">
          <AccountDetailsSampleCard history>
            <TransactionsHistorySkeleton />
          </AccountDetailsSampleCard>
        </Example>
      </GallerySection>

      <GallerySection name="Statistics" wide>
        <Example name="The demo week (104)">
          <StatisticsExample name="demo" answer={sampleWeek} />
        </Example>
        <Example name="This week all 0">
          <StatisticsExample name="quiet" answer={sampleQuietWeek} />
        </Example>
        <Example name="Every value 0">
          <StatisticsExample name="zero" answer={sampleZeroWeek} />
        </Example>
        <Example name="Loading">
          <StatisticsExample name="loading" answer="pending" />
        </Example>
        <Example name="Error">
          <StatisticsExample name="error" answer="fails" />
        </Example>
      </GallerySection>

      <GallerySection name="ExpensesItem" wide>
        <Example name="Up (104)">
          <ExpensesItemExample item={breakdownItem('food', 51_004, changeUp(7))} />
        </Example>
        <Example name="Down">
          <ExpensesItemExample item={breakdownItem('housing', 25_200, changeDown(17))} />
        </Example>
        <Example name="0%: no arrow">
          <ExpensesItemExample item={breakdownItem('housing', 20_000, { percent: 0, direction: null })} />
        </Example>
        <Example name="No change: last month $0.00">
          <ExpensesItemExample item={breakdownItem('transportation', 5_320, null)} />
        </Example>
        <Example name="$0.00 after a month with expenses">
          <ExpensesItemExample item={breakdownItem('food', 0, changeDown(100))} />
        </Example>
        <Example name="A long total: the arrow moves under (#115 b)">
          <ExpensesItemExample item={breakdownItem('shopping', 100_000_000_000, changeUp(250))} />
        </Example>
      </GallerySection>

      <GallerySection name="OverviewExpensesBreakdown" wide>
        <Example name="The demo month (104)">
          <ExpensesBreakdownExample name="demo" answer={sampleBreakdown} />
        </Example>
        <Example name="Last month $0.00">
          <ExpensesBreakdownExample name="no-last-month" answer={sampleNoLastMonth} />
        </Example>
        <Example name="No expenses at all">
          <ExpensesBreakdownExample name="none" answer={sampleNoExpenses} />
        </Example>
        <Example name="Loading">
          <ExpensesBreakdownExample name="loading" answer="pending" />
        </Example>
        <Example name="Error">
          <ExpensesBreakdownExample name="error" answer="fails" />
        </Example>
      </GallerySection>

      <GallerySection name="OverviewExpensesBreakdownSkeleton" wide>
        <Example name="Loading">
          <ExpensesBreakdownCard>
            <OverviewExpensesBreakdownSkeleton />
          </ExpensesBreakdownCard>
        </Example>
      </GallerySection>

      <GallerySection name="ExpensesComparison" wide>
        <Example name="The demo year (109)">
          <ExpensesComparisonExample name="demo" answer={sampleYear} />
        </Example>
        <Example name="Every value 0">
          <ExpensesComparisonExample name="zero" answer={sampleZeroYear} />
        </Example>
        <Example name="Loading">
          <ExpensesComparisonExample name="loading" answer="pending" />
        </Example>
        <Example name="Error">
          <ExpensesComparisonExample name="error" answer="fails" />
        </Example>
      </GallerySection>

      <GallerySection name="ExpensesBreakdown" wide>
        <Example name="Up (109)">
          <ExpensesCardExample item={sampleExpensesCards.categories[1]!} />
        </Example>
        <Example name="Down">
          <ExpensesCardExample item={sampleExpensesCards.categories[0]!} />
        </Example>
        <Example name="0%: no arrow">
          <ExpensesCardExample
            item={breakdownItem('housing', 20_000, { percent: 0, direction: null }, [
              lineItem('House Rent', 20_000, '2026-10-01'),
            ])}
          />
        </Example>
        <Example name="No change: last month $0.00">
          <ExpensesCardExample
            item={breakdownItem('transportation', 5_320, null, [lineItem('Taxi fare', 1_064, '2026-10-19')])}
          />
        </Example>
        <Example name="One item">
          <ExpensesCardExample
            item={breakdownItem('housing', 27_048, changeDown(1), [lineItem('House Rent', 27_048, '2026-11-01')])}
          />
        </Example>
        <Example name="No expenses this month">
          <ExpensesCardExample item={breakdownItem('food', 0, changeDown(100))} />
        </Example>
        <Example name="Long data: the right block moves under (#106)">
          <ExpensesCardExample
            item={breakdownItem('entertainment', 100_000_000_000, changeUp(250), [
              lineItem(sampleLongItemInWords, 100_000_000_000, '2026-10-21'),
              lineItem(sampleLongItemNoSpace, 2_464, '2026-10-20'),
            ])}
          />
        </Example>
      </GallerySection>

      <GallerySection name="ExpensesLineItem" wide>
        <Example name="An item (109)">
          <ul className={`${styles.itemList} ${styles.expensesLineItemSample}`}>
            <ExpensesLineItem item={sampleHousingItems[1]!} />
          </ul>
        </Example>
      </GallerySection>

      <GallerySection name="ExpensesBreakdownList" wide>
        <Example name="The demo month (109)">
          <ExpensesListExample name="demo" answer={sampleExpensesCards} />
        </Example>
        <Example name="Loading">
          <ExpensesListExample name="loading" answer="pending" />
        </Example>
        <Example name="Error">
          <ExpensesListExample name="error" answer="fails" />
        </Example>
      </GallerySection>

      <GallerySection name="ExpensesBreakdownSkeleton" wide>
        <Example name="Loading">
          <div className={styles.chartThreeCards}>
            <ExpensesBreakdownSkeleton />
          </div>
        </Example>
      </GallerySection>

      <GallerySection name="SavingsGoalPopup">
        <Example name="104.1 from the Goals card">
          <p className={styles.panelText}>
            The pencil of a Goals card above opens it. It saves through the API, so Save works when signed in; on
            Overview it dims the content area of the app shell.
          </p>
        </Example>
      </GallerySection>
    </div>
  );
}
