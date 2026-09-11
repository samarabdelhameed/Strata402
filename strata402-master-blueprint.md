# 🎯 Strata402 — Master Blueprint
### Autonomous DeFi Intelligence on Hedera
**Track:** AI & Agentic Payments on Hedera (Hedera Hackathon)

> Status: **MVP COMPLETE — end-to-end paid request verified on Hedera testnet.
> Phase 7A (stabilization, contract hardening & submission evidence) complete.**
> No production (mainnet) code. This blueprint is the single source of truth for the MVP architecture.

---

## 0. Current Implementation Status

> Live proof of the full paid flow (2026-09-10): HTTP 200 after settlement
> (`settlementVerified: true`), transaction
> `0.0.9185802-1789101908-717608026`, payer `0.0.10329902`, payTo `0.0.10464194`,
> 1,000,000 tinybars, `hedera:testnet` — verifiable on HashScan.

### Completed (verified in this repository)

| Area | What is live | Evidence |
| :--- | :--- | :--- |
| API Gateway | Express service, x402 v2 guard, `/health`, `/v1/services`, paid `/v1/strategy/yield-risk` | 402 + `PAYMENT-REQUIRED` challenge live |
| x402 middleware | `@x402/express`, `ExactHederaScheme`, `HTTPFacilitatorClient` | Real Blocky402 settlement on testnet |
| Shared SDK | Canonical constants, header helpers, service catalog | Unit-tested |
| Consuming agent | Discovery → 402 → sign → retry → verify → settle on testnet | Real tx `0.0.9185802-…` settled |
| Mirror analysis | Real Mirror Node account reads (balance, recent 30-day flow), explicit `source` / `freshness` / `limitations`, `dataUnavailable` degradation | `RUN_MIRROR_INTEGRATION=true` green |
| Yield-risk request contract | Shared `{ accountId, riskTolerance, amountHbar }`; 400 before any mirror read; agent fail-closed pre-send | Unit + integration tests |
| Fail-closed payment checks | Wrong network/asset/amount/scheme + payTo mismatch abort with zero signed requests | `tests/integration/c1-paid.test.ts` |
| Security / submission evidence | No secrets in code; `.env.example` placeholders only; public txId documented | `git diff --check` clean |

### Deferred (explicitly out of MVP + Phase 7A scope)

| Item | Status |
| :--- | :--- |
| AI engine / LLM narration (AI DeFi intelligence) | Not started |
| SaucerSwap adapter | Pending official API credentials + live source verification |
| Bonzo Finance adapter | Deferred — no eligible live Testnet source verified on 2026-09-11 |
| Smart contracts (HSCS) | Deferred — never blocks qualification |
| HCS audit topics / HCS-14 discovery | Deferred (post-MVP) |
| Frontend dashboard | Deferred (stretch) |
| Mainnet | Out of scope |
| Dynamic pricing / HTS payments | Stretch only |

> **Phase 8A-0 source-eligibility note (verified 2026-09-11, read-only):**
> - Bonzo Testnet data source unavailable at verification time (documented base URL returns
>   `503`; the current official temporary base is Mainnet-only).
> - Mainnet staging data is excluded from the Hedera Testnet analysis path.
> - SaucerSwap pending official `x-api-key` credential and live source verification.
> - Current analysis remains: **Mirror Node account-level risk only**. Adapters stay in
>   `unavailable` until an eligible live source is proven.

---

## 1. Executive Summary

**Strata402** is a metered AI DeFi intelligence service built for autonomous agents on Hedera. It exposes a real, paid AI inference API (`/v1/strategy/yield-risk`) that produces portfolio risk and yield analysis for Hedera DeFi activity. The endpoint is gated by the **x402 v2 payment protocol**, settled through the **Blocky402 facilitator** in **HBAR** on **Hedera testnet**.

An independent buyer agent (`apps/consuming-agent`) demonstrates the full machine-to-machine economy: it discovers the service, triggers an `HTTP 402 Payment Required`, signs an HBAR x402 payment, submits the partially signed transaction via Blocky402, retries with the canonical `PAYMENT-SIGNATURE` header, and receives a paid AI analysis.

The MVP is deliberately scoped to satisfy the track's qualification requirements with one focused architecture: **one x402-gated AI endpoint + one consuming agent + one real testnet paid request end-to-end**. Yield/risk analysis is real but relies on clearly labeled adapters (Mirror Node) and generated explanations — no unverified claims of live SaucerSwap/Bonzo data.

---

## 2. Project Identity

| Field | Value |
| :--- | :--- |
| Project name | `Strata402` |
| Tagline | Autonomous DeFi Intelligence on Hedera |
| Repository name | `strata402` |
| Root directory | `strata402/` |
| Agent identity | `strata402-agent` |
| Optional Web3 identity | `strata402.eth` (ENS — stretch goal) |

**Naming rule:** everywhere — paths, `package.json` names, npm/Bun workspace names, Docker service names, env vars, code comments, docs — must use `strata402`. The previous project name is permanently retired.

Suggested package naming:
- `strata402-web`, `strata402-consuming-agent`
- `@strata402/api-gateway`, `@strata402/ai-engine` (Python, no package name conflict)
- `@strata402/contracts`
- `@strata402/x402-sdk`

---

## 3. Problem Statement

1. **The intelligence gap.** Retail DeFi users lack accessible context-aware tools to assess portfolio risk and yield opportunities. Institutional funds operate AI-driven quant workflows; retail users are stuck with static dashboards or generic LLMs with no onchain context.
2. **The monetization bottleneck.** AI endpoints are monetized with rigid subscriptions or API-key friction — unfit for machine-to-machine commerce where agents pay per call, per request, with micropayments.
3. **The agentic economy gap on Hedera.** Hedera offers sub-second finality and native asset transfers that are ideal for micropayments, but there are few real, verifiable pay-per-call AI services demonstrating an end-to-end agentic payment flow.

---

## 4. Proposed Solution

**Strata402** is an HTTP-native, x402-gated AI DeFi intelligence service:

- A real **AI inference endpoint** that returns structured DeFi analysis: portfolio risk score, yield opportunity, market context, confidence score, recommendation, disclaimer.
- **Deterministic financial math** (risk score, balance calculations) separated from **generative AI explanation** (strategy narrative).
- Monetized natively via **x402 v2** — the consumer pays HBAR per call through **Blocky402**.
- An **independent consuming agent** that automatically performs discovery → challenge → payment → retry → result.
- **Auditability** via Hedera Consensus Service (HCS) topic logging (post-MVP recommendation).

The value chain: *"AI as a verifiable, programmatically payable utility"* — not a subscription product.

---

## 5. Hedera and x402 Value Proposition

- **Hedera testnet (Chain/SDK):** free HBAR faucet, sub-second finality, native HBAR/HTS transfers, Mirror Node REST API for onchain reads.
- **x402 v2:** an open payment standard where a `402 Payment Required` response carries a machine-readable `PaymentRequired` object (`PAYMENT-REQUIRED` header), and the client returns its payment payload via the `PAYMENT-SIGNATURE` header. Native fit for agent commerce.
- **Blocky402:** the official facilitator that verifies and settles x402 payments, giving a short-lived proof the resource server can validate cheaply.
- **HCS:** immutable audit trail of every paid request/response for institutional-grade transparency.
- **Hedera Agent Kit / HCS-14:** optional discovery layer — lets other agents find Strata402 by registry topic.

