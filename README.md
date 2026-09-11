# Strata402

### Autonomous DeFi Intelligence on Hedera — x402 Pay-Per-Call

> A real, paid AI DeFi strategy endpoint on Hedera testnet, gated by the
> [x402 v2](https://x402.org) payment protocol and settled through Blocky402.

---

## 1. Overview

Strata402 is an HTTP-native, x402-gated metered API gateway for AI DeFi
intelligence on Hedera. A single autonomous consuming agent proves the full
machine-to-machine payment loop end-to-end:

1. Agent sends an unpaid `POST /v1/strategy/yield-risk`.
2. Gateway returns **HTTP 402** + a machine-readable `PAYMENT-REQUIRED` header.
3. Agent signs a real HBAR x402 transfer and returns the `PAYMENT-SIGNATURE` header.
4. Gateway verifies, settles through Blocky402, and returns a paid JSON analysis
   with the `PAYMENT-RESPONSE` header.

**Nothing is mocked.** The demo is a real testnet HBAR transfer with a real
on-chain transaction.

---

## 2. Proof of End-to-End Success

A real paid request was settled on Hedera testnet on 2026-09-10:

| Field | Value |
| :--- | :--- |
| Transaction ID | `0.0.9185802-1789101908-717608026` |
| Payer | `0.0.10329902` |
| Pay-to (service account) | `0.0.10464194` |
| Amount | 1,000,000 tinybars = 0.01 HBAR |
| Protocol | x402 v2 / `exact` scheme |
| Network | `hedera:testnet` |
| Settlement | Blocky402 `verify` + `settle` succeeded |
| HTTP status after settlement | `200 OK` |
| Settlement verified | `true` |

You can verify this transaction on HashScan:
`https://hashscan.io/testnet/transaction/0.0.9185802-1789101908-717608026`

---

## 3. Architecture

```
┌──────────────────────────────────────────────────────────┐
│                   CONSUMING AGENT                        │
│        apps/consuming-agent (CLI, autonomous payer)      │
└────────────────────────┬─────────────────────────────────┘
                         │  HTTP + x402 v2 canonical headers
                         │  PAYMENT-REQUIRED / PAYMENT-SIGNATURE
                         ▼
┌──────────────────────────────────────────────────────────┐
│                API GATEWAY (Express)                      │
│  GET /health          free                               │
│  GET /v1/services     free (service discovery)           │
│  POST /v1/strategy/yield-risk   PAID (x402 v2 guard)    │
└────────┬─────────────┬───────────────────┬───────────────┘
         │             │                   │
         ▼             ▼                   ▼
   Mirror Node    Blocky402          x402-sdk
   (real reads)   /verify + /settle  (shared contract)
```

---

## 4. What Is Implemented

| Component | Status | Details |
| :--- | :--- | :--- |
| API Gateway (`services/api-gateway`) | Done | Express, x402 v2 middleware, Mirror Node reads, yield-risk endpoint |
| Shared SDK (`packages/x402-sdk`) | Done | Canonical constants, service catalog, yield-risk request contract |
| Consuming Agent (`apps/consuming-agent`) | Done | Discovery, challenge, x402 payment, retry, Mirror verification |
| Hardened Request Contract | Done | Shared `{ accountId, riskTolerance, amountHbar }` — 400 before any mirror read |
| Fail-Closed Payment Validation | Done | Wrong network/asset/amount/scheme → rejected, zero signed requests |
| Mirror Node Analysis | Done | Honest account-level on-chain facts with freshness + limitations |
| Phase 7A Stabilization | Done | Typecheck green, 174 tests pass, live mirror verified |

**Out of scope (explicitly deferred):** Smart contracts, Frontend, SaucerSwap
adapter, Bonzo adapter, HCS audit, AI engine, dynamic pricing, HTS payments.

---

## 5. Quick Start

### Prerequisites
- Bun `>=1.1` (works at 1.2.13) or Node `>=20`
- A funded Hedera testnet account

### Install
```bash
bun install
```

### Environment
```bash
cp .env.example .env
# Fill in your Hedera testnet account credentials in .env
```

### Run the Gateway
```bash
bun services/api-gateway/src/index.ts
# Gateway runs at http://localhost:8080
```

### Run the Consuming Agent (C1 paid request)
```bash
# Set your C1 environment
export C1_CONFIRM=true
export HEDERA_SERVICE_ACCOUNT_ID=0.0.xxxxxx
export HEDERA_SERVICE_ACCOUNT_KEY=your-private-key
export STRATA402_ALLOWED_PAYTO=0.0.xxxxxx
export X402_FACILITATOR_URL=https://x402.org/facilitator

# Run the agent
bun apps/consuming-agent/src/cli-c1-paid.ts
```

---

## 6. API Reference

### `GET /health` — FREE
Returns service status.
```json
{ "status": "ok", "service": "strata402-api-gateway", "version": "0.1.0" }
```

### `GET /v1/services` — FREE
Service discovery. Returns the single `yield-risk` service with full metadata
(network, asset, price, payTo, facilitator).

### `POST /v1/strategy/yield-risk` — PAID (x402 v2)

**Request body (shared contract):**
```json
{
  "accountId": "0.0.10464194",
  "riskTolerance": "balanced",
  "amountHbar": 1
}
```

| Field | Type | Rules |
| :--- | :--- | :--- |
| `accountId` | string | Required. Valid Hedera account `0.0.xxxxx`. Not `0.0.0`. Max 19 digits. |
| `riskTolerance` | string | Required. `conservative`, `balanced`, or `aggressive`. |
| `amountHbar` | number | Required. Positive, finite, max 1,000,000. Safe tinybar precision. |

**Unpaid → HTTP 402**
```text
HTTP/1.1 402 Payment Required
PAYMENT-REQUIRED: <base64-encoded PaymentRequired>
```

**Paid → HTTP 200**
Returns structured analysis with `observed` (account, balance, recent30d),
`derivedMetrics`, `freshnessHealth`, `unavailable` (protocol-specific features
not claimed), `limitations`, `payment` block, and `disclaimer`.

**Contract violation → HTTP 400**
```json
{
  "status": "error",
  "code": "invalid_request_contract",
  "message": "Request does not satisfy the yield-risk contract: ...",
  "issues": ["missing_accountId"]
}
```

---

## 7. The Yield-Risk Contract (Shared Between Gateway and Agent)

The contract is defined in `packages/x402-sdk/src/yield-risk-contract.ts` and
used identically by both the gateway (server-side rejection) and the consuming
agent (fail-closed pre-send validation).

Key invariants:
- **Gateway:** malformed body → HTTP 400 **before** any Mirror Node read. No
  paid caller is charged for an invalid contract.
- **Agent:** `buildYieldRiskRequestBody()` validates via the same parser and
  throws `YieldRiskRequestError` before any x402 payment is attempted.
- **No fabricated data:** if Mirror reads fail, the response degrades to
  `dataUnavailable: true` with neutral indications — never fake risk scores.

---

## 8. Fail-Closed Payment Validation

The consuming agent validates the x402 challenge **before** forming any
`PAYMENT-SIGNATURE`. Any of the following causes immediate abort with zero
on-chain spend:

| Check | Error code | What happens |
| :--- | :--- | :--- |
| Wrong network | `NETWORK` | Aborted, zero signatures formed |
| Wrong asset | `ASSET` | Aborted, zero signatures formed |
| Wrong amount | `AMOUNT` | Aborted, zero signatures formed |
| Wrong scheme | `SCHEME` | Aborted, zero signatures formed |
| payTo mismatch (402 vs catalog) | `PAYTO_MISMATCH` | Aborted before signing |
| payer == payTo | `PAYER_EQUALS_PAYTO` | Aborted before signing |

---

## 9. Mirror Node Analysis

The gateway reads real Hedera Testnet Mirror Node data:

```
GET https://testnet.mirrornode.hedera.com/api/v1/accounts/{accountId}
GET https://testnet.mirrornode.hedera.com/api/v1/transactions?account.id={accountId}&limit=100&order=desc
```

The response includes:
- **`scope`**: `"account-level on-chain risk"` — explicitly scoped
- **`source`**: `"hedera-mirror-node"` — data provenance
- **`observed`**: account existence, balance (tinybars + HBAR), token count,
  30-day transaction count, HBAR in/out
- **`derivedMetrics`**: net 30-day HBAR flow
- **`freshnessHealth`**: `fresh`, `stale`, or `unknown`
- **`unavailable`**: live pool APY, SaucerSwap data, Bonzo data, etc.
- **`limitations`**: no protocol APY, no SaucerSwap, no Bonzo, no auto-fund
- **No `riskScore` or `confidence`** — not invented

---

## 10. Monorepo Structure

```
strata402/
├── apps/
│   └── consuming-agent/          # CLI autonomous x402 payer
├── packages/
│   └── x402-sdk/                 # shared constants, catalog, request contract
├── services/
│   ├── api-gateway/              # Express gateway + x402 v2 + Mirror reads
│   └── ai-engine/                # scaffold (Phase 8A: Verified DeFi Data)
├── tests/
│   ├── unit/                     # contract parsing, handler fixture tests
│   └── integration/              # live gateway, Mirror, C1 full flow
├── scripts/
│   └── validate-workspaces.mjs
├── .env.example
├── package.json
├── bun.lockb
└── tsconfig.json
```

---

## 11. Testing

### Run all tests (unit + integration, no network)
```bash
bun test
```

### Run typecheck
```bash
bun run typecheck
```

### Run workspace validation
```bash
bun run validate
```

### Run live Mirror Node integration (read-only, no payment)
```bash
RUN_MIRROR_INTEGRATION=true bun test tests/integration/mirror-analysis.test.ts
```

### Run live Gateway integration (402 challenge, no payment)
```bash
RUN_GATEWAY_INTEGRATION=true bun test tests/integration/challenge-gateway.test.ts
```

---

## 12. Verification on Hedera

After a successful paid request, verify the transaction on HashScan:

```
https://hashscan.io/testnet/transaction/{transactionId}
```

The transaction shows:
- Sender (payer) address
- Receiver (service payTo) address
- Amount in tinybars (1,000,000 = 0.01 HBAR)
- Consensus timestamp
- `SUCCESS` result

---

## 13. Environment Variables

| Variable | Purpose | Default |
| :--- | :--- | :--- |
| `HEDERA_NETWORK` | Hedera network name | `testnet` |
| `STRATA_NETWORK` | CAIP-2 network | `hedera:testnet` |
| `HEDERA_MIRROR_NODE_URL` | Mirror node base URL | `https://testnet.mirrornode.hedera.com` |
| `HEDERA_SERVICE_ACCOUNT_ID` | Service account / payTo | — |
| `HEDERA_SERVICE_ACCOUNT_KEY` | Service account private key | — |
| `X402_FACILITATOR_URL` | Blocky402 facilitator endpoint | `https://x402.org/facilitator` |
| `X402_PRICE_TINYBARS` | Price per call in tinybars | `1000000` |
| `X402_ASSET` | HBAR asset CAIP-2 ID | `0.0.0` |
| `STRATA402_RISK_TOLERANCE` | Default risk tolerance for agent | `balanced` |
| `STRATA402_ANALYSIS_AMOUNT_HBAR` | Default analysis amount (HBAR) | `1` |
| `PORT` | Gateway listen port | `8080` |

---

## 14. Data Sources

| Source | Status | Use |
| :--- | :--- | :--- |
| Hedera Mirror Node REST API | Live (read-only) | Account balance, recent transactions, token balances |
| Blocky402 facilitator | Live (settlement) | x402 v2 `verify` + `settle` for HBAR exact payments |
| SaucerSwap data | Not implemented | Deferred — labeled `unavailable` in responses |
| Bonzo Finance data | Not implemented | Deferred — labeled `unavailable` in responses |
| AI/LLM inference | Not implemented | Deferred — Phase 8A scope |

---

## 15. Security

- **No secrets in code:** `.env` is gitignored; `.env.example` contains only
  placeholders. Private keys are never printed, logged, or committed.
- **`.env.example` hygiene:** paste only placeholders. Never commit real
  account keys, even on testnet.
- **Fail-closed by default:** wrong challenge fields → abort, zero spend.
  Contract violation → HTTP 400 before any Mirror Node or payment call.
- **Minimal privilege:** the service account key is only used for the x402
  payment flow; Mirror Node reads require no authentication.

---

## 16. What Is NOT Claimed

This project explicitly does **not** claim the following as working:

- SaucerSwap or Bonzo Finance integration (adapters not built)
- Live pool APY data
- Automated fund movement or trading
- Smart contract deployment
- Any financial advice, price prediction, or guarantee of return
- Any `riskScore` or `confidence` number — none are produced

The `disclaimer` field in every response states: *"This information is not
financial advice."*

---

## 17. Roadmap (Next After Phase 7A)

| Phase | Description |
| :--- | :--- |
| Phase 8A | **Verified DeFi Data Enrichment** — SaucerSwap/Bonzo adapters with data freshness metadata |
| Phase 8B | AI Engine — LLM-narrated strategy explanation |
| Phase 8C | HCS audit logging |
| Phase 9 | Frontend dashboard (stretch goal) |
| Phase 10 | Smart contracts — HederaYieldVault, AutoSwapLimit |

---

## License

MIT
