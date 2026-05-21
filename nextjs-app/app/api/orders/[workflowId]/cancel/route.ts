import { WorkflowNotFoundError } from '@temporalio/client';
import { NextRequest, NextResponse } from 'next/server';

import { getTemporalClient } from '@/lib/temporal-client';

type Params = { params: Promise<{ workflowId: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const { workflowId } = await params;

  try {
    const client = await getTemporalClient();
    const handle = client.workflow.getHandle(workflowId);
    await handle.signal('cancelOrder');
    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof WorkflowNotFoundError) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }
    console.error('Failed to cancel workflow:', e);
    return NextResponse.json({ error: 'Failed to cancel workflow' }, { status: 503 });
  }
}