Why Hedera + x402 wins the track: sub-second finality makes true per-call micropayments viable; the exact HBAR payment scheme makes amounts unambiguous; Blocky402 removes self-verification complexity.

---

## 6. Hackathon Track Alignment

**Track: AI & Agentic Payments on Hedera**

| Qualification Requirement | How Strata402 satisfies it |
| :--- | :--- |
| 1. Host a real x402-gated service on testnet/mainnet | `POST /v1/strategy/yield-risk` is protected by an x402 v2 guard (Express middleware). `GET /health` and `GET /v1/services` stay free. |
| 2. Settle payments through Blocky402 | Consuming agent routes payment through Blocky402 `/verify` + `/settle`; gateway verifies the returned proof. |
| 3. Independent AI agent/platform that consumes the service | `apps/consuming-agent` is a standalone CLI agent (not frontend). |
| 4. Complete at least one real paid request end-to-end | `e2e/x402-payment.test` performs a claimable **Hedera testnet** HBAR transfer via x402 and asserts `200 OK` + a valid payment response. |
| 5. Public GitHub repository | `strata402` repo made public before submission. |
| 6. Professional README | Root README covers setup, architecture, and payment flow (Section 32). |
| 7. Demo video ≤ 5 minutes | Section 31 provides the exact demo script. |

---

## 7. Mandatory Qualification Features

1. **x402 v2 resource server** (Express) serving a paid AI endpoint with a real `402` challenge.
2. **Blocky402 settlement** integration on the client and verification on the server.
3. **Consuming agent** (`apps/consuming-agent`) that completes a real paid request.
4. **Hedera testnet** HBAR payment using the official Hedera exact x402 scheme.
5. **Public GitHub repo + root README** explaining setup, architecture, and payment flow.
6. **5-minute demo video** showing the paid request executing.

---

## 8. Competitive Advantages

1. **Real end-to-end money movement** — not a mock. The demo shows an actual testnet HBAR transfer settled by Blocky402 and a paid AI response.
2. **Official protocol stack** — `@x402/*` packages, canonical v2 transport (`PAYMENT-REQUIRED` / `PAYMENT-SIGNATURE` / `PAYMENT-RESPONSE`), Blocky402, HBAR exact scheme. Judge points to protocol compliance, not workarounds.
3. **Deterministic + generative split** — risk scores are reproducible math; AI only narrates. This is more credible and defensible than raw LLM output.
4. **Focused monorepo** — one clear architecture, no repo sprawl. `contracts/`, `services/`, `apps/`, `packages/` are all present but incrementally built.
5. **Sub-second finality story** — the demo ties Hedera's speed to the micropayment UX in 30 seconds of screen time.

---

## 9. Stretch Goals

Ranked, additive, must never block the MVP:

1. HCS audit topic logging per paid request (post-MVP, recommended — strong extra points).
2. Hedera Mirror Node enrichment (real balances, token prices).
3. SaucerSwap adapter with the official API (only after verifying data availability).
4. Bonzo Finance adapter (only after verifying endpoint availability).
5. Metered/dynamic pricing tiers.
6. HTS token support for payments.
7. HCS-14 service discovery registration.
8. Frontend dashboard (`apps/web`) visualising the flow.
9. `strata402.eth` ENS identity.

---

## 10. Focused MVP Definition

The MVP = **the smallest complete system that satisfies qualification requirements 1–7**:

```
[apps/consuming-agent]  →  POST /v1/strategy/yield-risk  →  [api-gateway]
                                 │  HTTP 402 + PAYMENT-REQUIRED header
[consuming-agent]  →  build partially-signed TransferTransaction (tinybars,
                      fee payer = facilitator)  →  serialize PaymentPayload
                  →  retry with PAYMENT-SIGNATURE header
[api-gateway]  →  Blocky402 /verify + /settle  →  [ai-engine (FastAPI)]
  →  paid JSON analysis + PAYMENT-RESPONSE header  →  200 OK
```

**In scope for MVP:**
- `services/api-gateway`: x402 guard, routing, `/v1/services`, `/health`, `/v1/strategy/yield-risk`.
- `services/ai-engine`: risk engine + structured yield analysis + disclaimer.
- `apps/consuming-agent`: discovery + x402 client + HBAR signing + retry.
- `packages/x402-sdk`: shared types, header helpers, audit helpers.
- Root Bun workspace, env skeleton, tests, docs, demo script.

**Explicitly out of MVP scope:** contracts deployment, mainnet, dashboard UI, multi-agent negotiation, RAG/vector DB, ERC-8004, HTS payments, autonomous fund execution.

---

## 11. Definition of Done

The MVP is done when all of the following pass on **Hedera testnet**:

- [x] `GET /health` returns `200 OK`.
- [x] `GET /v1/services` exposes full service metadata.
- [x] Unpaid `POST /v1/strategy/yield-risk` returns `402` with valid machine-readable payment requirements.
- [x] Consuming agent parses requirements, builds a partially signed HBAR x402 transfer (tinybars, facilitator fee payer), submits via Blocky402 `/verify` + `/settle`.
- [x] Blocky402 verification + settlement succeed and return a signed settlement result (tx `0.0.9185802-1789101908-717608026`).
- [x] Retried request with correct `PAYMENT-SIGNATURE` header returns `200` + structured analysis + `PAYMENT-RESPONSE` header.
- [x] Bad proof, wrong amount, wrong recipient, wrong network, expired, and replayed payments are rejected with correct error codes.
- [x] Wrong network/asset/amount/scheme challenges and payTo mismatches fail closed before any signature is formed.
- [x] Malformed yield-risk contract bodies are rejected with HTTP 400 before any mirror read.
- [x] A full integration test runs the paid request against testnet and records the Hedera transaction ID.
- [x] Root README documents setup, architecture, payment flow, and evidence.
- [x] No real secrets committed; `.env.example` contains placeholders only.
- [ ] 5-minute demo video recorded showing the live paid request (remaining).

---

## 12. Agent and User Journey

**Journey A — Autonomous consuming agent (primary, qualification-critical):**

1. Load service metadata (env or `GET /v1/services`, optionally HCS-14).
2. Send unpaid request.
3. Receive `HTTP 402` + `PAYMENT-REQUIRED` header (Base64 `PaymentRequired`).
4. Decode and parse payment requirements (amount, `payTo`, network, nonce, expiry).
5. Build a partially signed Hedera `TransferTransaction` per exact scheme (amount in **tinybars**, fee payer = facilitator account from `extra.feePayer`).
6. Sign the transaction; serialize it into the x402 `PaymentPayload`.
7. Send retry with `PAYMENT-SIGNATURE` header (server routes to Blocky402 `/verify` → `/settle`).
8. Receive `200 OK` + `PAYMENT-RESPONSE` header with settlement result + AI analysis.
9. Log transaction ID and payment details (and verify on HashScan).

**Journey B — Human operator (demo):**

1. Open repo README → run services.
2. Run `bun run dev` → gateway + engine up.
3. Run consuming agent manually; watch the flow print step-by-step.
4. Open HashScan to show the real transfer transaction.
5. (Post-MVP) Optional dashboard shows the same flow in the browser.

---

## 13. System Architecture

