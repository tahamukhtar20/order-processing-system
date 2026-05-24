# Order Processing System

A full-stack order processing application built with **Temporal** (durable workflow orchestration) and **Next.js** (App Router, SSR, SSE).

---

## What it does

1. A customer fills out an order form (product, quantity, address).
2. A Temporal workflow runs three sequential activities: check inventory, process payment, calculate shipping.
3. The status page streams live progress via Server-Sent Events and shows the final order summary on completion.

---

## Repository structure

```
order-processing-system/
+-- temporal-worker/      # Temporal workflow + activities (Node.js)
+-- nextjs-app/           # Next.js full-stack app (UI + API routes)
+-- docs/
|   +-- ARCHITECTURE.md   # Design decisions and system overview
|   +-- API.md            # Full API reference
|   +-- TEST_SCENARIOS.md # Four walkthrough scenarios
+-- docker-compose.yml              # All services (full stack)
+-- docker-compose.temporal-only.yml # Temporal server only
```

---

## Running locally (recommended for development)

### Prerequisites

- Node.js 20+
- Docker + Docker Compose

### 1. Start Temporal

```bash
docker compose -f docker-compose.temporal-only.yml up -d
```

Temporal UI is available at `http://localhost:8080`.

### 2. Start everything with one script

```bash
./dev.sh
```

This starts the Temporal worker and the Next.js dev server in parallel with labelled log output. The app is available at `http://localhost:3000`.

### 3. Or start services individually

```bash
# Terminal 1  -  worker
cd temporal-worker
npm install
npm run dev

# Terminal 2  -  Next.js
cd nextjs-app
npm install
npm run dev
```

---

## Running with Docker (full stack)

Builds and starts all services - Temporal, Temporal UI, the worker, and the Next.js app - in a single network.

```bash
docker compose up --build
```

| Service       | URL                   |
| ------------- | --------------------- |
| Next.js app   | http://localhost:3000 |
| Temporal UI   | http://localhost:8080 |
| Temporal gRPC | localhost:7233        |

---

## Environment variables

| Variable               | Default          | Description                                                          |
| ---------------------- | ---------------- | -------------------------------------------------------------------- |
| `TEMPORAL_ADDRESS`     | `localhost:7233` | Temporal frontend address (used by both worker and Next.js)          |
| `PAYMENT_FAILURE_RATE` | `0.2`            | Fraction of payments that fail (0 = always succeed, 1 = always fail) |
| `TEMPORAL_DB_USER`     | `temporal`       | Postgres user for Temporal server                                    |
| `TEMPORAL_DB_PASSWORD` | `temporal`       | Postgres password for Temporal server                                |

---

## Running tests

```bash
# From repo root  -  runs all workspaces
npm test

# Worker only (activity unit tests + workflow integration tests)
cd temporal-worker && npm test

# Next.js only (component tests + API integration tests)
cd nextjs-app && npm test
```

The workflow integration tests use `TestWorkflowEnvironment.createTimeSkipping()` - no live Temporal server needed.

---

## Documentation

- [Architecture](docs/ARCHITECTURE.md) - why Temporal, workflow design, SSR/SSE choice, trade-offs
- [API Reference](docs/API.md) - all routes, request/response shapes, status codes
- [Test Scenarios](docs/TEST_SCENARIOS.md) - four walkthrough scenarios with curl commands
