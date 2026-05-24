# API Reference

Base URL: `http://localhost:3000`

All request/response bodies are JSON. Error responses always include an `error` field.

---

## POST `/api/orders`

Start a new order processing workflow.

### Request body

```json
{
  "productId": "SKU-1001",
  "quantity": 2,
  "customerId": "CUST-001",
  "customerAddress": "123 Main St, New York, NY"
}
```

| Field             | Type    | Required | Description                                        |
| ----------------- | ------- | -------- | -------------------------------------------------- |
| `productId`       | string  | yes      | Must match a product in the catalog (see Products) |
| `quantity`        | integer | yes      | Min 1                                              |
| `customerId`      | string  | yes      | Becomes part of the workflow ID                    |
| `customerAddress` | string  | yes      | Used to calculate shipping cost                    |

### Response `201 Created`

```json
{ "workflowId": "order-CUST-001-1716000000000" }
```

### Error responses

| Status | Cause                                                                       |
| ------ | --------------------------------------------------------------------------- |
| 400    | Missing or invalid fields                                                   |
| 429    | Rate limit exceeded (10 requests/IP/minute) - includes `Retry-After` header |
| 503    | Could not connect to Temporal                                               |

---

## GET `/api/orders/[workflowId]`

Fetch the current status of a workflow.

### Response `200 OK` - running

```json
{
  "workflowId": "order-CUST-001-1716000000000",
  "status": "RUNNING",
  "phase": "processing-payment",
  "progress": 40,
  "inventory": {
    "available": true,
    "reservedQuantity": 2,
    "unitPrice": 19.99
  }
}
```

### Response `200 OK` - completed

```json
{
  "workflowId": "order-CUST-001-1716000000000",
  "status": "COMPLETED",
  "phase": "completed",
  "progress": 100,
  "result": {
    "inventory": { "available": true, "reservedQuantity": 2, "unitPrice": 19.99 },
    "payment": { "paymentSuccessful": true, "transactionId": "TXN-abc123", "totalAmount": 39.98 },
    "shipping": { "shippingCost": 8.0, "estimatedDelivery": "2026-06-01", "finalTotal": 47.98 }
  }
}
```

### Response `200 OK` - completed (cancelled)

```json
{
  "workflowId": "order-CUST-001-1716000000000",
  "status": "COMPLETED",
  "phase": "cancelled",
  "progress": 100,
  "result": { "cancelled": true }
}
```

### Response `200 OK` - failed

```json
{
  "workflowId": "order-CUST-001-1716000000000",
  "status": "FAILED",
  "phase": "failed",
  "progress": 100,
  "error": "Payment declined",
  "errorType": "PaymentDeclined"
}
```

#### `status` values

| Value       | Meaning                                                      |
| ----------- | ------------------------------------------------------------ |
| `RUNNING`   | Workflow is executing                                        |
| `COMPLETED` | Workflow finished (check `phase` for `cancelled` vs success) |
| `FAILED`    | Workflow failed - see `errorType`                            |
| `TIMED_OUT` | Workflow exceeded its execution timeout                      |

#### `errorType` values

| Value                  | Meaning                            |
| ---------------------- | ---------------------------------- |
| `InventoryUnavailable` | Not enough stock                   |
| `UnknownProduct`       | `productId` not found in catalog   |
| `PaymentDeclined`      | Payment processor returned failure |

### Error responses

| Status | Cause                         |
| ------ | ----------------------------- |
| 404    | Workflow ID not found         |
| 503    | Could not connect to Temporal |

---

## GET `/api/orders/[workflowId]/stream`

Server-Sent Events stream of status updates. The server pushes a `data:` event every ~800 ms until the workflow reaches a terminal state (`COMPLETED`, `FAILED`, `TIMED_OUT`), then closes the connection.

### Response headers

```
Content-Type: text/event-stream
Cache-Control: no-cache, no-transform
Connection: keep-alive
```

### Event format

Each event is a JSON-serialised `OrderStatusData` object (same shape as `GET /api/orders/[workflowId]`):

```
data: {"workflowId":"order-CUST-001-...","status":"RUNNING","phase":"checking-inventory","progress":10}

data: {"workflowId":"order-CUST-001-...","status":"COMPLETED","phase":"completed","progress":100,...}

```

### Error events

```
data: {"error":"not_found"}

data: {"error":"server_error"}

```

The connection is closed after an error event.

---

## POST `/api/orders/[workflowId]/cancel`

Send a `cancelOrder` signal to a running workflow. The workflow will complete with `{ cancelled: true }` at the next cancel checkpoint.

### Response `200 OK`

```json
{ "success": true }
```

### Error responses

| Status | Cause                         |
| ------ | ----------------------------- |
| 404    | Workflow ID not found         |
| 503    | Could not connect to Temporal |

---

## GET `/api/orders/[workflowId]/history`

Returns a simplified list of Temporal workflow history events. `eventType` is the raw protobuf enum integer; see the [Temporal `EventType` enum](https://api-docs.temporal.io/#enum-temporal.api.enums.v1.EventType) for the mapping (e.g. `1` is `WorkflowExecutionStarted`, `5` is `WorkflowTaskScheduled`).

### Response `200 OK`

```json
{
  "workflowId": "order-CUST-001-1716384000000",
  "eventCount": 12,
  "events": [
    { "eventId": "1", "eventType": 1 },
    { "eventId": "2", "eventType": 5 }
  ]
}
```

### Response `404 Not Found`

When the workflow does not exist.

---

## GET `/api/health`

Edge-runtime health check. Safe for load-balancer probes.

### Response `200 OK`

```json
{ "status": "ok", "ts": 1716000000000 }
```

---

## Products

Hardcoded catalog used during development and testing:

| SKU      | Name        | Price   | Stock            |
| -------- | ----------- | ------- | ---------------- |
| SKU-1001 | Widget      | $19.99  | 50               |
| SKU-1002 | Gadget      | $49.99  | 10               |
| SKU-1003 | Gizmo       | $9.99   | 200              |
| SKU-1004 | Doohickey   | $129.00 | 3                |
| SKU-1005 | Thingamajig | $4.50   | 0 (out of stock) |
