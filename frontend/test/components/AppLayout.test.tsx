import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AppLayout } from '../../src/components';

// AC10 scrolling is measured in the browser (T10); here only the structure.
describe('AppLayout', () => {
  it('puts the sidebar beside a main column with the header first and then the content', () => {
    render(
      <AppLayout navBar={<p>Sidebar</p>} header={<header>Header</header>}>
        <p>Screen content</p>
      </AppLayout>,
    );
    const sidebar = screen.getByText('Sidebar');
    const header = screen.getByRole('banner');
    const main = screen.getByRole('main');

    expect(within(main).getByText('Screen content')).toBeInTheDocument();
    expect(main).not.toContainElement(sidebar);
    expect(main).not.toContainElement(header);
    expect(sidebar.compareDocumentPosition(header) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(header.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(header.parentElement).toBe(main.parentElement);
    expect(sidebar.parentElement).not.toBe(main.parentElement);
  });
});
