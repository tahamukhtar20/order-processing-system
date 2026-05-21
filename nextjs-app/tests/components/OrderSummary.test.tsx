import { render, screen } from '@testing-library/react';

import OrderSummary from '../../app/components/OrderSummary';

const inventory = { available: true, reservedQuantity: 3, unitPrice: 19.99 };
const payment = { paymentSuccessful: true, transactionId: 'TXN-abc-123', totalAmount: 59.97 };
const shipping = {
  shippingCost: 9.5,
  estimatedDelivery: '2026-06-01T00:00:00.000Z',
  finalTotal: 69.47,
};

describe('OrderSummary', () => {
  it('renders all order details', () => {
    render(
      <OrderSummary
        productId="SKU-1001"
        inventory={inventory}
        payment={payment}
        shipping={shipping}
      />,
    );
    expect(screen.getByText('SKU-1001')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('$19.99')).toBeInTheDocument();
    expect(screen.getByText('$59.97')).toBeInTheDocument();
    expect(screen.getByText('$9.50')).toBeInTheDocument();
    expect(screen.getByText('TXN-abc-123')).toBeInTheDocument();
  });

  it('renders the final total in the total row', () => {
    render(
      <OrderSummary
        productId="SKU-1001"
        inventory={inventory}
        payment={payment}
        shipping={shipping}
      />,
    );
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('$69.47')).toBeInTheDocument();
  });
});
