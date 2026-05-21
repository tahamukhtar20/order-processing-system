import { ApplicationFailure } from '@temporalio/common';
import { Context } from '@temporalio/activity';

import { inventoryUnavailableError, unknownProductError } from '../shared/errors';
import { getProduct, reserveStock } from '../shared/inventory';
import type { CheckInventoryInput, CheckInventoryResult } from '../shared/types';

export async function checkInventoryActivity(
  input: CheckInventoryInput,
): Promise<CheckInventoryResult> {
  const { productId, quantity } = input;

  if (!Number.isInteger(quantity) || quantity < 1) {
    throw ApplicationFailure.nonRetryable(
      `Invalid quantity: ${quantity}. Must be a positive integer.`,
      'InvalidInput',
    );
  }

  Context.current().heartbeat('checking inventory');

  const product = getProduct(productId);
  if (!product) {
    throw unknownProductError(productId);
  }

  if (product.stock < quantity) {
    throw inventoryUnavailableError(productId, quantity, product.stock);
  }

  reserveStock(productId, quantity);

  Context.current().heartbeat('inventory reserved');

  return {
    available: true,
    reservedQuantity: quantity,
    unitPrice: product.unitPrice,
  };
}
