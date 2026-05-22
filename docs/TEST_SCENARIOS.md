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

## Scenario 4 - Order Cancellation

Cancel a running workflow before it completes.

**Input**

| Field       | Value                   |
| ----------- | ----------------------- |
| Product     | Widget (SKU-1001)       |
| Quantity    | 1                       |
| Customer ID | CUST-004                |
| Address     | 321 Elm St, Seattle, WA |

**Steps**

1. Submit the order via the UI
2. While the status page shows `Running`, click **Cancel order**
3. The app posts to `POST /api/orders/[workflowId]/cancel`

**Expected flow**

- Workflow receives the `cancelOrder` signal
- At the next cancel checkpoint it returns `{ cancelled: true }`
- Status transitions to `COMPLETED` with phase `cancelled`
- UI shows the Cancelled badge and a "Your order was cancelled" message

**Verify**

- Status badge reads "Cancelled" (grey)
- All activity cards show as skipped
- `GET /api/orders/[workflowId]` returns `result: { cancelled: true }`
- Temporal UI shows `Completed` (cancellation is a graceful completion, not a failure)

**Note:** To reliably observe the cancellation window, add a temporary `sleep` to `checkInventoryActivity` during local testing, or cancel immediately after submitting.
