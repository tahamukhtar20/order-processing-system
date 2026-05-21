import { WorkflowFailedError, WorkflowNotFoundError } from '@temporalio/client';
import { NextRequest, NextResponse } from 'next/server';

import { getTemporalClient } from '@/lib/temporal-client';
import type { ProcessOrderResult, WorkflowStatus } from '@worker-types';

// Proto temporal.api.enums.v1.WorkflowExecutionStatus numeric codes
const WF = { RUNNING: 1, COMPLETED: 2, FAILED: 3, CANCELLED: 4, TIMED_OUT: 7 } as const;

type Params = { params: Promise<{ workflowId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { workflowId } = await params;

  try {
    const client = await getTemporalClient();
    const handle = client.workflow.getHandle(workflowId);
    const description = await handle.describe();
    const code = description.status as unknown as number;

    if (code === WF.RUNNING) {
      const queryStatus = await handle.query<WorkflowStatus>('getStatus');
      const progress = await handle.query<number>('getProgress');
      return NextResponse.json({ workflowId, status: 'RUNNING', ...queryStatus, progress });
    }

    if (code === WF.COMPLETED) {
      const result = (await handle.result()) as ProcessOrderResult;
      const isCancelled = 'cancelled' in result && result.cancelled;
      return NextResponse.json({
        workflowId,
        status: 'COMPLETED',
        phase: isCancelled ? 'cancelled' : 'completed',
        progress: 100,
        result,
      });
    }

    // FAILED, TIMED_OUT, CANCELLED (external), or other terminal state
    const mappedStatus = code === WF.TIMED_OUT ? 'TIMED_OUT' : 'FAILED';
    try {
      await handle.result();
      return NextResponse.json({ workflowId, status: mappedStatus, phase: 'failed' });
    } catch (e) {
      const cause = e instanceof WorkflowFailedError ? e.cause : undefined;
      return NextResponse.json({
        workflowId,
        status: mappedStatus,
        phase: 'failed',
        error: (cause as Error | undefined)?.message ?? String(e),
        errorType: (cause as { type?: string } | undefined)?.type,
      });
    }
  } catch (e) {
    if (e instanceof WorkflowNotFoundError) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }
    console.error('Failed to get workflow status:', e);
    return NextResponse.json({ error: 'Failed to fetch workflow status' }, { status: 503 });
  }
}
