import { proxyActivities } from '@temporalio/workflow';

import type * as activities from '../activities';
import type { CalculateShippingInput, CalculateShippingResult } from '../shared/types';

const { calculateShippingActivity } = proxyActivities<typeof activities>({
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

export async function shippingChildWorkflow(
  input: CalculateShippingInput,
): Promise<CalculateShippingResult> {
  return calculateShippingActivity(input);
}
