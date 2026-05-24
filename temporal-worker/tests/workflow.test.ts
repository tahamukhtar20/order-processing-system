import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';

import type * as Activities from '../src/activities';

import {
  cancelOrderSignal,
  getProgressQuery,
  getStatusQuery,
  ProcessOrderWorkflow,
} from '../src/workflows/processOrderWorkflow';
import type {
  CalculateShippingResult,
  CheckInventoryResult,
  ProcessOrderInput,
  ProcessOrderResult,
  ProcessPaymentResult,
  WorkflowStatus,
} from '../src/shared/types';

jest.setTimeout(30_000);

const TASK_QUEUE = 'test-order-processing';

const TEST_INPUT: ProcessOrderInput = {
  productId: 'SKU-1001',
  quantity: 2,
  customerId: 'CUST-001',
  customerAddress: '123 Main St, Springfield, IL 62701',
};

const MOCK_INVENTORY: CheckInventoryResult = {
  available: true,
  reservedQuantity: 2,
  unitPrice: 19.99,
};
const MOCK_PAYMENT: ProcessPaymentResult = {
  paymentSuccessful: true,
  transactionId: 'TXN-test-123',
  totalAmount: 39.98,
};
const MOCK_SHIPPING: CalculateShippingResult = {
  shippingCost: 8.0,
  estimatedDelivery: '2026-05-30',
  finalTotal: 47.98,
};

const HAPPY_ACTIVITIES = {
  checkInventoryActivity: async () => MOCK_INVENTORY,
  processPaymentActivity: async () => MOCK_PAYMENT,
  calculateShippingActivity: async () => MOCK_SHIPPING,
};

let testEnv: TestWorkflowEnvironment;

beforeAll(async () => {
  testEnv = await TestWorkflowEnvironment.createTimeSkipping();
}, 60_000);

afterAll(async () => {
  await testEnv?.teardown();
});

function workflowId(label: string): string {
  return `test-${label}-${Date.now()}`;
}

async function createWorker(mockActivities: Partial<typeof Activities>): Promise<Worker> {
  return Worker.create({
    connection: testEnv.nativeConnection,
    taskQueue: TASK_QUEUE,
    workflowsPath: require.resolve('../src/workflows'),
    activities: mockActivities,
  });
}

describe('ProcessOrderWorkflow', () => {
  it('completes successfully on happy path', async () => {
    const worker = await createWorker(HAPPY_ACTIVITIES);

    const result = (await worker.runUntil(
      testEnv.client.workflow.execute(ProcessOrderWorkflow, {
        taskQueue: TASK_QUEUE,
        workflowId: workflowId('happy'),
        args: [TEST_INPUT],
      }),
    )) as ProcessOrderResult;

    expect(result).not.toMatchObject({ cancelled: true });
    expect(result).toMatchObject({
      inventory: MOCK_INVENTORY,
      payment: MOCK_PAYMENT,
      shipping: MOCK_SHIPPING,
    });
  });

  it('getProgressQuery returns 100 on completion', async () => {
    const worker = await createWorker(HAPPY_ACTIVITIES);

    await worker.runUntil(async () => {
      const handle = await testEnv.client.workflow.start(ProcessOrderWorkflow, {
        taskQueue: TASK_QUEUE,
        workflowId: workflowId('progress'),
        args: [TEST_INPUT],
      });

      await handle.result();

      const progress = (await handle.query(getProgressQuery)) as number;
      expect(progress).toBe(100);
    });
  });

  it('exposes completed status via getStatusQuery after execution', async () => {
    const worker = await createWorker(HAPPY_ACTIVITIES);

    // Query must happen while the worker is still running (queries need a live worker)
    await worker.runUntil(async () => {
      const handle = await testEnv.client.workflow.start(ProcessOrderWorkflow, {
        taskQueue: TASK_QUEUE,
        workflowId: workflowId('status-query'),
        args: [TEST_INPUT],
      });

      await handle.result();

      const status = (await handle.query(getStatusQuery)) as WorkflowStatus;
      expect(status.phase).toBe('completed');
      expect(status.progress).toBe(100);
      expect(status.inventory).toMatchObject(MOCK_INVENTORY);
      expect(status.payment).toMatchObject(MOCK_PAYMENT);
      expect(status.shipping).toMatchObject(MOCK_SHIPPING);

      const progress = (await handle.query(getProgressQuery)) as number;
      expect(progress).toBe(100);
    });
  });

  it('fails with InventoryUnavailable when stock is insufficient', async () => {
    const { ApplicationFailure } = await import('@temporalio/common');

    const worker = await createWorker({
      ...HAPPY_ACTIVITIES,
      checkInventoryActivity: async () => {
        throw ApplicationFailure.nonRetryable('Insufficient stock', 'InventoryUnavailable');
      },
    });

    // Activity errors are wrapped: WorkflowFailedError.cause = ActivityFailure.cause = ApplicationFailure
    await expect(
      worker.runUntil(
        testEnv.client.workflow.execute(ProcessOrderWorkflow, {
          taskQueue: TASK_QUEUE,
          workflowId: workflowId('inventory-fail'),
          args: [TEST_INPUT],
        }),
      ),
    ).rejects.toMatchObject({ cause: { cause: { type: 'InventoryUnavailable' } } });
  });

  it('fails with PaymentDeclined when payment is unsuccessful', async () => {
    const worker = await createWorker({
      ...HAPPY_ACTIVITIES,
      processPaymentActivity: async () => ({
        paymentSuccessful: false,
        transactionId: '',
        totalAmount: 39.98,
      }),
    });

    await expect(
      worker.runUntil(
        testEnv.client.workflow.execute(ProcessOrderWorkflow, {
          taskQueue: TASK_QUEUE,
          workflowId: workflowId('payment-fail'),
          args: [TEST_INPUT],
        }),
      ),
    ).rejects.toMatchObject({ cause: { type: 'PaymentDeclined' } });
  });

  it('cancels gracefully when cancelOrderSignal is received before execution', async () => {
    // Signal before the worker starts so cancellation is in the event history on first task
    const handle = await testEnv.client.workflow.start(ProcessOrderWorkflow, {
      taskQueue: TASK_QUEUE,
      workflowId: workflowId('cancel'),
      args: [TEST_INPUT],
    });
    await handle.signal(cancelOrderSignal);

    const worker = await createWorker(HAPPY_ACTIVITIES);

    await worker.runUntil(async () => {
      const result = (await handle.result()) as ProcessOrderResult;
      expect(result).toMatchObject({ cancelled: true });

      const status = (await handle.query(getStatusQuery)) as WorkflowStatus;
      expect(status.phase).toBe('cancelled');

      const progress = (await handle.query(getProgressQuery)) as number;
      expect(progress).toBe(100);
    });
  });
});
