import { WorkflowNotFoundError } from '@temporalio/client';
import { NextRequest, NextResponse } from 'next/server';

import { getTemporalClient } from '@/lib/temporal-client';

type Params = { params: { workflowId: string } };

export async function GET(_req: NextRequest, { params }: Params) {
  const { workflowId } = params;

  try {
    const client = await getTemporalClient();
    const handle = client.workflow.getHandle(workflowId);
    const history = await handle.fetchHistory();

    const events = (history.events ?? []).map((e) => ({
      eventId: e.eventId?.toString() ?? '0',
      eventType: e.eventType ?? 0,
    }));

    return NextResponse.json({ workflowId, eventCount: events.length, events });
  } catch (e) {
    if (e instanceof WorkflowNotFoundError) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }
    console.error('Failed to fetch workflow history:', e);
    return NextResponse.json({ error: 'Failed to fetch workflow history' }, { status: 503 });
  }
}
