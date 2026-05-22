import { NextRequest } from 'next/server';

import { TERMINAL_STATUSES } from '@/lib/constants';
import { getOrderStatus, OrderNotFoundError } from '@/lib/order-status';

export const dynamic = 'force-dynamic';

const POLL_INTERVAL_MS = 800;

type Params = { params: { workflowId: string } };

export async function GET(req: NextRequest, { params }: Params) {
  const { workflowId } = params;
  const { signal } = req;

  const encoder = new TextEncoder();

  function sseEvent(data: unknown): Uint8Array {
    return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
  }

  let cancelled = signal.aborted;
  signal.addEventListener(
    'abort',
    () => {
      cancelled = true;
    },
    { once: true },
  );

  const stream = new ReadableStream({
    async start(controller) {
      try {
        while (!cancelled) {
          let status;
          try {
            status = await getOrderStatus(workflowId);
          } catch (e) {
            if (!cancelled) {
              if (e instanceof OrderNotFoundError) {
                controller.enqueue(sseEvent({ error: 'not_found' }));
              } else {
                controller.enqueue(sseEvent({ error: 'server_error' }));
              }
            }
            controller.close();
            return;
          }

          if (cancelled) {
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
        controller.close();
      } catch {
        controller.close();
      }
    },
    cancel() {
      cancelled = true;
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
