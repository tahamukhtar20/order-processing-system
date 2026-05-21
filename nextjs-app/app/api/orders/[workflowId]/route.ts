import { NextRequest, NextResponse } from 'next/server';

import { getOrderStatus, OrderNotFoundError } from '@/lib/order-status';

type Params = { params: { workflowId: string } };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const data = await getOrderStatus(params.workflowId);
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof OrderNotFoundError) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }
    console.error('Failed to get workflow status:', e);
    return NextResponse.json({ error: 'Failed to fetch workflow status' }, { status: 503 });
  }
}
