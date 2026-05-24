# Test Scenarios

Four scenarios that exercise the main paths through the system. Each can be run manually via the UI at `http://localhost:3000` or via `curl`.

---

## Scenario 1 - Happy Path

A complete, successful order from start to finish.

**Input**

| Field       | Value                     |
| ----------- | ------------------------- |
| Product     | Widget (SKU-1001)         |
| Quantity    | 2                         |
| Customer ID | CUST-001                  |
| Address     | 123 Main St, New York, NY |

**Expected flow**

1. Workflow starts -> status `RUNNING`, phase `checking-inventory`
2. Inventory check passes -> 2 x $19.99 reserved
3. Payment processes -> total $39.98, transaction ID generated
4. Shipping calculated -> ~$8.00 cost, delivery in 3-7 business days
5. Workflow completes -> status `COMPLETED`, order summary rendered in UI

**Verify**

- All three activity cards show a green checkmark
- Order summary shows correct subtotal ($39.98), shipping, and final total
- Temporal UI shows workflow `Completed` with full event history

```bash
curl -s -X POST http://localhost:3000/api/orders \
  -H 'Content-Type: application/json' \
  -d '{"productId":"SKU-1001","quantity":2,"customerId":"CUST-001","customerAddress":"123 Main St, New York, NY"}' \
  | jq .
```

---

## Scenario 2 - Inventory Shortage

An order for more units than are in stock.

**Input**

| Field       | Value                    |
| ----------- | ------------------------ |
| Product     | Doohickey (SKU-1004)     |
| Quantity    | 10                       |
| Customer ID | CUST-002                 |
| Address     | 456 Oak Ave, Chicago, IL |

**Expected flow**

1. Workflow starts -> phase `checking-inventory`
2. Inventory check: stock is 3, requested 10 -> returns `available: false`
3. Workflow throws `InventoryUnavailable` (non-retryable) -> status `FAILED`
4. UI shows error banner: "Sorry, that quantity is not in stock"

**Verify**

- Inventory activity card shows a red X
- Payment and shipping cards show as skipped
- `errorType` in API response is `InventoryUnavailable`

```bash
curl -s -X POST http://localhost:3000/api/orders \
  -H 'Content-Type: application/json' \
  -d '{"productId":"SKU-1004","quantity":10,"customerId":"CUST-002","customerAddress":"456 Oak Ave, Chicago, IL"}' \
  | jq .
```

---

## Scenario 3 - Payment Failure

Simulate a payment decline. The `processPaymentActivity` has an 80% success rate by default; to force a failure set the environment variable `PAYMENT_FAILURE_RATE=1` before starting the worker.

**Input**

| Field       | Value                   |
| ----------- | ----------------------- |
| Product     | Gadget (SKU-1002)       |
| Quantity    | 1                       |
| Customer ID | CUST-003                |
| Address     | 789 Pine Rd, Austin, TX |

**Setup (force failure)**

```bash
# In temporal-worker/.env or export before npm run dev
PAYMENT_FAILURE_RATE=1
```

**Expected flow**

1. Inventory check passes
2. Payment returns `paymentSuccessful: false`
3. Workflow throws `PaymentDeclined` (non-retryable) -> status `FAILED`
4. UI shows error banner: "Your payment was declined"

**Verify**

- Inventory card green, payment card red X, shipping skipped
- `errorType` in API response is `PaymentDeclined`
- Temporal UI shows `Failed` status with `PaymentDeclined` application failure

```bash
curl -s -X POST http://localhost:3000/api/orders \
  -H 'Content-Type: application/json' \
  -d '{"productId":"SKU-1002","quantity":1,"customerId":"CUST-003","customerAddress":"789 Pine Rd, Austin, TX"}' \
  | jq .
```

---

## Scenario 4 - Network Issues / Resilience

Verify the system handles temporary connectivity loss between Temporal, the worker, and the Next.js app without losing work.

**Input**

| Field       | Value                   |
| ----------- | ----------------------- |
| Product     | Widget (SKU-1001)       |
| Quantity    | 1                       |
| Customer ID | CUST-004                |
| Address     | 321 Elm St, Seattle, WA |

### Part A - Temporal goes offline mid-request

**Steps**

1. Submit an order normally.
2. Immediately stop Temporal: `docker stop temporal` (or stop the Temporal process if running locally).
3. Observe the status page.

**Expected flow**

- The status page's SSE connection drops; `GET /api/orders/[workflowId]` starts returning 503 because the Next.js API cannot reach Temporal.
- The UI shows a yellow "Connection to the server was lost. Retrying..." banner.
- SSE reconnect attempts continue with exponential backoff (1s -> 2s -> 4s -> 8s); after four failures the client falls back to polling.
- Run `docker start temporal`.
- Within a few seconds the next poll succeeds, the banner clears, and the workflow state resumes updating.

**Verify**

- No browser refresh is required to recover.
- The workflow's event history in the Temporal UI is intact (no events lost).

### Part B - Worker goes offline mid-workflow

This demonstrates Temporal's durability guarantee: when no worker is available to execute the next activity, the workflow pauses rather than failing, and resumes exactly where it left off when a worker comes back online.

**Steps**

1. Submit an order.
2. While the workflow is still running, stop the worker: `docker stop order-worker` (or Ctrl+C the worker process).
3. The status page should still load and show the current phase, but no progress is made.
4. Wait a few seconds. The workflow stays in its last known phase.
5. Restart the worker: `docker start order-worker` (or `npm run dev` again).
6. The workflow continues from the next activity it had not yet started.

**Expected flow**

- Completed activities are NOT re-executed (Temporal replays the workflow from event history, skipping completed steps).
- The order eventually completes with the normal happy-path result.

**Verify**

- Temporal UI shows the workflow's event history with a gap where the worker was offline.
- No duplicate inventory reservations or payment transactions.
- The activity that was in flight at the time the worker died is retried per the configured retry policy when the worker resumes.

**Note:** To create a longer observation window for either part, temporarily add `await new Promise(r => setTimeout(r, 10_000))` to one of the activities before recording or testing.
