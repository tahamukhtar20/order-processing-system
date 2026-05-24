import {
  ApplicationFailure,
  defineQuery,
  defineSignal,
  executeChild,
  proxyActivities,
  setHandler,
} from '@temporalio/workflow';

import type * as activities from '../activities';
import type { ProcessOrderInput, ProcessOrderResult, WorkflowStatus } from '../shared/types';
import { shippingChildWorkflow } from './shippingChildWorkflow';

const { checkInventoryActivity, processPaymentActivity } = proxyActivities<typeof activities>({
  startToCloseTimeout: '30 seconds',
  retry: {
    initialInterval: '1s',
    backoffCoefficient: 2,
    maximumInterval: '10s',
    maximumAttempts: 3,
    nonRetryableErrorTypes: [
      'InventoryUnavailable',
      'PaymentDeclined',
      'UnknownProduct',
      'InvalidInput',
    ],
  },
});

export const getStatusQuery = defineQuery<WorkflowStatus>('getStatus');
export const getProgressQuery = defineQuery<number>('getProgress');
export const cancelOrderSignal = defineSignal('cancelOrder');

export async function ProcessOrderWorkflow(input: ProcessOrderInput): Promise<ProcessOrderResult> {
  const { productId, quantity, customerId, customerAddress } = input;

  let cancelRequested = false;
  const status: WorkflowStatus = { phase: 'pending', progress: 0 };

  setHandler(cancelOrderSignal, () => {
    cancelRequested = true;
  });
  setHandler(getStatusQuery, () => status);
  setHandler(getProgressQuery, () => status.progress);

  if (cancelRequested) {
    status.phase = 'cancelled';
    status.progress = 100;
    return { cancelled: true };
  }

  status.phase = 'checking-inventory';
  status.progress = 10;

  const inventory = await checkInventoryActivity({ productId, quantity });
  status.inventory = inventory;
  status.progress = 33;

  if (!inventory.available) {
    status.phase = 'failed';
    status.error = `Insufficient inventory for ${productId}`;
    throw ApplicationFailure.nonRetryable(status.error, 'InventoryUnavailable');
  }

  if (cancelRequested) {
    status.phase = 'cancelled';
    status.progress = 100;
    return { cancelled: true };
  }

  status.phase = 'processing-payment';
  status.progress = 40;

  const payment = await processPaymentActivity({
    reservedQuantity: inventory.reservedQuantity,
    unitPrice: inventory.unitPrice,
    customerId,
  });
  status.payment = payment;
  status.progress = 66;

  if (!payment.paymentSuccessful) {
    status.phase = 'failed';
    status.error = 'Payment declined';
    throw ApplicationFailure.nonRetryable(status.error, 'PaymentDeclined');
  }

  if (cancelRequested) {
    status.phase = 'cancelled';
    status.progress = 100;
    return { cancelled: true };
  }

  status.phase = 'calculating-shipping';
  status.progress = 75;

  const shipping = await executeChild(shippingChildWorkflow, {
    args: [
      {
        reservedQuantity: inventory.reservedQuantity,
        totalAmount: payment.totalAmount,
        customerAddress,
      },
    ],
  });
  status.shipping = shipping;
  status.progress = 100;
  status.phase = 'completed';

  return { inventory, payment, shipping };
}
