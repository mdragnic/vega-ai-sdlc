import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { Avatar, Profile } from '../../src/components';
import { paths } from '../../src/routes/paths';

// T5: the photo, or a circle with the initials (AC6, #38, #62).
describe('Avatar', () => {
  it('shows the photo with the full name as alt text', () => {
    render(<Avatar fullName="Tanzir Rahman" photoUrl="/photo.jpg" />);
    const photo = screen.getByRole('img', { name: 'Tanzir Rahman' });

    expect(photo.tagName).toBe('IMG');
    expect(photo).toHaveAttribute('src', '/photo.jpg');
    expect(photo).toHaveAttribute('alt', 'Tanzir Rahman');
  });

  it.each([
    ['Tanzir Rahman', 'TR'],
    ['Marko', 'M'],
    ['  ana   maria  lopez ', 'AL'],
  ])('shows the initials of %j without a photo', (fullName, letters) => {
    render(<Avatar fullName={fullName} />);
    const circle = screen.getByRole('img');

    expect(circle).toHaveAccessibleName(fullName.trim().replace(/\s+/g, ' '));
    expect(circle.tagName).not.toBe('IMG');
    expect(circle.textContent).toBe(letters);
  });

  it('treats an empty photo URL as no photo', () => {
    render(<Avatar fullName="Marko" photoUrl="" />);

    expect(screen.getByRole('img', { name: 'Marko' })).toHaveTextContent('M');
    expect(document.querySelector('img')).toBeNull();
  });
});

function renderProfile(photoUrl?: string) {
  return render(
    <MemoryRouter>
      <Profile fullName="Tanzir Rahman" photoUrl={photoUrl} />
    </MemoryRouter>,
  );
}

// T6: name, "View profile" link and the visual-only three-dot icon (AC6, AC8, #9).
describe('Profile', () => {
  it('shows the avatar, the full name and "View profile" linking to the Settings Account tab', () => {
    renderProfile();

    expect(screen.getByRole('img', { name: 'Tanzir Rahman' })).toHaveTextContent('TR');
    expect(screen.getByText('Tanzir Rahman')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View profile' })).toHaveAttribute('href', paths.settingsAccount);
  });

  it('shows the photo when given', () => {
    renderProfile('/photo.jpg');

    expect(screen.getByRole('img', { name: 'Tanzir Rahman' })).toHaveAttribute('src', '/photo.jpg');
  });

  it('draws the three-dot icon as decoration only: no button, no link, no handler', async () => {
    const user = userEvent.setup();
    const { container } = renderProfile();
    const icons = container.querySelectorAll('svg');
    const dots = icons[icons.length - 1]!;

    await user.click(dots);

    expect(dots).toHaveAttribute('aria-hidden', 'true');
    expect(dots.closest('button, a, [role="button"], [onclick]')).toBeNull();
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('has a divider at the top of the block', () => {
    const { container } = renderProfile();

    expect(container.firstElementChild?.firstElementChild).toBe(screen.getByRole('separator'));
  });
});
