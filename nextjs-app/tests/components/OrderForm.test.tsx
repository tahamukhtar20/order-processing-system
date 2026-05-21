import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import OrderForm from '../../app/components/OrderForm';
import { PRODUCTS } from '../../lib/products';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }));

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => jest.clearAllMocks());

describe('OrderForm', () => {
  it('renders all form fields and submit button', () => {
    render(<OrderForm products={PRODUCTS} />);
    expect(screen.getByLabelText(/product/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/quantity/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/customer id/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/shipping address/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /place order/i })).toBeInTheDocument();
  });

  it('populates the product dropdown with all products', () => {
    render(<OrderForm products={PRODUCTS} />);
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(PRODUCTS.length);
    expect(options[0]).toHaveTextContent('Widget');
  });

  it('shows validation errors when submitting empty required fields', async () => {
    render(<OrderForm products={PRODUCTS} />);
    await userEvent.click(screen.getByRole('button', { name: /place order/i }));
    expect(await screen.findByText(/customer id is required/i)).toBeInTheDocument();
    expect(screen.getByText(/address is required/i)).toBeInTheDocument();
  });

  it('submits the form and navigates on success', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ workflowId: 'order-CUST-001-123' }),
    });
    render(<OrderForm products={PRODUCTS} />);

    await userEvent.type(screen.getByLabelText(/customer id/i), 'CUST-001');
    await userEvent.type(screen.getByLabelText(/shipping address/i), '123 Main St, New York, NY');
    await userEvent.click(screen.getByRole('button', { name: /place order/i }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/orders/order-CUST-001-123'));
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/orders',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('shows submit error on API failure', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Failed to start order workflow' }),
    });
    render(<OrderForm products={PRODUCTS} />);

    await userEvent.type(screen.getByLabelText(/customer id/i), 'CUST-001');
    await userEvent.type(screen.getByLabelText(/shipping address/i), '123 Main St');
    await userEvent.click(screen.getByRole('button', { name: /place order/i }));

    expect(await screen.findByText(/failed to start order workflow/i)).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('shows submit error on network failure', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    render(<OrderForm products={PRODUCTS} />);

    await userEvent.type(screen.getByLabelText(/customer id/i), 'CUST-001');
    await userEvent.type(screen.getByLabelText(/shipping address/i), '123 Main St');
    await userEvent.click(screen.getByRole('button', { name: /place order/i }));

    expect(await screen.findByText(/network error/i)).toBeInTheDocument();
  });

  it('disables the submit button while submitting', async () => {
    mockFetch.mockImplementation(() => new Promise(() => {}));
    render(<OrderForm products={PRODUCTS} />);

    await userEvent.type(screen.getByLabelText(/customer id/i), 'CUST-001');
    await userEvent.type(screen.getByLabelText(/shipping address/i), '123 Main St');
    await userEvent.click(screen.getByRole('button', { name: /place order/i }));

    expect(await screen.findByRole('button', { name: /placing order/i })).toBeDisabled();
  });
});