```
                     ┌──────────────────────────────────────────────┐
                     │             CONSUMER LAYER                    │
                     │  apps/consuming-agent (CLI autonomous agent)  │
                     │        (post-MVP: apps/web dashboard)         │
                     └───────────────┬──────────────────────────────┘
                                     │  HTTP/1.1 + x402 v2 canonical transports
                                     │  (PAYMENT-REQUIRED / PAYMENT-SIGNATURE /
                                     │   PAYMENT-RESPONSE)
                                     ▼
                     ┌──────────────────────────────────────────────┐
                     │          API GATEWAY (Express)                │
                     │  routes       x402/ (guard, exact scheme)     │
                     │  middleware   services/  audit/               │
                     └───────────────┬──────────────────────────────┘
                                     │  internal HTTP (verified request)
                                     ▼
                     ┌──────────────────────────────────────────────┐
                     │         AI ENGINE (FastAPI, Python)           │
                     │  api/  core/  models/  services/              │
                     │  ├─ hedera_mirror.py  (verified data layer)   │
                     │  ├─ risk_engine.py    (deterministic math)    │
                     │  ├─ saucerswap.py     (adapter, optional)     │
                     │  └─ bonzo.py          (adapter, optional)     │
                     └───────────────┬──────────────────────────────┘
                                     │
        ┌────────────────────────────┼────────────────────────────┐
        ▼                            ▼                            ▼
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────────┐
│  HEDERA TESTNET  │      │     BLOCKY402    │      │   HCS AUDIT TOPIC    │
│  HBAR transfer   │      │  /verify /settle │      │  (post-MVP, logged)  │
│  Mirror Node API │      │                  │      │                      │
└──────────────────┘      └──────────────────┘      └──────────────────────┘

  PRESENT (POST-MVP, UNBLOCKING):  contracts/  → AutoSwapLimit.sol,
                                   HederaYieldVault.sol, AgentRegistryHCS14.sol
```

### Responsibility map

| Path | Responsibility |
| :--- | :--- |
| `apps/consuming-agent/` | Independent autonomous payer; runs its own loop, no frontend dependency. |
| `apps/web/` | Optional dashboard (post-MVP). |
| `services/api-gateway/` | The x402 "resource server": challenge generation, proof verification, nonce/expiry/replay checks, routing, audit hooks. |
| `services/ai-engine/` | Deterministic risk/yield engine + AI narration; owns all financial data adapters. |
| `contracts/` | Solidify Hedera HSCS contracts; deployment is post-MVP and never blocks qualification. |
| `packages/x402-sdk/` | Shared TS utilities: header parsing/serialization, types, HCS audit helper. |
| `scripts/` | Operator tooling: create HCS topic, register service, verify a testnet payment. |
| `tests/` | `unit/` `integration/` `x402/` `e2e/` test suites. |
| `docs/` | Architecture, payment flow, testing, demo script docs. |

---

## 14. Mermaid Architecture Diagram

```mermaid
flowchart TD
    A["apps/consuming-agent<br/>(autonomous payer)"] -->|1. POST /v1/strategy/yield-risk (unpaid)| B["api-gateway<br/>(Express x402 resource server)"]
    B -->|2. HTTP 402 + PAYMENT-REQUIRED header| A
    A -->|3. build partially-signed TransferTransaction<br/>tinybars, fee payer = facilitator| C["Hedera Testnet"]
    A -->|4. retry with PAYMENT-SIGNATURE header| B
    B -->|5. forward payload + requirements| D["Blocky402<br/>(/verify + /settle)"]
    D -->|6. fee-payer signature + submit| C
    D -->|7. settlement result| B
    B -->|8. internal call| E["ai-engine<br/>(FastAPI risk + AI)"]
    E -->|9. structured analysis| B
    B -->|10. 200 OK + PAYMENT-RESPONSE header| A
    B -.->|11. audit log (post-MVP)| H["HCS Topic"]
    E -.->|Mirror Node reads| C

    subgraph MVP
        A
        B
        E
        D
        C
    end

    subgraph Post-MVP
        G["apps/web dashboard"]
        H
        I["contracts/ (HSCS)"]
    end
```

---

## 15. Recommended Technology Stack

| Layer | Choice | Rationale |
| :--- | :--- | :--- |
| Runtime / monorepo | **Bun** (v1.1+) | Fast TS workspace installs/scripts; official monorepo tooling. |
| Resource server | **Express (TypeScript)** | `@x402/express` provides the canonical x402 guard; minimal surface. |
| AI engine | **Python FastAPI** | Clean async structure, easy ML/AI tooling later. |
| Payments | **x402 v2 + Blocky402** | Official track stack; Hedera exact scheme via `@x402/hedera`. |
| Transport header | **`PAYMENT-REQUIRED` / `PAYMENT-SIGNATURE` / `PAYMENT-RESPONSE`** | Canonical x402 v2 HTTP transport (`[VERIFY]` against official spec). Legacy `X-PAYMENT` / `X-402-Payment-Proof` / `X-Payer-Account` are **not** used. |
| Onchain data | **Hedera Mirror Node REST** | Verified, keyless reads. |
| Testing | `bun test` + `vitest` (TS), `pytest` (Python) | Split by language. |
| Env handling | `.env` + `.env.example`, Bun built-in | No secrets in code. |
| Docker | Optional orchestration (post-Phase 1) | Local dev convenience only. |

### Package plan (pin + verify in Phase 1)

- `@x402/core`
- `@x402/hedera`
- `@x402/fetch`
- `@x402/express`
- `@hiero-ledger/sdk` — **prefer the re-exports provided by `@x402/hedera`** to avoid installing two different Hedera SDK versions in the workspace. Do not add a standalone `@hiero-ledger/sdk` if it would duplicate the SDK. `[VERIFY]` against `@x402/hedera` docs at pin time.

Blocky402 endpoint paths and exact header/payload behavior carry `[VERIFY]` markers — confirm against official docs + installed SDK versions at implementation time.

---

## 16. Final Monorepo Structure

