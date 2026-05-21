'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { Product } from '@/lib/products';

interface Props {
  products: Product[];
}

interface FormErrors {
  customerId?: string;
  customerAddress?: string;
  quantity?: string;
  submit?: string;
}

export default function OrderForm({ products }: Props) {
  const router = useRouter();
  const [productId, setProductId] = useState(products[0]?.id ?? '');
  const [quantity, setQuantity] = useState(1);
  const [customerId, setCustomerId] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const errs: FormErrors = {};
      if (!customerId.trim()) errs.customerId = 'Customer ID is required';
      if (!customerAddress.trim()) errs.customerAddress = 'Address is required';
      if (!Number.isInteger(quantity) || quantity < 1)
        errs.quantity = 'Quantity must be at least 1';
      if (Object.keys(errs).length > 0) {
        setErrors(errs);
        return;
      }
      setErrors({});
      setSubmitting(true);
      try {
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId, quantity, customerId, customerAddress }),
        });
        const data = (await res.json()) as { workflowId?: string; error?: string };
        if (!res.ok) {
          setErrors({ submit: data.error ?? 'Failed to place order' });
          return;
        }
        router.push(`/orders/${data.workflowId}`);
      } catch {
        setErrors({ submit: 'Network error. Please try again.' });
      } finally {
        setSubmitting(false);
      }
    },
    [productId, quantity, customerId, customerAddress, router],
  );

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {errors.submit && <div className="alert alert-error">{errors.submit}</div>}

      <div className="form-field">
        <label htmlFor="productId" className="form-label">
          Product
        </label>
        <select
          id="productId"
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          className="form-input"
        >
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — ${p.unitPrice.toFixed(2)} ({p.stockLabel})
            </option>
          ))}
        </select>
      </div>

      <div className="form-field">
        <label htmlFor="quantity" className="form-label">
          Quantity
        </label>
        <input
          id="quantity"
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => setQuantity(Math.floor(Number(e.target.value)))}
          className="form-input"
        />
        {errors.quantity && <p className="field-error">{errors.quantity}</p>}
      </div>

      <div className="form-field">
        <label htmlFor="customerId" className="form-label">
          Customer ID
        </label>
        <input
          id="customerId"
          type="text"
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          placeholder="e.g. CUST-001"
          className="form-input"
        />
        {errors.customerId && <p className="field-error">{errors.customerId}</p>}
      </div>

      <div className="form-field">
        <label htmlFor="customerAddress" className="form-label">
          Shipping Address
        </label>
        <textarea
          id="customerAddress"
          rows={3}
          value={customerAddress}
          onChange={(e) => setCustomerAddress(e.target.value)}
          placeholder="123 Main St, New York, NY 10001"
          className="form-input"
        />
        {errors.customerAddress && <p className="field-error">{errors.customerAddress}</p>}
      </div>

      <button type="submit" disabled={submitting} className="btn btn-primary btn-block">
        {submitting ? 'Placing order…' : 'Place Order'}
      </button>
    </form>
  );
}
