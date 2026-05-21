import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import OrderStatus from '../../app/components/OrderStatus';
import type { OrderStatusData } from '../../lib/order-status';

const mockFetch = jest.fn();
const originalFetch = globalThis.fetch;

beforeAll(() => {
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

beforeEach(() => {
  jest.clearAllMocks();
});

const runningInitial: OrderStatusData = {
  workflowId: 'order-CUST-001-1',
  status: 'RUNNING',
  phase: 'checking-inventory',
  progress: 10,
};

const completedInitial: OrderStatusData = {
  workflowId: 'order-CUST-001-2',
  status: 'COMPLETED',
  phase: 'completed',
  progress: 100,
  result: {
    inventory: { available: true, reservedQuantity: 2, unitPrice: 19.99 },
    payment: { paymentSuccessful: true, transactionId: 'TXN-1', totalAmount: 39.98 },
    shipping: {
      shippingCost: 8,
      estimatedDelivery: '2026-06-01T00:00:00.000Z',
      finalTotal: 47.98,
    },
  },
};

const failedInitial: OrderStatusData = {
  workflowId: 'order-CUST-001-3',
  status: 'FAILED',
  phase: 'failed',
  progress: 100,
  error: 'Payment declined',
  errorType: 'PaymentDeclined',
};

describe('OrderStatus', () => {
  it('renders the running badge and cancel button when running', () => {
    render(
      <OrderStatus
        workflowId={runningInitial.workflowId}
        initialState={runningInitial}
        productId="SKU-1001"
      />,
    );
    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel order/i })).toBeInTheDocument();
  });

  it('shows the OrderSummary when completed successfully', () => {
    render(
      <OrderStatus
        workflowId={completedInitial.workflowId}
        initialState={completedInitial}
        productId="SKU-1001"
      />,
    );
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('Order Confirmed')).toBeInTheDocument();
    expect(screen.getByText('SKU-1001')).toBeInTheDocument();
  });

  it('shows the ErrorBanner with payment-declined message when failed', () => {
    render(
      <OrderStatus
        workflowId={failedInitial.workflowId}
        initialState={failedInitial}
        productId="SKU-1001"
      />,
    );
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText(/payment was declined/i)).toBeInTheDocument();
  });

  it('does not render the cancel button when terminal', () => {
    render(
      <OrderStatus
        workflowId={completedInitial.workflowId}
        initialState={completedInitial}
        productId="SKU-1001"
      />,
    );
    expect(screen.queryByRole('button', { name: /cancel order/i })).not.toBeInTheDocument();
  });

  it('polls and updates to the new state', async () => {
    jest.useFakeTimers();
    try {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => completedInitial,
      });

      render(
        <OrderStatus
          workflowId={runningInitial.workflowId}
          initialState={runningInitial}
          productId="SKU-1001"
        />,
      );

      expect(screen.getByText('Running')).toBeInTheDocument();

      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => expect(screen.getByText('Completed')).toBeInTheDocument());
    } finally {
      jest.useRealTimers();
    }
  });

  it('calls cancel endpoint when cancel button is clicked', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    const user = userEvent.setup();
    render(
      <OrderStatus
        workflowId={runningInitial.workflowId}
        initialState={runningInitial}
        productId="SKU-1001"
      />,
    );

    await user.click(screen.getByRole('button', { name: /cancel order/i }));

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/orders/${runningInitial.workflowId}/cancel`,
        expect.objectContaining({ method: 'POST' }),
      ),
    );
  });
});