```text
strata402/
├── package.json              # Root Bun monorepo config
├── bunfig.toml               # Bun runtime settings
├── .env.example              # Env blueprint (placeholders only)
├── .gitignore
├── README.md
├── apps/
│   ├── web/                  # (post-MVP) Next.js 14 dashboard
│   └── consuming-agent/      # MVP — autonomous x402 buyer agent
│       ├── src/
│       │   ├── index.ts      # main loop
│       │   ├── discover.ts   # load service metadata
│       │   ├── x402-client.ts# 402 → builder → PAYMENT-SIGNATURE
│       │   └── types.ts
│       ├── package.json
│       └── README.md
├── services/
│   ├── api-gateway/          # MVP — Express x402 resource server
│   │   ├── src/
│   │   │   ├── server.ts
│   │   │   ├── routes/       # health, services, strategy,yield-risk, audit
│   │   │   ├── x402/         # challenge, exact-scheme, verify, replay guard
│   │   │   ├── middleware/   # body parsing, error handling
│   │   │   ├── services/     # blocky402 client, mirror-node client
│   │   │   └── audit/        # (post-MVP) HCS logger
│   │   ├── package.json
│   │   └── README.md
│   └── ai-engine/            # MVP — FastAPI risk + AI narration
│       ├── app/
│       │   ├── main.py
│       │   ├── api/          # v1/strategy/yield-risk router
│       │   ├── core/         # config, disclaimers
│       │   ├── models/       # pydantic schemas
│       │   └── services/
│       │       ├── hedera_mirror.py   # verified data adapter
│       │       ├── risk_engine.py     # deterministic math
│       │       ├── saucerswap.py      # adapter (post-MVP, [VERIFY])
│       │       └─ bonzo.py           # adapter (post-MVP, [VERIFY])
│       ├── requirements.txt
│       ├── Dockerfile
│       └── README.md
├── contracts/                # HSCS contracts (post-MVP deployment)
│   ├── src/
│   │   ├── AutoSwapLimit.sol
│   │   ├── HederaYieldVault.sol
│   │   ├── AgentRegistryHCS14.sol
│   │   └── interfaces/
│   ├── scripts/deploy.ts
│   ├── test/
│   ├── hardhat.config.ts
│   ├── package.json
│   └── README.md
├── packages/
│   └── x402-hedera-sdk/      # shared x402/HCS utilities
│       ├── src/
│       │   ├── payment.ts
│       │   ├── headers.ts    # canonical transport header helpers
│       │   ├── types.ts
│       │   └── hcs-audit.ts
│       ├── package.json
│       └── README.md
├── scripts/
│   ├── create-hcs-topic.ts
│   ├── register-service.ts
│   └── verify-testnet-payment.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── x402/
│   └── e2e/
└── docs/
    ├── architecture.md
    ├── payment-flow.md
    ├── testing.md
    └── demo-script.md
```

**Incremental note:** this is the target. Implementation creates directories per phase only.

---

## 17. API Contract

Base URL (local): `http://localhost:4000`

### `GET /health` — FREE
**200 OK**
```json
{ "status": "ok", "service": "strata402-agent", "version": "0.1.0" }
```

### `GET /v1/services` — FREE (service discovery)
**200 OK**
```json
{
  "service": { "name": "Strata402", "agent": "strata402-agent", "version": "0.1.0" },
  "description": "Metered AI DeFi intelligence for autonomous agents on Hedera.",
  "capabilities": ["portfolio-risk", "yield-analysis", "hedera-market-context"],
  "endpoint": { "method": "POST", "path": "/v1/strategy/yield-risk" },
  "payment": {
    "protocol": "x402",
    "version": "v2",
    "network": "hedera:testnet",
    "asset": "0.0.0",
    "facilitator": "Blocky402",
    "price": { "amount": "1000000", "unit": "tinybars", "display": "0.01 HBAR" }
  }
}
```
> `[VERIFY]` exact field names at implementation using official x402 v2 + Blocky402 docs.

### `POST /v1/strategy/yield-risk` — PAID (x402-gated)

**Request schema:**
```json
{
  "accountId": "0.0.xxxxx",
  "riskTolerance": "conservative",   // conservative | balanced | aggressive
  "amountHbar": 100
}
```
Validation: `accountId` matches `^0\.0\.\d{1,19}$` (and is not `0.0.0`); `riskTolerance` enum
`conservative | balanced | aggressive`; `amountHbar` > 0, finite, max 1,000,000, safe tinybar
precision. Errors → `400` with `code: "invalid_request_contract"` and `issues[]` (shared contract,
see Section 18).

**Unpaid → HTTP 402** with canonical `PAYMENT-REQUIRED` header (`[VERIFY]` exact serialization — Base64 `PaymentRequired` object, emitted via `@x402/express`; do not hand-serialize)
```text
PAYMENT-REQUIRED: <base64(PaymentRequired)>
Content-Type: application/json
```
```json
{
  "detail": "Payment Required",
  "message": "Settle an HBAR micropayment via Blocky402 to access this endpoint."
}
```
The `PaymentRequired` object carries (defaults depend on the installed SDK `[VERIFY]`):
```json
{
  "resource": "/v1/strategy/yield-risk",
  "sender": "0.0.BUYER",
  "network": "hedera:testnet",
  "minTokens": null,
  "requirements": [
    {
      "scheme": "exact",
      "facilitator": "Blocky402",
      "description": "Pay in HBAR",
      "payTo": "0.0.RECIPIENT",
      "asset": "0.0.0",
      "amount": "1000000",
      "currency": "HBAR"
    }
  ],
  "expiresAt": "..."
}
```

**Paid → 200 OK** (+ `PAYMENT-RESPONSE` header with settlement result)
```json
{
  "status": "success",
  "service": "strata402-api-gateway",
  "request": { "accountId": "0.0.10464194", "riskTolerance": "balanced", "amountHbar": 1 },
  "analysis": {
    "scope": "account-level on-chain risk",
    "source": "hedera-mirror-node",
    "network": "hedera:testnet",
    "dataTimestamp": "…",
    "freshnessHealth": "fresh",
    "observed": { "account": { "accountId": "…" }, "balance": { "tinybars": "…", "hbar": "…" },
                  "recent30d": { "transactionCount": 0, "hbarInTinybars": "0", "hbarOutTinybars": "0" } },
    "derivedMetrics": { "net30dTinybars": "0" },
    "unavailable": ["live pool APY", "protocol liquidity", "smart-contract risk", "SaucerSwap data", "Bonzo data"],
    "limitations": ["No protocol-specific APY data", "No SaucerSwap adapter", "No Bonzo adapter",
                    "No automatic fund movement"]
  },
  "payment": { "protocol": "x402", "version": 2, "network": "hedera:testnet", "asset": "0.0.0",
               "amountTinybars": "1000000" },
  "disclaimer": "This information is not financial advice. …"
}
```
> **Honesty rule:** no `riskScore`, `confidence`, or protocol-specific numbers are invented. The
> scope is explicitly `account-level on-chain risk` from the Mirror Node. If Mirror reads fail,
> `analysis.dataUnavailable: true` with neutrality — never 200-with-fake.

**Error responses**

| Case | Code | Body |
| :--- | :--- | :--- |
| Invalid payment proof | `401` | `{ "detail": "invalid_payment" }` |
| Expired payment | `410 Gone` | `{ "detail": "payment_expired" }` |
| Replayed payment | `409 Conflict` | `{ "detail": "payment_replayed" }` |
| Contract violation | `400` | `{ "status": "error", "code": "invalid_request_contract", "issues": [...] }` |
| Internal error | `500` | generic, no internals leaked |

**Idempotency:** a successfully used payment (nonce) is marked consumed server-side (Redis/local cache) → replayed attempts get `409`. Same resource + proof → single grant.

### `GET /v1/audit/:id` — POST-MVP (optional)
Return recorded payment/response metadata for a given request id. **Not required for qualification.** If built, only store request id, endpoint, status, hedera tx id, timestamp — never keys or full AI transcripts beyond consent.

---

## 18. Official x402 v2 Payment Flow

**Canonical x402 v2 transport headers** (`[VERIFY]` against official spec + installed SDK):

| Direction | Header | Content |
| :--- | :--- | :--- |
| Server → Client (402) | `PAYMENT-REQUIRED` | Base64-encoded `PaymentRequired` object |
| Client → Server | `PAYMENT-SIGNATURE` | Base64-encoded `PaymentPayload` object |
| Server → Client (post-settlement) | `PAYMENT-RESPONSE` | Settlement result |

