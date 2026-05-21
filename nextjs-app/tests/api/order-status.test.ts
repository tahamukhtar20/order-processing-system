/**
 * @jest-environment node
 *
 * Integration tests for getOrderStatus() using a real TestWorkflowEnvironment.
 * These tests exist specifically to catch shape mismatches between mocked SDK
 * responses and what the real Temporal client returns at runtime (e.g. the
 * protobufjs { code, name } enum object vs a plain number for description.status).
 */
import path from 'path';

import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';

import { getOrderStatus, OrderNotFoundError } from '@/lib/order-status';
import * as temporalClientModule from '@/lib/temporal-client';

jest.mock('@/lib/temporal-client');
jest.setTimeout(60_000);

const TASK_QUEUE = 'test-order-status';
const WORKFLOWS_PATH = path.resolve(__dirname, '../../../temporal-worker/src/workflows');

const TEST_INPUT = {
  productId: 'SKU-1001',
  quantity: 1,
  customerId: 'CUST-001',
  customerAddress: '123 Main St, New York, NY',
};

const MOCK_INVENTORY = { available: true, reservedQuantity: 1, unitPrice: 19.99 };
const MOCK_PAYMENT = {
  paymentSuccessful: true,
  transactionId: 'TXN-test-abc',
  totalAmount: 19.99,
};
const MOCK_SHIPPING = { shippingCost: 6.5, estimatedDelivery: '2026-05-28', finalTotal: 26.49 };

const HAPPY_ACTIVITIES = {
  checkInventoryActivity: async () => MOCK_INVENTORY,
  processPaymentActivity: async () => MOCK_PAYMENT,
  calculateShippingActivity: async () => MOCK_SHIPPING,
};

let testEnv: TestWorkflowEnvironment;

beforeAll(async () => {
  testEnv = await TestWorkflowEnvironment.createTimeSkipping();
});

afterAll(async () => {
  await testEnv?.teardown();
});

beforeEach(() => {
  (temporalClientModule.getTemporalClient as jest.Mock).mockResolvedValue(testEnv.client);
});

function wfId(label: string) {
  return `test-os-${label}-${Date.now()}`;
}

async function makeWorker(activities = HAPPY_ACTIVITIES) {
  return Worker.create({
    connection: testEnv.nativeConnection,
    taskQueue: TASK_QUEUE,
    workflowsPath: WORKFLOWS_PATH,
    activities,
  });
}

describe('getOrderStatus', () => {
  it('throws OrderNotFoundError for an unknown workflow ID', async () => {
    await expect(getOrderStatus('does-not-exist')).rejects.toBeInstanceOf(OrderNotFoundError);
  });

  it('returns COMPLETED status with full result on happy path', async () => {
    const worker = await makeWorker();
    const id = wfId('completed');

    await worker.runUntil(
      testEnv.client.workflow.execute('processOrderWorkflow', {
        taskQueue: TASK_QUEUE,
        workflowId: id,
        args: [TEST_INPUT],
      }),
    );

    const result = await getOrderStatus(id);

    expect(result.status).toBe('COMPLETED');
    expect(result.phase).toBe('completed');
    expect(result.progress).toBe(100);
    if (result.status === 'COMPLETED') {
      expect(result.result).toMatchObject({
        inventory: MOCK_INVENTORY,
        payment: MOCK_PAYMENT,
        shipping: MOCK_SHIPPING,
      });
    }
  });

  it('returns FAILED with errorType PaymentDeclined when payment is declined', async () => {
    const worker = await makeWorker({
      ...HAPPY_ACTIVITIES,
      processPaymentActivity: async () => ({
        paymentSuccessful: false,
        transactionId: '',
        totalAmount: 19.99,
      }),
    });
    const id = wfId('payment-fail');

    await worker.runUntil(
      testEnv.client.workflow
        .execute('processOrderWorkflow', {
          taskQueue: TASK_QUEUE,
          workflowId: id,
          args: [TEST_INPUT],
        })
        .catch(() => {}),
    );

    const result = await getOrderStatus(id);

    expect(result.status).toBe('FAILED');
    expect(result.phase).toBe('failed');
    if (result.status === 'FAILED') {
      expect(result.errorType).toBe('PaymentDeclined');
    }
  });

  it('returns FAILED with errorType InventoryUnavailable when stock is short', async () => {
    const worker = await makeWorker({
      ...HAPPY_ACTIVITIES,
      checkInventoryActivity: async () => ({
        available: false,
        reservedQuantity: 0,
        unitPrice: 19.99,
      }),
    });
    const id = wfId('inventory-fail');

    await worker.runUntil(
      testEnv.client.workflow
        .execute('processOrderWorkflow', {
          taskQueue: TASK_QUEUE,
          workflowId: id,
          args: [TEST_INPUT],
        })
        .catch(() => {}),
    );

    const result = await getOrderStatus(id);

    expect(result.status).toBe('FAILED');
    if (result.status === 'FAILED') {
      expect(result.errorType).toBe('InventoryUnavailable');
    }
  });
});
