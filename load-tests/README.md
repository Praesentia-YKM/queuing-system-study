# Load Tests

## Prerequisites

- [k6](https://k6.io/docs/get-started/installation/) installed
- Backend running at localhost:8080
- MySQL running (docker-compose up)

## Run

```bash
# V1 — Naive (no lock, no queue)
k6 run load-tests/v1-naive.js
```

## What to Look For

### V1
- `reservations_success` counter > 100 = overbooking proven
- `available_seats` goes negative = race condition confirmed
- p95/p99 response times
