import { randomUUID } from 'crypto';

import type { ProcessPaymentInput, ProcessPaymentResult } from '../shared/types';

export async function processPaymentActivity(
  input: ProcessPaymentInput,
): Promise<ProcessPaymentResult> {
  const { reservedQuantity, unitPrice } = input;

  const totalAmount = Math.round(reservedQuantity * unitPrice * 100) / 100;

  // env to configure failure rate
  const failureRate = parseFloat(process.env['PAYMENT_FAILURE_RATE'] ?? '0.2');
  const paymentSuccessful = Math.random() >= failureRate;

  if (!paymentSuccessful) {
    return { paymentSuccessful: false, transactionId: '', totalAmount };
  }

  return {
    paymentSuccessful: true,
    transactionId: `TXN-${randomUUID()}`,
    totalAmount,
  };
}
