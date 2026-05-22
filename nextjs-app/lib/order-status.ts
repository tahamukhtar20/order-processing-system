import { WorkflowFailedError, WorkflowNotFoundError } from '@temporalio/client';

import type {
  CalculateShippingResult,
  CheckInventoryResult,
  ProcessOrderResult,
  ProcessPaymentResult,
  WorkflowPhase,
  WorkflowStatus,
} from '@worker-types';

import { getTemporalClient } from './temporal-client';

// description.status arrives as { code: number, name: string } from protobufjs, not a plain number.
// Numeric-code fallback guards against alternate SDK shapes or future changes.
const NUMERIC_STATUS: Record<number, string> = {
  1: 'RUNNING',
  2: 'COMPLETED',
  3: 'FAILED',
  4: 'CANCELLED',
  7: 'TIMED_OUT',
};

function wfStatusName(s: unknown): string {
  if (s && typeof s === 'object' && 'name' in s) return (s as { name: string }).name;
  if (typeof s === 'number') return NUMERIC_STATUS[s] ?? '';
  return '';
}

export type RunningStatus = {
  workflowId: string;
  status: 'RUNNING';
  phase: WorkflowPhase;
  progress: number;
  inventory?: CheckInventoryResult;
  payment?: ProcessPaymentResult;
  shipping?: CalculateShippingResult;
};

export type CompletedStatus = {
  workflowId: string;
  status: 'COMPLETED';
  phase: 'completed' | 'cancelled';
  progress: 100;
  result: ProcessOrderResult;
};

export type FailedStatus = {
  workflowId: string;
  status: 'FAILED' | 'TIMED_OUT';
  phase: 'failed';
  progress: 100;
  error?: string;
  errorType?: string;
};

export type OrderStatusData = RunningStatus | CompletedStatus | FailedStatus;

export class OrderNotFoundError extends Error {
  constructor(workflowId: string) {
    super(`Order workflow ${workflowId} not found`);
    this.name = 'OrderNotFoundError';
  }
}

type KV = Record<string, unknown>;

// Unwraps WorkflowFailedError -> ActivityFailure -> ApplicationFailure.
// Temporal wraps app errors one or two levels deep depending on whether the
// failure originated inside an activity (adds an ActivityFailure wrapper).
function extractAppFailure(e: unknown): { appLike?: KV; wfCause?: KV } {
  if (!(e instanceof WorkflowFailedError)) return {};
  const wfCause = e.cause as KV | undefined;
  if (!wfCause) return {};
  if (typeof wfCause['type'] === 'string') return { appLike: wfCause, wfCause };
  const inner = wfCause['cause'] as KV | undefined;
  if (inner && typeof inner['type'] === 'string') return { appLike: inner, wfCause };
  return { wfCause };
}

export async function getOrderStatus(workflowId: string): Promise<OrderStatusData> {
  const client = await getTemporalClient();
  const handle = client.workflow.getHandle(workflowId);

  let description;
  try {
    description = await handle.describe();
  } catch (e) {
    if (e instanceof WorkflowNotFoundError) {
      throw new OrderNotFoundError(workflowId);
    }
    throw e;
  }

  const sName = wfStatusName(description.status);

  if (sName === 'RUNNING') {
    const queryStatus = await handle.query<WorkflowStatus>('getStatus');
    const progress = await handle.query<number>('getProgress');
    return { workflowId, status: 'RUNNING', ...queryStatus, progress };
  }

  if (sName === 'COMPLETED') {
    const result = (await handle.result()) as ProcessOrderResult;
    const isCancelled = 'cancelled' in result && result.cancelled;
    return {
      workflowId,
      status: 'COMPLETED',
      phase: isCancelled ? 'cancelled' : 'completed',
      progress: 100,
      result,
    };
  }

  // FAILED, TIMED_OUT, CANCELLED (external), or other terminal state
  const mappedStatus: FailedStatus['status'] = sName === 'TIMED_OUT' ? 'TIMED_OUT' : 'FAILED';
  try {
    await handle.result();
    return { workflowId, status: mappedStatus, phase: 'failed', progress: 100 };
  } catch (e) {
    const { appLike, wfCause } = extractAppFailure(e);
    return {
      workflowId,
      status: mappedStatus,
      phase: 'failed',
      progress: 100,
      error: (appLike?.['message'] ?? wfCause?.['message'] ?? String(e)) as string,
      errorType: appLike?.['type'] as string | undefined,
    };
  }
}
