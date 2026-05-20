import { ApplicationFailure } from '@temporalio/common';

export function inventoryUnavailableError(
  productId: string,
  requested: number,
  available: number,
): ApplicationFailure {
  return ApplicationFailure.nonRetryable(
    `Insufficient stock for ${productId}: requested ${requested}, available ${available}`,
    'InventoryUnavailable',
  );
}

export function unknownProductError(productId: string): ApplicationFailure {
  return ApplicationFailure.nonRetryable(`Unknown product: ${productId}`, 'UnknownProduct');
}

export function paymentDeclinedError(totalAmount: number): ApplicationFailure {
  return ApplicationFailure.nonRetryable(
    `Payment declined for amount $${totalAmount.toFixed(2)}`,
    'PaymentDeclined',
  );
}
