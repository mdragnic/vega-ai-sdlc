import {
  expenseCategorySchema,
  formatAmountInput,
  formatMonthLabel,
  parseAmountInput,
  type ExpenseCategory,
  type Money,
} from '@finebank/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';

import { googleUrl } from '../../assets/brand';
import {
  AmountBox,
  AppLayout,
  AuthLayout,
  Avatar,
  ButtonPrimary,
  ButtonSecondary,
  ButtonSmall,
  Card,
  CategoryIcon,
  DataState,
  DateBox,
  Dropdown,
  type DropdownOption,
  FieldError,
  FormError,
  Header,
  HeaderSearch,
  Input,
  Logout,
  MenuTab,
  NavBar,
  NavMenu,
  PopupInputSmall,
  Profile,
  RemindMe,
  Section,
  Skeleton,
  Spinner,
  TextDivider,
} from '../../components';
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

const waitThenFail = () =>
  new Promise<number[]>((_, reject) => {
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
  const query = useQuery({ ...demoQuery, queryKey: ['gallery', 'error'], queryFn: waitThenFail });
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
        {(amount) => <AmountBox amount={amount} size="compact" />}
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

// The month list of the Goals selectors (#60): newest first, `formatMonthLabel` labels. A fixed sample from
// Oct 2026; the screens list from the current month back to the user's earliest data (tasks 025, 026).
function monthOptions(count: number): DropdownOption[] {
  return Array.from({ length: count }, (_, index) => {
    const monthIndex = 2026 * 12 + 9 - index;
    const year = Math.floor(monthIndex / 12);
    const month = (monthIndex % 12) + 1;
    return { value: `${year}-${String(month).padStart(2, '0')}`, label: formatMonthLabel(year, month) };
  });
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
  variant: 'box' | 'plain' | 'inline' | 'input';
  options: DropdownOption[];
  initial: string;
  label: string;
}) {
  const [value, setValue] = useState(initial);
  return <Dropdown variant={variant} options={options} value={value} onValueChange={setValue} aria-label={label} />;
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
        <Example name="60 months">
          <Card>
            <DropdownExample variant="box" options={monthOptions(60)} initial="2026-10" label="Month" />
          </Card>
        </Example>
      </GallerySection>
    </div>
  );
}
