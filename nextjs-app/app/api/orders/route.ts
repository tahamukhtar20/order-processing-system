import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getTemporalClient } from '@/lib/temporal-client';
import type { ProcessOrderInput } from '@worker-types';

const orderSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1),
  customerId: z.string().min(1),
  customerAddress: z.string().min(1),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = orderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const input: ProcessOrderInput = parsed.data;
  const safeId = input.customerId.replace(/[^a-zA-Z0-9_-]/g, '-');
  const workflowId = `order-${safeId}-${Date.now()}`;

  try {
    const client = await getTemporalClient();
    await client.workflow.start('ProcessOrderWorkflow', {
      taskQueue: 'order-processing',
      workflowId,
      args: [input],
      workflowExecutionTimeout: '5 minutes',
      workflowRunTimeout: '2 minutes',
      workflowTaskTimeout: '10 seconds',
    });
    return NextResponse.json({ workflowId }, { status: 201 });
  } catch (e) {
    console.error('Failed to start workflow:', e);
    return NextResponse.json({ error: 'Failed to start order workflow' }, { status: 503 });
  }
}
