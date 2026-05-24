# Architecture

## Overview

The system is a full-stack order processing application built on two independently deployable services:

- **`temporal-worker`** - a Node.js process that connects to Temporal and executes workflow and activity logic.
- **`nextjs-app`** - a Next.js App Router application that serves the UI and exposes a REST/SSE API consumed by the frontend.

A Temporal server (self-hosted via Docker) acts as the durable execution engine between them.

```
Browser
  |  HTTP / SSE
  v
Next.js App (port 3000)
  |  Temporal SDK (gRPC :7233)
  v
Temporal Server
  |  task queue: order-processing
  v
Temporal Worker
  +-- ProcessOrderWorkflow
        +-- checkInventoryActivity
        +-- processPaymentActivity
        +-- shippingChildWorkflow
              +-- calculateShippingActivity
```

---

## Why Temporal

Temporal was chosen over a plain async queue or saga pattern for three reasons:

1. **Durable execution** - workflow state survives worker crashes. If the worker restarts mid-order, Temporal replays history and resumes exactly where it left off without re-running completed activities.
2. **Built-in retry & timeout** - retry policies, backoff coefficients, and `startToCloseTimeout` are declared once in the workflow; the SDK enforces them automatically.
3. **Observability** - the Temporal UI shows a full event history for every workflow, making debugging order failures trivial without any extra logging infrastructure.

---

## Workflow design

### `ProcessOrderWorkflow`

Three activities run sequentially:

| Step | Activity                                         | Non-retryable errors                                     |
| ---- | ------------------------------------------------ | -------------------------------------------------------- |
| 1    | `checkInventoryActivity`                         | `InventoryUnavailable`, `UnknownProduct`, `InvalidInput` |
| 2    | `processPaymentActivity`                         | `PaymentDeclined`                                        |
| 3    | `calculateShippingActivity` (via child workflow) | -                                                        |

**Why sequential?** Each step depends on the output of the previous one (inventory reserves stock; payment uses the unit price and quantity; shipping uses the payment total). There is no opportunity for parallelism.

**Child workflow for shipping** - `shippingChildWorkflow` wraps `calculateShippingActivity` to demonstrate Temporal's child workflow feature. In a real system this boundary would be useful if shipping needed its own timeout budget, retry policy, or independent cancellation.

**Queries** - `getStatus` and `getProgress` are registered on the workflow so the Next.js API can read intermediate state (which phase is active, partial results) without waiting for completion.

**Signal** - `cancelOrder` sets a `cancelRequested` flag checked at each cancel-point (before activity 1, between activities 1->2, between activities 2->3). This gives graceful cancellation without forcefully terminating the workflow.

**Retry policy** - activities use exponential backoff (`1s -> 2s -> 4s`, up to 10s cap, 3 attempts). Non-retryable error types short-circuit immediately so transient Temporal errors are retried but business failures (no stock, payment declined) are not.

**Timeouts** - `workflowExecutionTimeout: 5 minutes`, `workflowRunTimeout: 2 minutes`, per-activity `startToCloseTimeout: 30 seconds`.

---

## Next.js API layer

### Route summary

| Method | Path                               | Runtime  | Purpose                      |
| ------ | ---------------------------------- | -------- | ---------------------------- |
| POST   | `/api/orders`                      | Node     | Start a new workflow         |
| GET    | `/api/orders/[workflowId]`         | Node     | Poll current status + result |
| GET    | `/api/orders/[workflowId]/stream`  | Node     | SSE stream of status updates |
| POST   | `/api/orders/[workflowId]/cancel`  | Node     | Send `cancelOrder` signal    |
| GET    | `/api/orders/[workflowId]/history` | Node     | Workflow event history       |
| GET    | `/api/health`                      | **Edge** | Lightweight health check     |

The health route runs on the Edge runtime (no Temporal dependency) so it stays fast and is safe for load-balancer probes.

### Temporal client singleton

`lib/temporal-client.ts` memoizes the `Connection` + `Client` instances at module scope. Next.js dev HMR re-evaluates modules; the singleton pattern prevents creating a new gRPC connection on every hot reload.

### Real-time updates: SSE + polling fallback

The status page prefers **Server-Sent Events** (`/api/orders/[workflowId]/stream`) - a persistent HTTP response where the server pushes `data: {...}\n\n` lines every ~800 ms until the workflow reaches a terminal state. SSE requires no WebSocket upgrade and works through standard HTTP/2 proxies.

If the SSE connection errors, the client retries with exponential backoff (1s -> 2s -> 4s -> 8s). After four failed retries it permanently falls back to serialized `setTimeout` polling against `GET /api/orders/[workflowId]`. The polling loop is serialized (each request waits for the previous response) to avoid overlapping requests under slow networks.

### SSR

Both the home page and the order status page are Server Components that fetch initial data before the page is sent to the browser. The status page passes the first snapshot to `<OrderStatus>` as `initialState`, so the page is meaningful on first paint even before SSE connects.

---

## Middleware

`middleware.ts` runs on every `/api/*` request:

- Attaches a `x-request-id` UUID response header for request correlation.
- Applies a **fixed-window rate limit** (10 `POST /api/orders` per IP per minute) to protect the Temporal server from runaway submissions. Returns 429 with an accurate `Retry-After` header (remaining window time, not the full window length).