> **Do not use** legacy/implementation-specific headers: `X-402-Payment-Proof`, `X-Payer-Account`, `X-PAYMENT`. If any legacy example uses them, treat it as non-canonical unless the installed SDK/facilitator explicitly requires it.

The implementation must follow this sequence:

1. The client sends an unpaid request to the protected resource.
2. The resource server responds with `HTTP 402 Payment Required`.
3. The server includes the canonical `PAYMENT-REQUIRED` response header.
4. The client decodes the `PaymentRequired` object.
5. The client selects a compatible Hedera `exact` payment requirement.
6. The client creates a partially signed Hedera `TransferTransaction`.
7. The transaction transfers the exact required amount from the client to `payTo`.
8. For HBAR, the amount is represented in **tinybars**.
9. The transaction uses the facilitator account from `extra.feePayer` as the transaction **fee payer**.
10. The client signs the transaction.
11. The client serializes the partially signed transaction into the Hedera x402 `PaymentPayload`.
12. The client sends a retry request with the canonical `PAYMENT-SIGNATURE` header.
13. The resource server forwards the payment payload and payment requirements to Blocky402 `/verify`.
14. If verification succeeds, the resource server requests settlement through Blocky402 `/settle`.
15. Blocky402 adds the fee-payer signature and submits the transaction to Hedera.
16. The resource server returns the paid AI response.
17. The server includes the canonical `PAYMENT-RESPONSE` header with the settlement result.
18. The consuming agent displays the Hedera transaction ID and verifies it through HashScan.

**Server-side enforcement after verification:**
- **Payload identity:** a transaction ID alone is **not** a valid x402 payment payload — the exact scheme uses a partially signed serialized `TransferTransaction` inside the `PaymentPayload`. Accept only the real payload format.
- **Amount validation:** matches issued requirements exactly in tinybars.
- **Recipient validation:** `payTo` equals `PAYMENT_RECIPIENT_HEDERA_ID`.
- **Network validation:** `hedera:testnet`.
- **Resource validation:** payment requirement's resource matches the requested path.
- **Expiry validation:** reject expired requirements (`410`).
- **Replay protection:** reject already-settled payments (`409`).

> **Hard rules:** do not hand-roll a `402` scheme, custom payload serialization, or custom headers. Rely on `@x402/express`, `@x402/hedera`, `@x402/core` for payload construction, encoding, parsing, and transport behavior. Do not hardcode header serialization when the SDK can do it.

### Hedera payment units
- HBAR protocol `amount` in `PaymentRequirements` = **tinybars** (string), `asset: "0.0.0"`.
- Example: human-readable `0.01 HBAR` → protocol `"1000000"` tinybars.
- Convert tinybars ↔ HBAR only for display; conversion must be deterministic and tested.

---

## 19. Blocky402 Integration Plan

| Step | Component | Action |
| :--- | :--- | :--- |
| 1 | `x402-client.ts` | On `402`, decode `PaymentRequired`, select the Hedera `exact` requirement |
| 2 | Agent (`@x402/hedera`) | Build partially signed `TransferTransaction` (tinybars, fee payer = `extra.feePayer`) |
| 3 | Agent | Sign + serialize into x402 `PaymentPayload` |
| 4 | Agent | Retry with `PAYMENT-SIGNATURE` header |
| 5 | Gateway `x402/verify.ts` | Forward payload+requirements to Blocky402 `/verify` |
| 6 | Gateway | On success → Blocky402 `/settle` (fee payer signs, submits to Hedera) |
| 7 | Gateway | Enforce payload/amount/recipient/network/resource/expiry/replay |
| 8 | Gateway | Return paid response + `PAYMENT-RESPONSE` header |

### Blocky402 compatibility verification
Blocky402 docs may contain legacy/implementation-specific examples. Before writing the payment integration:

1. Verify the selected Blocky402 testnet endpoint.
2. Query its supported networks and schemes.
3. Confirm support for: `hedera:testnet`, `exact`, and HBAR with `asset: 0.0.0`.
4. Confirm the expected request body for `/verify`.
5. Confirm the expected request body for `/settle`.
6. Confirm whether the facilitator expects canonical x402 v2 headers directly, or whether an SDK adapter handles the translation.
7. Test actual behavior with the installed x402 package versions.
8. Document any compatibility adapter explicitly.

The canonical application contract remains **x402 v2**. Any facilitator-specific compatibility behavior stays isolated inside the x402 integration layer and must not leak into business logic.

`[VERIFY]` (all carry the marker at implementation time): `BLOCKY402_URL`, `/verify` + `/settle` request/response contracts, proof/settlement TTL, and whether the server must call `/verify` again or trust the returned settlement data.

**Design decisions**
- Keep Blocky402 as **the only** settlement path for the demo (no fallback server-side "self-approval").
- Store consumed payment/resource IDs (nonce-like identity) in Redis (or in-memory locally) so replays are caught across restarts where practical.

---

## 20. AI and Risk Engine Design

### Deterministic layer (testable, no LLM)
- Portfolio balance / allocation calculations (Mirror Node or provided inputs).
- **Risk score (0–100)** computed from: allocation concentration, asset volatility buckets, exposure to unverified protocols, health-factor-style collateral math.
- Constraint rules for `riskTolerance` (conservative/balanced/aggressive).
- Data freshness check: timestamp of latest data; stale → degrade confidence.
- Validation rules (input schema, limits).

### Generative layer
- Natural-language strategy summary.
- Risk interpretation.
- Reasoning narrative.
- User-facing recommendation (always constrained by deterministic outputs).

### Guidance
- Use a cheap, available model provider (e.g., OpenAI-compatible endpoint) with strict system prompt. `[VERIFY]` provider API key availability; keep a **deterministic fallback** that returns the full structured payload with an explanatory template if the LLM call fails — so the endpoint still returns a valid paid response.
- **Prompt-injection protection:** never interpolate raw user input into system prompt; treat user fields as data; whitelist `riskTolerance`; reject unknown fields.
- **Confidence score:** derived from data freshness + deterministic consistency; capped when adapters are unverified.
- **Disclaimer:** always present, constant string and part of schema.
- **Unsupported recommendation rejection:** the engine refuses to invent live protocol data; any claim about SaucerSwap/Bonzo is preceded by `status: adapter-unverified` or omitted.

---

## 21. Hedera Integration Plan

| Facility | Use | MVP? |
| :--- | :--- | :---: |
| Hedera testnet | Payment network, faucet HBAR | ✅ |
| `@hiero-ledger/sdk` | Account setup, transaction construction (client-side signer in agent); prefer `@x402/hedera` re-exports to avoid duplicate SDK installs | ✅ |
| Mirror Node REST | Read-only data for deterministic engine | ✅ |
| Hedera Consensus Service | Audit topic, service registry (post-MVP) | ⚠️ post-MVP |
| HCS-14 | Agent discovery registry | ⚠️ post-MVP |
| HTS | Asset/concepts, optional payment token | ❌ stretch |
| Scheduled Transactions | Multisig/time-delayed automation | ❌ stretch |
| Hedera Agent Kit | Higher-level agent tooling | ⚠️ optional accelerator |

---

## 22. Smart Contract Scope

**Positioning:** the `contracts/` directory exists from Phase 1 (empty workspace skeleton), but **contract deployment never blocks qualification**. The real x402-gated service + consuming agent is the full qualification story.

