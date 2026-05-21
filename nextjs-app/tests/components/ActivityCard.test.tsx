import { render, screen } from '@testing-library/react';

import ActivityCard from '../../app/components/ActivityCard';

describe('ActivityCard', () => {
  it('renders the title and children', () => {
    render(
      <ActivityCard title="Check Inventory" state="done">
        <p>Reserved 2 units</p>
      </ActivityCard>,
    );
    expect(screen.getByText('Check Inventory')).toBeInTheDocument();
    expect(screen.getByText('Reserved 2 units')).toBeInTheDocument();
  });

  it.each<['pending' | 'done' | 'failed' | 'skipped', string]>([
    ['pending', 'Pending'],
    ['done', 'Done'],
    ['failed', 'Failed'],
    ['skipped', 'Skipped'],
  ])('renders correct icon for %s state', (state, label) => {
    render(<ActivityCard title="Step" state={state} />);
    expect(screen.getByRole('img', { name: label })).toBeInTheDocument();
  });

  it('renders a spinner for active state', () => {
    render(<ActivityCard title="Step" state="active" />);
    expect(screen.getByRole('status', { name: /in progress/i })).toBeInTheDocument();
  });

  it('applies data-state attribute on the container', () => {
    const { container } = render(<ActivityCard title="Step" state="failed" />);
    expect(container.querySelector('[data-state="failed"]')).not.toBeNull();
  });
});
