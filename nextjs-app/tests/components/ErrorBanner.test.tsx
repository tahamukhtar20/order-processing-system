import { render, screen } from '@testing-library/react';

import ErrorBanner from '../../app/components/ErrorBanner';

describe('ErrorBanner', () => {
  it('shows the inventory-unavailable friendly message', () => {
    render(<ErrorBanner errorType="InventoryUnavailable" />);
    expect(screen.getByText(/quantity isn't available/i)).toBeInTheDocument();
  });

  it('shows the payment-declined friendly message', () => {
    render(<ErrorBanner errorType="PaymentDeclined" />);
    expect(screen.getByText(/payment was declined/i)).toBeInTheDocument();
  });

  it('shows a generic message for unknown error types', () => {
    render(<ErrorBanner errorType="SomethingWeird" error="raw error detail" />);
    expect(screen.getByText(/could not be completed/i)).toBeInTheDocument();
    expect(screen.getByText('raw error detail')).toBeInTheDocument();
  });

  it('shows cancelled message when phase is cancelled', () => {
    render(<ErrorBanner phase="cancelled" />);
    expect(screen.getByText(/order cancelled/i)).toBeInTheDocument();
  });

  it('uses alert-error class for failures and alert-warning for cancellations', () => {
    const { container: failed } = render(<ErrorBanner errorType="PaymentDeclined" />);
    expect(failed.querySelector('.alert-error')).not.toBeNull();

    const { container: cancelled } = render(<ErrorBanner phase="cancelled" />);
    expect(cancelled.querySelector('.alert-warning')).not.toBeNull();
  });
});