| Contract | Purpose | MVP Priority | Security Risks | Required Tests | Needed for Qualification? |
| :--- | :--- | :---: | :--- | :--- | :---: |
| `AutoSwapLimit.sol` | SaucerSwap V2 limit-order execution | Stretch | Reentrancy, oracle manipulation, slippage/DEADLINE | unit + testnet integration on paused logic | ❌ |
| `HederaYieldVault.sol` | Custody + yield automation | Stretch | Custody risk, access control, pausability | unit + invariant-style checks | ❌ |
| `AgentRegistryHCS14.sol` | Onchain agent identity registry | Post-MVP | Unauthorized registration, front-running | unit + auth tests | ❌ |

**Explicit statement:** a team can fully satisfy the track's requirements with **zero deployed contracts** if the x402 AI service and consuming agent run end-to-end on testnet. Contracts are additive credibility, deployed last (if at all).

---

## 23. Service Discovery Plan

- **MVP:** consuming agent reads service metadata from a local JSON file / env; it also gracefully calls `GET /v1/services` to validate the advertiser's own metadata.
- **Post-MVP:** register on the HCS-14 registry topic (`title`, `description`, `endpoint`, `paymentRequirements`). Consuming agent queries the topic, filters by network `hedera:testnet`, and resolves the endpoint.
- **Stretch:** `strata402.eth` via ENS resolves to the same metadata.

---

## 24. HCS Audit Plan

- **Purpose:** record every paid request/response pair immutably for credibility.
- **MVP:** implement `packages/x402-sdk/src/hcs-audit.ts` helper but only wire it after the e2e payment test passes.
- **Payload per event:** `{ requestId, endpoint, status, paymentTxId, blockTimestamp }` — no secrets, no full transcripts.
- **Topic:** `scripts/create-hcs-topic.ts` creates a subnet topic (`[VERIFY]` fee settings) on testnet; ID stored in `.env` as `HCS_AUDIT_TOPIC_ID`.
- **Failure policy:** audit failure must never fail the paid request; logged/warned only.

---

## 25. Security Model

1. **No secrets in frontend**: private keys live only in server/agent env; nothing is prefixed `NEXT_PUBLIC_` unless public by design.
2. **Key isolation**: operator account key (server) ≠ consuming-agent buyer key ≠ `PAYMENT_RECIPIENT` (treasury) where feasible.
3. **Payment validation**: exact amount in tinybars, `payTo` recipient equality, network pinning (`hedera:testnet`), expiry, replay guard, real `PaymentPayload` format only (Section 18).
4. **Input validation**: strict JSON schema, type coercion, length caps.
5. **Prompt boundaries**: user input is data, never instructions.
6. **Error hygiene**: never echo internals; fixed error codes.
7. **Dependency pins**: pin exact versions; audit `npm/bun audit` before submission.
8. **`.env.example` hygiene**: placeholders only; `.gitignore` blocks `.env*` real files; pre-submission secret scan.

---

## 26. Error Handling Strategy

| Layer | Strategy |
| :--- | :--- |
| Gateway | Central error middleware; typed error classes (payment/validation/rate/upstream); fixed machine-readable codes; sanitized body. |
| x402 guard | Distinct responses `401/409/410/422` per failure class; never returns debug stack traces. |
| AI engine | Deterministic path must never depend on LLM; LLM failure → fallback template response arrives with `confidence` reduced. |
| Consuming agent | Clear step logging; retry on transient 5xx; abort on 4xx with reason printed. |
| External deps (Blocky402, Mirror Node) | Timeouts + circuit behavior; mirror-node read failure → degrade `marketContext` to "unavailable", never fail the paid contract logic. |

---

## 27. Testing Strategy

| Suite | Scope | Runner |
| :--- | :--- | :--- |
| Root workspace | workspace resolution, scripts | `bun test` |
| SDK/facilitator compatibility probe | assert installed `@x402/*` packages emit + accept the canonical `PAYMENT-REQUIRED` / `PAYMENT-SIGNATURE` / `PAYMENT-RESPONSE` headers; single Hedera SDK resolved | `bun test` (Phase 1) |
| API health / discovery | `GET /health`, `GET /v1/services` | `bun test` + supertest |
| Input validation | schema edges | `bun test` / `pytest` |
| Deterministic risk | pure math: score, constraints, freshness | `pytest` |
| x402 402 response | unpaid → `PAYMENT-REQUIRED` header + `PaymentRequired` correctness | integration |
| Payment requirements | field presence + types (tinybars, `asset: 0.0.0`, `payTo`, `extra.feePayer`) | integration |
| Payment payload construction | partially signed `TransferTransaction` serialized as x402 `PaymentPayload`; fee payer = facilitator | unit |
| Tinybars conversion | HBAR ↔ tinybars deterministic + tested | unit |
| `PAYMENT-SIGNATURE` retry | correct header → 200 + `PAYMENT-RESPONSE` header | integration |
| Blocky402 verify/settle | mocked ✓; contract against real API marked `[VERIFY]` | integration |
| Hedera testnet tx | real transfer on `hedera:testnet` | e2e (opt-in, requires funded buyer) |
| Negative cases | invalid payload / wrong amount (tinybars) / wrong recipient / wrong network / expired / replayed | integration |
| AI fallback | LLM down → template response still 200 | integration |
| E2E paid inference | full chain §18 on testnet | e2e |

**The single E2E acceptance test asserts the complete chain and prints the Hedera transaction ID.** Funding the buyer account with faucet HBAR is a documented pre-step.

---

## 28. Environment Configuration (`.env.example`)

```env
# ===== Hedera testnet =====
HEDERA_NETWORK=testnet
HEDERA_MIRROR_NODE_URL=https://testnet.mirrornode.hedera.com

# ===== Service account (resource server) =====
SERVICE_ACCOUNT_ID=0.0.PLACEHOLDER
SERVICE_ACCOUNT_KEY=...placeholder...

# ===== Payment recipient (treasury) =====
PAYMENT_RECIPIENT_HEDERA_ID=0.0.PLACEHOLDER

# ===== x402 pricing =====
X402_PRICE_TINYBARS=1000000
X402_ASSET=0.0.0
X402_PAYMENT_TTL_SECONDS=300

# ===== Blocky402 =====
BLOCKY402_URL=[VERIFY]
X402_FACILITATOR_API_KEY=...placeholder...

# ===== Consuming agent buyer =====
BUYER_ACCOUNT_ID=0.0.PLACEHOLDER
BUYER_PRIVATE_KEY=...placeholder...

# ===== HCS audit (post-MVP) =====
HCS_AUDIT_TOPIC_ID=0.0.PLACEHOLDER
HCS14_REGISTRY_TOPIC=0.0.PLACEHOLDER

# ===== AI provider =====
LLM_PROVIDER=...placeholder...
LLM_API_KEY=...placeholder...
LLM_MODEL=...placeholder...

# ===== Adapters (post-MVP, optional) =====
# SaucerSwap official testnet API. Key must stay empty until an official key is granted.
SAUCERSWAP_API_KEY=
SAUCERSWAP_API_URL=https://test-api.saucerswap.finance
BONZO_API_URL=[VERIFY]

# ===== Local dev =====
REDIS_URL=redis://localhost:6379
PORT=4000
AI_ENGINE_URL=http://localhost:8000

# ===== Frontend public (post-MVP only, truly public) =====
NEXT_PUBLIC_BACKEND_URL=[VERIFY]
NEXT_PUBLIC_NETWORK=testnet
```

