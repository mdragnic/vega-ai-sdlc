// The app's own Vite variables, next to Vite's built-in ones (`vite/client`).
interface ImportMetaEnv {
  /** `'true'` only in the dev server Playwright starts (e2e/playwright.config.ts): the e2e fixture routes (task 023). */
  readonly VITE_E2E_FIXTURES?: string;
}
