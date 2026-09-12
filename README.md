# Strata402

### Autonomous DeFi Intelligence on Hedera — x402 Pay-Per-Call

> A real, paid AI DeFi strategy endpoint on Hedera **testnet**, gated by the
> [x402 v2](https://x402.org) payment protocol, settled through Blocky402, audited
> through HCS, and surfaced through a live Web UI. **Nothing is mocked.**

![CI](https://github.com/samarabdelhameed/Strata402/actions/workflows/ci.yml/badge.svg)
![tests](https://img.shields.io/badge/tests-207%20pass%20%2F%200%20fail-brightgreen)
![live](https://img.shields.io/badge/data-LIVE%20(testnet)-blue)

---

## 1. Overview

Strata402 is an HTTP-native, x402-gated metered API gateway for AI DeFi
intelligence on Hedera. An autonomous consuming agent proves the full
machine-to-machine payment loop end-to-end, and a real-time dashboard lets you
watch every step:

1. Agent (or Web UI) sends an unpaid `POST /v1/strategy/yield-risk`.
2. Gateway returns **HTTP 402** + a machine-readable `PAYMENT-REQUIRED` header.
3. Agent signs a real HBAR x402 transfer and returns the `PAYMENT-SIGNATURE` header.
4. Gateway verifies, settles through Blocky402, publishes the audit record to an
   **HCS topic**, and returns a paid JSON analysis with the `PAYMENT-RESPONSE` header.

Every demo is a **real testnet HBAR transfer with a real on-chain transaction**
and a real HCS message. No mocks, no fixtures, no invented risk scores.

---

## 2. Proof of End-to-End Success

Multiple real paid requests were settled on Hedera testnet. Latest verified run
(via the production Web build):

| Field | Value |
| :--- | :--- |
| Transaction ID | `0.0.9185802-1789164101-943032414` |
| Payer | `0.0.10329902` |
| Pay-to (service account) | `0.0.10464194` |
| Amount | 1,000,000 tinybars = 0.01 HBAR |
| Protocol | x402 v2 / `exact` scheme / `feePayer 0.0.9185802` |
| Network | `hedera:testnet` |
| HCS audit | topic `0.0.10483725`, sequence `7` (growing) |
| Settlement | Blocky402 `verify` + `settle` succeeded |
| HTTP status after settlement | `200 OK` |
| Settlement verified against mirror | `true` |

Verify on HashScan:
`https://hashscan.io/testnet/transaction/0.0.9185802-1789164101-943032414`

Earlier verified runs: `0.0.9185802-1789162601-197120935` (Web paid flow) and
`0.0.9185802-1789101908-717608026` (CLI agent).

---

## 3. Architecture

```
┌──────────────────────────────┐   ┌───────────────────────────────────┐
│        WEB UI (apps/web)      │   │   CONSUMING AGENT                 │
│  Next.js 14 · dark glass UI  │   │   apps/consuming-agent (CLI/payer)│
│  server-side API routes      │   └──────────────┬────────────────────┘
└─────────────┬────────────────┘                  │ HTTP + x402 v2 headers
              │  HTTP / JSON enb                      PAYMENT-REQUIRED/SIGNATURE
              ▼                                     ▼
┌──────────────────────────────────────────────────────────────────────┐
│                  API GATEWAY (Express) — :8080                       │
│   GET /health             free          POST /strategy/yield-risk     │
│   GET /v1/services        free                PAID (x402 v2 guard)    │
└──────┬──────────────┬──────────────┬──────────────────┬──────────────┘
       │              │              │                  │
       ▼              ▼              ▼                  ▼
  Mirror Node     Blocky402      x402-sdk        AI Engine (:8000)
  real reads      /verify+s/fake   shared contract  deterministic narration
                                                  + HCS audit publish
```

Flow components:

- **API Gateway** (`services/api-gateway`) — Express, official x402 v2
  middleware, Mirror Node reads, deterministic yield-risk handler.
- **AI Engine** (`services/ai-engine`) — deterministic strategy narration; never
  fabricates liquidity/APY; marks anything unverified as `unavailable`.
- **HCS Audit** — every handled request is logged to topic `0.0.10483725`.
- **Web UI** (`apps/web`) — Next.js 14, server-side data (no CORS, no browser
  secrets), live mirror/account/topic reads, and a real paid-analysis flow.
- **Shared SDK** (`packages/x402-sdk`) — canonical constants, service catalog,
  yield-risk contract, sophisticated x402 canonical headers.

---

## 4. What Is Implemented

| Component | Status | Details |
| :--- | :--- | :--- |
| API Gateway | **Done** | Express, x402 v2 middleware, Mirror Node reads, yield-risk endpoint |
| Shared SDK (`packages/x402-sdk`) | **Done** | Canonical constants, service catalog, yield-risk contract |
| Consuming Agent | **Done** | Discovery, challenge, x402 payment, retry, Mirror verification |
| AI Engine | **Done** | Deterministic narration over real mirror facts; honest `unavailable` set |
| HCS Audit Logging | **Done** | Live topic `0.0.10483725`, 7+ real records |
| Hardened Request Contract | **Done** | Shared `{ accountId, riskTolerance, amountHbar }` — 400 before any read |
| Fail-Closed Payment Validation | **Done** | Wrong network/asset/amount/scheme → rejected, zero signed requests |
| Mirror Node Analysis | **Done** | Honest account-level on-chain facts with freshness + limitations |
| Web UI (`apps/web`) | **Done** | Dashboard, AI Studio, HCS Auditor, AutoSwap orders (honest gates), paid flow |
| AutoSwap integrators | **Honest gate** | SaucerSwap / Bonzo / HCS-14 shown `PENDING` — no fabricated fills |

**Explicitly out of scope (truthful):** Smart contract deployment, live
SaucerSwap/Bonzo execution (awaiting official protocol keys), HTS payments.

---

## 5. Quick Start

### Prerequisites
- Bun `>=1.1` (tested on 1.2.x) or Node `>=20`

### Install
```bash
bun install
```

### Environment
```bash
cp .env.example .env
# Fill in Hedera testnet payer credentials, allow-list, HCS topic, etc.
```

### Run the Gateway
```bash
bun services/api-gateway/src/index.ts
# Gateway runs at http://localhost:8080   (/health → 200)
```

### Run the AI Engine (optional, enables narration)
```bash
bun services/ai-engine/...
# Engine runs at http://localhost:8000
```

### Run the Web UI (dev)
```bash
cd apps/web
bun install
echo "STRATA402_RUN_C1=true" >> ../.env       # enable live paid flow on the server
echo "STRATA402_C1_CONFIRM=true" >> ../.env
STRATA402_RUN_C1=true STRATA402_C1_CONFIRM=true bun dev
# Web UI at http://localhost:3000
```

### Run the Consuming Agent (CLI C1 paid request)
```bash
# Requires STRATA402_ALLOWED_PAYTO / STRATA402_PAYER_* / X402_FACILITATOR_URL
STRATA402_RUN_C1=true STRATA402_C1_CONFIRM=true bun apps/consuming-agent/src/cli-c1-paid.ts
```

---

## 6. API Reference

### `GET /health` — FREE
```json
{ "status": "ok", "service": "strata402-api-gateway", "version": "0.1.0" }
```

### `GET /v1/services` — FREE
Service discovery: network, currency, `payTo`, and one `yield-risk` service at
1,000,000 tinybars (0.01 HBAR) per call.

### `POST /v1/strategy/yield-risk` — PAID (x402 v2)
**Request body (shared contract):**
```json
{ "accountId": "0.0.10464194", "riskTolerance": "balanced", "amountHbar": 1 }
```

| Field | Type | Rules |
| :--- | :--- | :--- |
| `accountId` | string | Required. Valid `0.0.xxxxx`, not `0.0.0`, ≤ 19 digits. |
| `riskTolerance` | string | Required. `conservative`/`balanced`/`aggressive`. |
| `amountHbar` | number | Required. Positive, finite, ≤ 1,000,000. |

- **Unpaid → `HTTP 402`** + `PAYMENT-REQUIRED` header (feePayer `0.0.9185802`).
- **Paid → `HTTP 200`**: `observed` (account, balance, recent30d), `derivedMetrics`,
  `freshnessHealth`, `unavailable`, `limitations`, `payment`, `disclaimer`.
- **Contract violation → `HTTP 400`** before any Mirror read or charge.

### Web API (`apps/web`, server-side — no CORS)
| Route | Purpose |
| :--- | :--- |
| `GET /api/status` | Gateway health + live service catalog |
| `GET /api/account?accountId=` | Live mirror account snapshot |
| `GET /api/hcs?limit=25` | Live HCS audit messages (base64 decoded) |
| `GET /api/services` | Integrations with honest status |
| `GET /api/paid` | Paid flow availability + price |
| `POST /api/paid` | Runs the real x402 paid analysis (server signs HBAR) |
| `GET /api/payment-proof` | Mirror-verified settlement evidence |

---

## 7. Testing

`207 tests pass` locally against live testnet infrastructure.

```bash
# Full suite, live-integration flags on (gateway :8080 + Mirror must be running)
RUN_GATEWAY_INTEGRATION=true RUN_MIRROR_INTEGRATION=true bun test
# → 207 pass, 0 fail

bun run typecheck    # tsc --noEmit, clean
bun test             # default: unit + read-only integration (network tests self-skip)
```

Live-integration tests cover: real 402 challenge, real discovery, real Mirror
account reads, real paid-handler 200s with mirror facts, real transaction
verification, and fail-closed security cases.

---

## 8. Honesty Contract

Strata402 treats not-invented-here as a feature:

- **No `riskScore`/`confidence`** — never produced.
- **`unavailable[]`** lists live pool APY, SaucerSwap data, Bonzo data until
  they are genuinely integrated.
- **AutoSwap orders** show an explicit `PENDING` gate pending official
  SaucerSwap/Bonzo protocol keys — no fabricated fills.
- Every response carries `source: "hedera-mirror-node"`, `scope`, freshness
  health, and a **disclaimer**: *"This information is not financial advice."*

---

## 9. Environment Variables

| Variable | Purpose | Default |
| :--- | :--- | :--- |
| `HEDERA_SERVICE_ACCOUNT_ID` | Service account / payTo | — |
| `STRATA402_PAYER_ACCOUNT_ID` | Payer account | — |
| `STRATA402_PAYER_PRIVATE_KEY` | Payer ECDSA key (server-only) | — |
| `STRATA402_ALLOWED_PAYTO` | Allow-list for enforced payTo | — |
| `STRATA402_GATEWAY_BASE_URL` | Web → gateway base | `http://127.0.0.1:8080` |
| `STRATA402_MIRROR_BASE_URL` | Mirror Node base | `https://testnet.mirrornode.hedera.com` |
| `HCS_AUDIT_TOPIC_ID` | Live audit topic | — |
| `STRATA402_RUN_C1` | Enable paid C1 on the web server | `false` |
| `STRATA402_C1_CONFIRM` | Explicit confirm for auto-send | `false` |
| `X402_FACILITATOR_URL` | Blocky402 facilitator | `https://x402.org/facilitator` |
| `X402_PRICE_TINYBARS` | Price per call | `1000000` |
| `PORT` | Gateway listen port | `8080` |

Secrets live only in `.env` (gitignored). Nothing secret ever reaches the
browser — all paid signing happens server-side.

---

## 10. Security

- **No secrets in code;** private keys never printed, logged, or committed.
- **Fail-closed by default:** wrong challenge fields → abort, zero spend.
  Contract violation → HTTP 400 before any Mirror Node or payment call.
- **Server-side signing:** the web UI never exposes the payer key.
- **Minimal privilege:** payer key used only for the x402 payment flow; reads
  need no authentication.

---

## 11. What Is NOT Claimed

- Working SaucerSwap/Bonzo execution (adapters gated, awaiting official keys)
- Live pool APY data
- Automated fund movement or trading
- Smart contract deployment
- Any `riskScore` / `confidence` / return guarantee
- Any price prediction or financial advice

---

## 12. Monorepo Structure

```
strata402/
├── apps/
│   ├── consuming-agent/          # CLI autonomous x402 payer (runC1)
│   └── web/                      # Next.js 14 UI — dashboard, studio, auditor
├── packages/
│   └── x402-sdk/                 # shared constants, catalog, request contract
├── services/
│   ├── api-gateway/              # Express gateway + x402 v2 + Mirror reads (:8080)
│   └── ai-engine/                # deterministic narration engine (:8000)
├── tests/
│   ├── unit/                     # contract parsing, handler fixture tests
│   └── integration/              # live gateway, Mirror, C1 full flow
├── scripts/validate-workspaces.mjs
├── .env.example
└── package.json
```

## 13. Roadmap

| Phase | Description |
| :--- | :--- |
| Shipped | Deterministic AI engine · HCS audit logging · Web UI with real-data dashboards |
| Next | AutoSwap + Bonzo official protocol integration (gated until keys exist) |

## License

MIT