All keys are placeholders. Real values live only in local `.env` (gitignored).

---

## 29. Docker and Local Development

- **Docker = optional.** Not required for qualification. Used to run `ai-engine` and `redis`/`postgres` consistently during development.
- Services may run natively (Bun for TS, venv/uv for Python) for speed.
- Suggested root script `bun run dev` starts gateway + engine locally with env loaded from `.env`.
- No Docker Compose file is required in Phase 1. Add `docker-compose.yml` only when the full MVP stack is settled.

---

## 30. Sequential Implementation Roadmap

Strictly sequential; each phase ends with tests + acceptance criteria, and the next phase starts only on explicit approval.

### Phase 1 — Repository & Bun Workspace Bootstrap + x402 Package Verification (DONE)
- **Goal:** sane monorepo skeleton; prove tooling works; pin + probe the x402 package surface **before** any payment code exists.
- **Scope:** root only. No x402 gateway logic, no engine, no contracts, no agent payment logic.
- **Files to create:**
  - `strata402/package.json` (private, workspaces: `apps/*`, `services/*`, `packages/*`)
  - `strata402/bunfig.toml` (runtime settings)
  - `strata402/.gitignore`
  - `strata402/.env.example` (placeholders above)
  - `strata402/README.md` (minimal bootstrap README)
  - Empty workspace dirs: `apps/`, `apps/consuming-agent/`, `services/api-gateway/`, `services/ai-engine/`, `contracts/`, `packages/x402-sdk/`, `tests/{unit,integration,x402,e2e}/`, `scripts/`, `docs/`
- **Package verification (probe only, no payment flow):**
  - Pin exact versions of `@x402/core`, `@x402/hedera`, `@x402/fetch`, `@x402/express`.
  - Resolve Hedera SDK through `@x402/hedera` re-exports; confirm single SDK instance (`bun why @hiero-ledger/sdk`).
  - Write **one probe test** (`tests/unit/x402-sdk-probe.test.ts`) asserting the installed packages import, expose the canonical transport helper, and resolve `x402Version: 2` — this is a **verification test, not implementation**.
- **Commands:**
  - `bun --version` and `node --version` (versions ≥ documented)
  - `bun install`
  - `bun run validate` (root script printing workspace names) or a minimal workspace-resolution test
  - `bun test` (workspace test + SDK probe test)
- **Expected output:** `bun test` green; `bun run validate` lists `@strata402/*` workspaces; probe test documents the actual headers emitted/accepted by the pinned SDK versions (recorded in output or `docs/payment-flow.md` note).
- **Tests:** workspace resolution + SDK/facilitator compatibility probe only.
- **Acceptance criteria:** Phase 1 checklist (below) all ✕ → ✅.
- **Failure points:** Bun/Node version mismatch; workspace glob invalid; SDK re-export resolution failure or duplicate Hedera SDK → fix config before Phase 2.
- **Rollback:** single commit; revert if validation fails.

### Phase 2 — x402 SDK + API Contract Types
- `packages/x402-sdk`: `headers.ts` (canonical `PAYMENT-REQUIRED` / `PAYMENT-SIGNATURE` / `PAYMENT-RESPONSE` helpers via `@x402/core`), `payment.ts`, `types.ts`.
- Unit tests for header serialize/parse with official format `[VERIFY]`; tinybars conversion tests.

### Phase 3 — API Gateway (Express) skeleton + free endpoints
- `GET /health`, `GET /v1/services`; error middleware; server.ts.
- Integration tests; no x402 guard yet.

### Phase 4 — AI Engine (FastAPI) v1 (deterministic)
- `main.py`, `api/`, `core/`, `models/`, `risk_engine.py`, `hedera_mirror.py` adapter (labeled).
- `POST /v1/strategy/yield-risk` returns deterministic analysis (no x402 gate yet, local-only flag).
- `pytest` suite green.

### Phase 5 — x402 guard + Blocky402 verification on gateway
- Issue `402` + `PAYMENT-REQUIRED` via `@x402/express`; parse `PAYMENT-SIGNATURE`; forward payload+requirements to Blocky402 `/verify` → `/settle`; enforce payload/amount(tinybars)/recipient/network/resource/expiry/replay.
- Integration tests with mocked Blocky402; real API marks `[VERIFY]`.

### Phase 6 — Consuming agent
- `x402-client.ts` full flow (`PaymentRequired` decode → partially signed `TransferTransaction` → fee payer = facilitator → `PAYMENT-SIGNATURE` retry); `index.ts` loop; env-driven funding.
- Run against local gateway + engine with mocked facilitator → passes.

### Phase 7 — Real testnet E2E (qualification-critical) — DONE ✅
- Funded buyer via faucet; paid request settled on testnet; tx `0.0.9185802-1789101908-717608026`
  captured; `200 OK` + `PAYMENT-RESPONSE`; balance evidence recorded.
- Demo recorded.

### Phase 7A — Stabilization, Contract Hardening & Submission Evidence — DONE ✅
- Shared yield-risk request contract; gateway 400-before-read; agent fail-closed pre-send.
- Failed-closed challenge checks (network/asset/amount/scheme/payTo mismatch); `.env.example`
  placeholders hardened; leak removed; full diff + security scan performed; public txId documented.
- **STOP for review — no commit/push yet.**

### Phase 8A — Source Eligibility & Enrichment (DONE — decision recorded)
- Verify eligible third-party data sources (Bonzo, SaucerSwap) read-only before any adapter.
- Outcome (2026-09-11): **Bonzo deferred** (no eligible live Testnet source; Mainnet staging
  excluded), **SaucerSwap pending** official `x-api-key` + live verification. No adapter written.
  Honest controlled-unavailable retained. Extend `unavailable` as facts change.

### Phase 8B — Demo UX over the proven flow (CURRENT)
- Simple presentation layer over the real MVP: service discovered → price/recipient verified →
  payment settled → risk analysis returned → Hedera transaction verified.
- Uses only existing real Mirror Node data, real transaction evidence, and the x402 flow.
  No smart contracts, no Bonzo, no SaucerSwap.

### Phase 8C — SaucerSwap Source Verification (+ adapter after a passing live probe)
Only when an official `x-api-key` is available: probe `test-api.saucerswap.finance`
`GET /v2/pools/full` read-only; verify network, pool identity, token metadata, liquidity,
amounts, fee tier, price fields, `timestamp`/freshness. Adapter only after the live probe
passes and schema is stable. Read-only (no swap/liquidity operations) in Phase 8A scope.

SaucerSwap status (Phase 7, 2026-09-11):
- Official testnet URL: `https://test-api.saucerswap.finance`
- Endpoint: `GET /v2/pools/full`
- Authentication: `x-api-key` header required
- API key: not available
- Live probe: not executed
- Adapter: not implemented
- Status: **PENDING**
- Local env `SAUCERSWAP_API_KEY=` kept empty by design (no fake key, no unofficial
  source, no request to a protected endpoint without a key).

### Phase 8D — Bonzo Re-check
- Re-probe Bonzo only when: an eligible official live source exists, Testnet data is present
  (or Mainnet eligibility is explicitly approved for a Mainnet-scoped analysis), operational
  status holds, schema is stable, and freshness is verifiable.

