import { ApplicationFailure } from '@temporalio/common';
import { MockActivityEnvironment } from '@temporalio/testing';

import { calculateShippingActivity } from '../src/activities/calculateShippingActivity';
import { checkInventoryActivity } from '../src/activities/checkInventoryActivity';
import { processPaymentActivity } from '../src/activities/processPaymentActivity';
import { resetInventoryForTesting } from '../src/shared/inventory';
import type {
  CalculateShippingResult,
  CheckInventoryResult,
  ProcessPaymentResult,
} from '../src/shared/types';

beforeEach(() => {
  resetInventoryForTesting();
});

describe('checkInventoryActivity', () => {
  it('reserves stock and returns result for a valid in-stock product', async () => {
    const env = new MockActivityEnvironment();
    const result = (await env.run(checkInventoryActivity, {
      productId: 'SKU-1001',
      quantity: 2,
    })) as CheckInventoryResult;
    expect(result.available).toBe(true);
    expect(result.reservedQuantity).toBe(2);
    expect(result.unitPrice).toBe(19.99);
  });

  it('throws InventoryUnavailable when quantity exceeds stock', async () => {
    const env = new MockActivityEnvironment();
    await expect(
      env.run(checkInventoryActivity, { productId: 'SKU-1004', quantity: 10 }),
    ).rejects.toMatchObject({ type: 'InventoryUnavailable' });
  });

  it('throws InventoryUnavailable for an out-of-stock product', async () => {
    const env = new MockActivityEnvironment();
    await expect(
      env.run(checkInventoryActivity, { productId: 'SKU-1005', quantity: 1 }),
    ).rejects.toMatchObject({ type: 'InventoryUnavailable' });
  });

  it('throws UnknownProduct for an unrecognised product ID', async () => {
    const env = new MockActivityEnvironment();
    await expect(
      env.run(checkInventoryActivity, { productId: 'SKU-9999', quantity: 1 }),
    ).rejects.toMatchObject({ type: 'UnknownProduct' });
  });

  it('throws a non-retryable ApplicationFailure for business errors', async () => {
    const env = new MockActivityEnvironment();
    const err = await env
      .run(checkInventoryActivity, { productId: 'SKU-9999', quantity: 1 })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApplicationFailure);
    expect((err as ApplicationFailure).nonRetryable).toBe(true);
  });

  it('throws InvalidInput for zero or negative quantity', async () => {
    const env = new MockActivityEnvironment();
    await expect(
      env.run(checkInventoryActivity, { productId: 'SKU-1001', quantity: 0 }),
    ).rejects.toMatchObject({ type: 'InvalidInput' });
  });
});

describe('processPaymentActivity', () => {
  const BASE_INPUT = { reservedQuantity: 3, unitPrice: 19.99, customerId: 'CUST-001' };
  let originalFailureRate: string | undefined;

  beforeEach(() => {
    originalFailureRate = process.env['PAYMENT_FAILURE_RATE'];
  });

  afterEach(() => {
    if (originalFailureRate === undefined) {
      delete process.env['PAYMENT_FAILURE_RATE'];
    } else {
      process.env['PAYMENT_FAILURE_RATE'] = originalFailureRate;
    }
  });

  it('calculates totalAmount correctly', async () => {
    process.env['PAYMENT_FAILURE_RATE'] = '0';
    const env = new MockActivityEnvironment();
    const result = (await env.run(processPaymentActivity, BASE_INPUT)) as ProcessPaymentResult;
    expect(result.totalAmount).toBe(59.97);
  });

  it('returns a TXN- prefixed transactionId on success', async () => {
    process.env['PAYMENT_FAILURE_RATE'] = '0';
    const env = new MockActivityEnvironment();
    const result = (await env.run(processPaymentActivity, BASE_INPUT)) as ProcessPaymentResult;
    expect(result.paymentSuccessful).toBe(true);
    expect(result.transactionId).toMatch(/^TXN-/);
  });

  it('returns paymentSuccessful=false and empty transactionId when forced to fail', async () => {
    process.env['PAYMENT_FAILURE_RATE'] = '1';
    const env = new MockActivityEnvironment();
    const result = (await env.run(processPaymentActivity, {
      reservedQuantity: 1,
      unitPrice: 9.99,
      customerId: 'CUST-001',
    })) as ProcessPaymentResult;
    expect(result.paymentSuccessful).toBe(false);
    expect(result.transactionId).toBe('');
    expect(result.totalAmount).toBe(9.99);
  });
});

describe('calculateShippingActivity', () => {
  it('calculates base shipping cost for a standard address', async () => {
    const env = new MockActivityEnvironment();
    const result = (await env.run(calculateShippingActivity, {
      reservedQuantity: 2,
      totalAmount: 39.98,
      customerAddress: '123 Main St, Springfield, IL 62701',
    })) as CalculateShippingResult;
    // 5 + 1.5*2 = 8.00
    expect(result.shippingCost).toBe(8.0);
    expect(result.finalTotal).toBe(47.98);
  });

  it('applies remote surcharge for AK addresses', async () => {
    const env = new MockActivityEnvironment();
    const result = (await env.run(calculateShippingActivity, {
      reservedQuantity: 1,
      totalAmount: 19.99,
      customerAddress: '456 Northern Rd, Anchorage, AK 99501',
    })) as CalculateShippingResult;
    // 5 + 1.5 + 10 = 16.50
    expect(result.shippingCost).toBe(16.5);
  });

  it('applies remote surcharge for HI addresses', async () => {
    const env = new MockActivityEnvironment();
    const result = (await env.run(calculateShippingActivity, {
      reservedQuantity: 1,
      totalAmount: 9.99,
      customerAddress: '789 Aloha Ave, Honolulu, HI 96801',
    })) as CalculateShippingResult;
    expect(result.shippingCost).toBe(16.5);
  });

  it('returns estimatedDelivery as an ISO date string', async () => {
    const env = new MockActivityEnvironment();
    const result = (await env.run(calculateShippingActivity, {
      reservedQuantity: 1,
      totalAmount: 10,
      customerAddress: '1 Test St, New York, NY 10001',
    })) as CalculateShippingResult;
    expect(result.estimatedDelivery).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
