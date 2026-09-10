<div align="center">

# Strata402

### Autonomous DeFi Intelligence on Hedera — x402 Pay-Per-Call

[![Hedera Testnet](https://img.shields.io/badge/Hedera-Testnet_Chain_296-3399FF?style=for-the-badge&logo=hedera)](https://hashscan.io/testnet)
[![x402 Protocol](https://img.shields.io/badge/x402-Payment_Required-00F2FE?style=for-the-badge)](https://x402.org)
[![Bun Monorepo](https://img.shields.io/badge/Bun-Monorepo-fbf0df?style=for-the-badge&logo=bun)](https://bun.sh)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

**Monetized x402 API gateway for AI DeFi strategy services on Hedera testnet.**

</div>

> **Status (as of 2026-09-10):** Phase 1 (bootstrap) and Phase 2 (gateway + official x402 v2 middleware)
> are implemented and verified locally. A review branch `phase-3-x402-middleware` is pushed to GitHub
> and **awaiting reviewer approval — Phase 3 is NOT frozen yet**. Phase 4 (consuming agent, AI engine,
> settlement, contracts) is **not started**.

---

## What Is Implemented (Verified)

### 1. Monorepo bootstrap (Phase 1)
Bun workspaces for `apps/*`, `services/*`, `packages/*`; strict TypeScript config; workspace validation
script; scaffolding for the consuming agent, AI engine, and contracts directories.

### 2. API Gateway (Phase 2) — `services/api-gateway`
Express gateway exposing:

| Endpoint | Access | Behavior |
| :--- | :--- | :--- |
| `GET /health` | free | 200 + status/service/version, network `hedera:testnet`, `x402Version: 2` |
| `GET /v1/services` | free | 200 + single-service catalog (`yield-risk`) |
| `POST /v1/strategy/yield-risk` | **paid** | Official x402 v2 challenge: `HTTP 402` + `PAYMENT-REQUIRED` header |

The single MVP service (`yield-risk`) is priced at **1,000,000 tinybars = 0.01 HBAR**, asset `0.0.0`,
network `hedera:testnet` (CAIP-2). `payTo` comes from `HEDERA_SERVICE_ACCOUNT_ID` (must not be `0.0.0`).

### 3. Official x402 v2 Middleware — `services/api-gateway/src/x402.ts`
Uses the official `@x402/*` packages (`2.25.0`), not a hand-rolled stub:

- `HTTPFacilitatorClient` + `x402ResourceServer` from `@x402/core/server`
- `ExactHederaScheme` from `@x402/hedera/exact/server` (server-side variant)
- `paymentMiddleware` from `@x402/express`

Verified live: an unauthenticated call to the paid route returns a real `HTTP 402` with a base64-encoded
JSON `PAYMENT-REQUIRED` envelope (per the x402 v2 HTTP transport). Decoded shape: `x402Version: 2`,
`scheme: "exact"`, `network: "hedera:testnet"`, `amount: "1000000"`, `asset: "0.0.0"`, `payTo`,
`maxTimeoutSeconds: 300`, plus facilitator-provided `extra` (e.g. `feePayer`).

### 4. Shared SDK — `packages/x402-sdk`
Centralizes canonical constants used by the gateway:

- `X402_VERSION = 2`
- Headers: `PAYMENT-REQUIRED`, `PAYMENT-SIGNATURE`, `PAYMENT-RESPONSE`
- `hedera:testnet`, `0.0.0`, 1,000,000 tinybars
- `buildServiceCatalog()` / `serviceAccountFromEnv()` for env-driven configuration

## Monorepo Structure

```text
strata402/
├── apps/
│   └── consuming-agent/        # scaffold only (Phase 4: not started)
├── contracts/                  # scaffold only (not implemented)
├── packages/
│   └── x402-sdk/               # shared x402 constants + catalog builder (implemented)
├── scripts/
│   └── validate-workspaces.mjs # workspace validation (implemented)
├── services/
│   ├── api-gateway/            # Express gateway + official x402 middleware (implemented)
│   └── ai-engine/              # scaffold only (Phase 4: not started)
├── tests/
│   ├── unit/                   # workspace + x402 SDK export probes (implemented)
│   ├── integration/            # gateway tests incl. live 402 challenge (implemented)
│   └── e2e/, x402/             # empty placeholders
├── .env.example
├── bunfig.toml
├── package.json
└── tsconfig.json
```

## Quick Start

### Prerequisites
- Bun `>=1.1` (works at `1.2.13`) or Node `>=20`

### 1. Install
```bash
bun install
```

### 2. Environment
```bash
cp .env.example .env
```
Fund a real Hedera testnet account and set `HEDERA_SERVICE_ACCOUNT_ID` / `HEDERA_SERVICE_ACCOUNT_KEY`
before any real settlement. The committed `.env.example` contains development placeholders only —
never commit real keys.

### 3. Run the gateway
```bash
bun services/api-gateway/src/index.ts
```

### 4. Verify
```bash
curl http://localhost:8080/health
curl http://localhost:8080/v1/services
curl -i -X POST http://localhost:8080/v1/strategy/yield-risk   # => 402 Payment Required + PAYMENT-REQUIRED
```

## Environment Variables

| Variable | Purpose |
| :--- | :--- |
| `HEDERA_NETWORK` | Hedera network (`testnet`) |
| `STRATA_NETWORK` | CAIP-2 network (`hedera:testnet`) |
| `HEDERA_MIRROR_NODE_URL` | Mirror node endpoint |
| `HEDERA_SERVICE_ACCOUNT_ID` | `payTo` for the exact scheme (must not be `0.0.0`) |
| `HEDERA_SERVICE_ACCOUNT_KEY` | Service account operator key (dev placeholder) |
| `X402_FACILITATOR_URL` | x402 facilitator (default `https://x402.org/facilitator`) |
| `X402_PRICE_TINYBARS` | Price in tinybars (default `1000000`) |
| `X402_ASSET` | HBAR asset id (default `0.0.0`) |
| `PORT` | Gateway port (default `8080`) |

## Commands

```bash
bun run validate     # workspaces OK
bun run typecheck    # tsc --noEmit (strict)
bun test             # unit + integration (13 pass / 0 fail)
```

The integration suite boots the real gateway and asserts a live `402` + `PAYMENT-REQUIRED` challenge,
including base64 JSON decoding.

## Not Yet Implemented (Roadmap — Phase 4 and beyond)

These are **planned, not built**:

- Consuming-agent payment flow (agent pays x402 + re-sends challenge)
- AI engine + yield-risk computation (currently a `501` placeholder behind the payment wall)
- Real end-to-end Hedera settlement (`PAYMENT-SIGNATURE` proof → verified → 200 response)
- Smart contracts (e.g. limit orders), HCS audit topics, HCS-14 discovery
- Frontend / dashboard
- SaucerSwap / Bonzo Finance protocol modules

Nothing above is claimed as working until it is implemented and verified on this repository.

## Repository Conventions

- **Primary dev environment:** Mac working copy
- **Repository authority:** GitHub (`origin`)
- **Shared conventions:** canonical x402 v2 headers only (`PAYMENT-REQUIRED` / `PAYMENT-SIGNATURE` /
  `PAYMENT-RESPONSE`) — the legacy v1 `X-402-Payment-Proof` header is explicitly not used.
- Commit history on `main` (Phase 1–2) is stable at `69fbe53`; Phase 3 lives on
  `phase-3-x402-middleware` pending review.

## License

MIT