### Phase 8E — AI Engine
- LLM-narrated strategy explanation over deterministic Mirror facts; deterministic fallback
  keeps the endpoint live even if the LLM is down.

### Phase 8F — HCS audit logging + repo polish
- Log paid request/response pairs to an HCS topic (request id, endpoint, status, tx id, block
  timestamp — never secrets or full transcripts). Publish repo, README polish, demo refresh.

---

## 31. Five-Minute Demo Strategy

**Logistics:** pre-fund buyer account (faucet); pre-warm services; record screen with terminal + HashScan tabs; keep script under 5:00.

| Time | Visual | Script (narration) |
| :---: | :--- | :--- |
| 0:00–0:30 | Title + repo | "Strata402 is a metered AI DeFi intelligence service for autonomous agents on Hedera, monetized with x402 micropayments." |
| 0:30–1:00 | `curl /v1/services` | "Here's the service manifest — paid endpoint, HBAR, Blocky402, testnet." |
| 1:00–1:45 | Run consuming agent | "The agent sends an unpaid request; the gateway returns HTTP 402 with payment requirements." |
| 1:45–2:30 | Terminal: signing+Blocky402 | "The agent signs a real HBAR x402 payment, hands it to Blocky402 for verification and settlement." |
| 2:30–3:15 | Retry with `PAYMENT-SIGNATURE` | "The agent retries with the canonical x402 v2 PAYMENT-SIGNATURE header and receives a structured risk/yield analysis plus the settlement response." |
| 3:15–4:00 | HashScan | "Here's the actual testnet HBAR transfer — sub-second finality, verifiable on chain." |
| 4:00–4:30 | (optional) HCS topic | "Every paid request is logged to a Hedera Consensus Topic." |
| 4:30–5:00 | Qualification mapping | "Real service ✓, Blocky402 ✓, consuming agent ✓, real paid request end-to-end ✓, public repo ✓, README ✓." |

**Backup plan:** pre-record the happy path; if Blocky402/facilitator is briefly down during the live demo, cut to the recording; keep local gateway + a local-only deterministic fallback so the interface never hangs.

---

## 32. README Structure (target)

1. Header (name, tagline, badges, live/demo links)
2. Executive summary + demo video link
3. Qualification claim mapping
4. Architecture diagram (Mermaid) + payment flow
5. Quick start (prereqs → `bun install` → `.env` → `bun run dev`)
6. Running the consuming agent end-to-end
7. API reference (`/health`, `/v1/services`, `/v1/strategy/yield-risk`, errors)
8. x402 v2 payment flow explanation
9. Monorepo structure
10. Testing + e2e instructions (faucet funding)
11. Deployment/contracts status
12. Security notes
13. License

---

## 33. Scope Control

### Must build (qualification)
- x402-gated `POST /v1/strategy/yield-risk`
- `GET /health`, `GET /v1/services`
- Blocky402 verify/settle on agent + gateway
- Consuming agent completing a real paid testnet request
- Root README + `.env.example`
- Public repo + 5-min demo

### Should build (time permitting)
- Mirror Node enrichment; HCS audit logging; service discovery improvements
- SaucerSwap adapter; Bonzo adapter
- Dashboard (`apps/web`); metered/dynamic pricing; HTS payments

### Must NOT build before MVP works
- Mainnet; complex smart-contract automation; multi-agent negotiation; cross-chain; ERC-8004; Privy auth; full vector DB; complex RAG; autonomous fund execution; production custody; advanced trading automation.

---

## 34. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
| :--- | :---: | :---: | :--- |
| Blocky402 API shape differs from earlier drafts | Medium | High | Pin to official docs; `[VERIFY]` markers; adapter layer isolates changes. |
| Faucet/buyer funding issues during demo | Medium | High | Fund buyer in advance; show balance before + after. |
| Mirror Node deprecated endpoint | Medium | Low | Wrap reads; treat as enrich-only; degrade gracefully. |
| LLM call fails at demo time | Low | Medium | Deterministic fallback keeps endpoint live. |
| Scope creep (contracts, dashboard) | High | High | Strict Phase gating + explicit approval per phase. |
| Secret leak | Low | Critical | `.gitignore`, env-placeholders policy, pre-submission scan, separate keys. |
| Provider says "no live data" mid-build | Medium | Medium | Always label adapters/unverified status; honesty is a selling point. |

---

## 35. Final Acceptance Checklist

- [x] Real x402 service live on `hedera:testnet` (gateway + engine).
- [x] `GET /health`, `GET /v1/services` documented and reachable.
- [x] Unpaid request → `402` with valid requirements.
- [x] Agent signs real HBAR transfer with official Hedera x402 scheme.
- [x] Blocky402 `/verify` + `/settle` succeed; settlement response captured (tx `0.0.9185802-1789101908-717608026`).
- [x] `PAYMENT-SIGNATURE` retry → `200` structured analysis + `PAYMENT-RESPONSE` header.
- [x] Invalid/expired/replayed/wrong-amount/wrong-recipient/wrong-network all rejected.
- [x] Wrong challenge (network/asset/amount/scheme/payTo) fails closed with zero signed requests.
- [x] Malformed yield-risk contract → `400 invalid_request_contract` before any mirror read.
- [x] Real testnet tx ID recorded in integration output.
- [x] Public GitHub repo; secrets clean; `.env.example` placeholder-only.
- [x] Professional root README done.
- [ ] Demo video ≤ 5 min recorded (remaining for submission).

---

## ✅ Phase 1 Acceptance Checklist (STOP after this)

Before Phase 2, all items below must be true — then stop and wait for explicit approval.

- [ ] `strata402/` repo directory initialized as a Bun monorepo.
- [ ] Root `package.json` exists, `"private": true`, workspaces = `apps/*`, `services/*`, `packages/*`.
- [ ] `bunfig.toml` exists.
- [ ] `strata402/.gitignore` exists (node_modules, `.env*`, dist, logs).
- [ ] `strata402/.env.example` exists with placeholder values only — no real keys.
- [ ] Minimal `strata402/README.md` documents bootstrap + how to run `bun validate` / `bun test`.
- [ ] Initial workspace directories exist: `apps/`, `services/`, `contracts/`, `packages/x402-sdk/`, `scripts/`, `tests/{unit,integration,x402,e2e}/`, `docs/`.
- [ ] x402 packages pinned to exact versions: `@x402/core`, `@x402/hedera`, `@x402/fetch`, `@x402/express`.
- [ ] Hedera SDK resolved once (no duplicate installs) — `bun why @hiero-ledger/sdk` confirmed.
- [ ] SDK probe test (`tests/unit/x402-sdk-probe.test.ts`) passes and records the canonical headers emitted/accepted by the pinned versions (`x402Version: 2`).
- [ ] `bun install` completes cleanly.
- [ ] A workspace validation test passes (`bun test`).
- [ ] Bun ≥ v1.1 and Node version recorded (`bun --version`, `node --version`).
- [ ] No x402 payment flow, gateway logic, AI engine, contracts, or agent payment logic written in Phase 1 (probe test is verification only).
- [ ] Git initialized (if not already) and Phase 1 committed.

> **Post-approval note:** proceed to Phase 2 only after this checklist is acknowledged.
