import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});

// jsdom has no ResizeObserver. Radix uses it to size the hidden native input of a checkbox inside a form.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

// jsdom has no window scrolling. React Router's ScrollRestoration in the app shell scrolls the window.
if (typeof window !== 'undefined') {
  window.scrollTo = () => undefined;
}

// jsdom has no pointer capture and no scrolling. Radix Select uses both: it checks pointer capture when its
// trigger is pressed and scrolls the selected option into view. Node-environment tests have no Element.
const radixStubs = {
  hasPointerCapture: () => false,
  releasePointerCapture: () => undefined,
  scrollIntoView: () => undefined,
};
if (typeof Element !== 'undefined') {
  for (const [name, stub] of Object.entries(radixStubs)) {
    if (!(name in Element.prototype)) {
      Object.defineProperty(Element.prototype, name, { value: stub, configurable: true, writable: true });
    }
  }
}
