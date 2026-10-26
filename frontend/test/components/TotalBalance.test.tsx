import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { TotalBalance } from '../../src/components';

// `DataState` shows "No accounts yet" instead (#105 b); on its own the card draws nothing rather than failing.
describe('TotalBalance', () => {
  it('renders nothing for a response without accounts', () => {
    const { container } = render(
      <MemoryRouter>
        <TotalBalance data={{ totalBalance: { cents: 0, currency: 'USD' }, accounts: [] }} />
      </MemoryRouter>,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
