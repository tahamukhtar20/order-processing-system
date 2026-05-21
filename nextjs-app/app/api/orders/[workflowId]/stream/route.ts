import { NextRequest } from 'next/server';

import { getOrderStatus, OrderNotFoundError } from '@/lib/order-status';

export const dynamic = 'force-dynamic';

const POLL_INTERVAL_MS = 800;
const TERMINAL_STATUSES = new Set(['COMPLETED', 'FAILED', 'TIMED_OUT']);

type Params = { params: { workflowId: string } };

export async function GET(_req: NextRequest, { params }: Params) {
  const { workflowId } = params;

  const encoder = new TextEncoder();

  function sseEvent(data: unknown): Uint8Array {
    return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        while (true) {
          let status;
          try {
            status = await getOrderStatus(workflowId);
          } catch (e) {
            if (e instanceof OrderNotFoundError) {
              controller.enqueue(sseEvent({ error: 'not_found' }));
            } else {
              controller.enqueue(sseEvent({ error: 'server_error' }));
            }
            controller.close();
            return;
          }

          controller.enqueue(sseEvent(status));

          if (TERMINAL_STATUSES.has(status.status)) {
            controller.close();
            return;
          }

          await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        }
      } catch {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
