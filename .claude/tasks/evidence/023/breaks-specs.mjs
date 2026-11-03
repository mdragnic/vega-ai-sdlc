// Writes one mutation spec per break of task 023's Scope ("Proof by breaking it on purpose") into ./specs/.
import { mkdirSync, writeFileSync } from 'node:fs';

const dir = new URL('./specs/', import.meta.url);
mkdirSync(dir, { recursive: true });

const be = (files, filter = '') => `cd backend && npx vitest run ${files}${filter ? ` -t "${filter}"` : ''}`;
const fe = (files, filter = '') => `cd frontend && npx vitest run ${files}${filter ? ` -t "${filter}"` : ''}`;
const e2e = (grep) => `npm run build -w shared && cd e2e && npx playwright test tests/bills.spec.ts --reporter=line --grep "${grep}"`;

const service = 'backend/src/bills/bills.service.ts';

const specs = {
  // 1. Today bound as a Date (typed as the column's string, so the e2e backend still builds).
  '01-today-as-date': {
    edits: [
      {
        file: service,
        from: 'where: { userId, dueDate: MoreThanOrEqual(today) },',
        to: 'where: { userId, dueDate: MoreThanOrEqual(new Date(today) as unknown as string) },',
      },
    ],
    commands: [
      be('test/bills-service.test.ts test/bills.test.ts'),
      e2e('lists the bill due today first'),
    ],
  },
  // 2. The userId key dropped from the query.
  '02-user-key-dropped': {
    edits: [
      {
        file: service,
        from: 'where: { userId, dueDate: MoreThanOrEqual(today) },',
        to: 'where: { dueDate: MoreThanOrEqual(today) },',
      },
    ],
    commands: [be('test/bills.test.ts', 'user scoping'), be('test/bills-service.test.ts', 'own bills')],
  },
  // 3. Overview's card renders the description.
  '03-overview-shows-description': {
    edits: [
      {
        file: 'frontend/src/components/UpcomingBill/UpcomingBill.tsx',
        from: '              <p className={styles.title}>{bill.title}</p>\n',
        to: '              <p className={styles.title}>{bill.title}</p>\n              <p>{bill.description}</p>\n',
      },
    ],
    commands: [fe('test/app/overview-upcoming-bill.test.tsx', 'description'), fe('test/app/bills.test.tsx', 'Overview and Bills')],
  },
  // 4. The description dropped from the backend mapping.
  '04-description-dropped': {
    edits: [
      {
        file: service,
        from: '        title,\n        description,\n        logo,',
        to: '        title,\n        logo,',
      },
    ],
    commands: [
      be('test/bills-service.test.ts test/bills.test.ts'),
      e2e('opens from the sidebar'),
    ],
  },
  // 5. The table shows only the first 2 bills, as Overview.
  '05-table-slices-two': {
    edits: [
      {
        file: 'frontend/src/components/BillTable/BillTable.tsx',
        from: '          {bills.map((bill, index) => (',
        to: '          {bills.slice(0, 2).map((bill, index) => (',
      },
    ],
    commands: [fe('test/app/bills.test.tsx'), e2e('opens from the sidebar')],
  },
  // 6 (extra, AC20). The fixture routes registered without the DEV check: the production build holds them.
  '06-fixture-in-production': {
    edits: [
      {
        file: 'frontend/src/app/routes.tsx',
        from: "  import.meta.env.DEV && import.meta.env.VITE_E2E_FIXTURES === 'true'",
        to: "  import.meta.env.VITE_E2E_FIXTURES === 'true'",
      },
    ],
    commands: [fe('test/app/gallery-build.test.ts')],
  },
};

for (const [name, spec] of Object.entries(specs)) {
  writeFileSync(new URL(`${name}.json`, dir), JSON.stringify({ name, ...spec }, null, 2));
}
console.log(Object.keys(specs).join('\n'));
