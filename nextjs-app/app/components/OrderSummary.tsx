import { memo } from 'react';

import { formatCurrency, formatDate } from '@/lib/format';
import type {
  CalculateShippingResult,
  CheckInventoryResult,
  ProcessPaymentResult,
} from '@worker-types';

import styles from './OrderSummary.module.css';

interface Props {
  productId: string;
  inventory: CheckInventoryResult;
  payment: ProcessPaymentResult;
  shipping: CalculateShippingResult;
}

function OrderSummary({ productId, inventory, payment, shipping }: Props) {
  return (
    <section className={styles.summary} aria-labelledby="order-summary-heading">
      <h3 id="order-summary-heading" className={styles.heading}>
        Order Confirmed
      </h3>

      <dl className={styles.rows}>
        <dt className={styles.label}>Product</dt>
        <dd className={styles.value}>{productId}</dd>

        <dt className={styles.label}>Quantity</dt>
        <dd className={styles.value}>{inventory.reservedQuantity}</dd>

        <dt className={styles.label}>Unit price</dt>
        <dd className={styles.value}>{formatCurrency(inventory.unitPrice)}</dd>

        <dt className={styles.label}>Subtotal</dt>
        <dd className={styles.value}>{formatCurrency(payment.totalAmount)}</dd>

        <dt className={styles.label}>Shipping</dt>
        <dd className={styles.value}>{formatCurrency(shipping.shippingCost)}</dd>

        <dt className={styles.label}>Estimated delivery</dt>
        <dd className={styles.value}>{formatDate(shipping.estimatedDelivery)}</dd>

        <dt className={styles.label}>Transaction ID</dt>
        <dd className={styles.value}>{payment.transactionId}</dd>
      </dl>

      <div className={styles.total}>
        <span>Total</span>
        <span>{formatCurrency(shipping.finalTotal)}</span>
      </div>
    </section>
  );
}

export default memo(OrderSummary);
