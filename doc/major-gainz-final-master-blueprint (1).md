# Major Gainz (x402 AI DeFi Agent) - Master Execution Blueprint & Monorepo Architecture

## 1. Summary of Adopted Components from Hedron (GitHub & Hackathon Demo)
From **Hedron (GitHub & Demo)**, we extract and integrate the following production-tested Hedera DeFi modules into Major Gainz:
- **SaucerSwap Integration**: Token swap quotes, SaucerSwap Router execution, and Infinity Pool single-sided staking analytics.
- **Bonzo Finance Integration**: Lending/borrowing APY monitoring, supply/borrow transaction generation, and Health Factor calculation (Aave V2 fork on Hedera).
- **AutoSwapLimit & Oracle Executor**: Smart contract limit order system (`AutoSwapLimit`) with off-chain price oracle monitoring and execution bot.
- **Hedera Agent Kit Foundations**: Forked toolset built on `hashgraph/hedera-agent-kit-js` for native HTS (token operations), HCS (consensus messages), and HBAR transfers.
- **Structured Transaction Bytes Flow**: Non-custodial transaction generation where the AI prepares raw transaction bytes and the client wallet signs externally.

---

## 2. Full Monorepo Directory Architecture

```text
major-gainz-x402/
├── .github/
│   └── workflows/
│       └── ci-cd.yml
├── apps/
│   ├── web/                                # Frontend (Next.js 14 App Router + Tailwind)
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── page.tsx                # Landing & Agent Marketplace
│   │   │   │   ├── dashboard/              # Portfolio & DeFi Management
│   │   │   │   │   └── page.tsx
│   │   │   │   └── api/
│   │   │   │       └── x402/               # Next.js x402 Handler Proxy
│   │   │   │           └── route.ts
│   │   │   ├── components/
│   │   │   │   ├── dashboard/
│   │   │   │   │   ├── RiskGauge.tsx
│   │   │   │   │   ├── SaucerSwapYieldCard.tsx
│   │   │   │   │   └── BonzoLendingCard.tsx
│   │   │   │   ├── x402/
│   │   │   │   │   ├── PaymentModal.tsx
│   │   │   │   │   └── HcsAuditViewer.tsx
│   │   │   │   └── wallet/
│   │   │   │       └── PrivyConnectBtn.tsx
│   │   │   └── lib/
│   │   │       ├── x402-client.ts          # HTTP Interceptor for 402 Challenge
│   │   │       └── hedera-wallet.ts
│   │   ├── package.json
│   │   └── tailwind.config.js
│   │
│   └── consuming-agent/                    # Autonomous Buyer Agent (x402 Consumer)
│       ├── src/
│       │   ├── index.ts                    # End-to-end Automated Flow Script
│       │   ├── discover.ts                 # HCS-14 Agent Discovery
│       │   └── x402-payer.ts               # Auto HBAR Payment & Settlement
│       └── package.json
│
├── services/
│   ├── api-gateway/                        # Express.js Middleware & x402 Guard
│   │   ├── src/
│   │   │   ├── middlewares/
│   │   │   │   ├── x402Auth.ts             # Blocky402 Challenge & Verification
│   │   │   │   └── meteredPricing.ts       # Dynamic Fee Calculator
│   │   │   ├── services/
│   │   │   │   ├── blocky402.ts            # Blocky402 Facilitator Interface
│   │   │   │   └── hcsLogger.ts            # HCS Audit Trail Writer
│   │   │   └── server.ts
│   │   └── package.json
│   │
│   └── ai-engine/                          # Python FastAPI & RAG Core
│       ├── app/
│       │   ├── main.py
│       │   ├── api/v1/
│       │   │   ├── reasoning.py            # Portfolio & Risk Analysis
│       │   │   ├── saucerswap.py          # Swap & Infinity Pool Strategies
│       │   │   └── bonzo.py                # Lending/Borrowing Yield Strategies
│       │   ├── core/
│       │   │   ├── rag_pipeline.py         # LlamaIndex / LangChain Core
│       │   │   └── tool_router.py          # Intent-Based DeFi Tool Selector
│       │   └── services/
│       │       ├── saucerswap_service.py   # Live SaucerSwap API & Router
│       │       ├── bonzo_service.py        # Live Bonzo API & APY Engine
│       │       ├── autoswap_service.py     # AutoSwapLimit Contract Interface
│       │       └── hedera_mirror.py        # Hedera Mirror Node Client
│       └── requirements.txt
│
├── packages/
│   └── x402-hedera-sdk/                    # Shared x402 & Hedera Helpers
│       ├── src/
│       │   ├── header.ts                   # X-402-Payment-Proof Parser
│       │   └── hcs-audit.ts                # HCS Hash Verification
│       └── package.json
│
├── scripts/
│   ├── create-hcs-topic.ts                 # HCS Topic Setup
│   └── register-agent-hcs14.ts             # HCS-14 Directory Registration
│
├── .env.example                            # Unified Environment Template
├── docker-compose.yml
└── README.md
```

---

## 3. End-to-End Execution & Payment Flow

1. **Agent Discovery**: Consuming Agent queries HCS-14 registry topic (`0.0.345678`) to discover Major Gainz endpoint.
2. **Inference Request**: Consuming Agent sends `POST /api/v1/ai/saucerswap-strategy`.
3. **x402 Challenge**: API Gateway interceptor returns `HTTP 402 Payment Required` with Blocky402 payload specifying HBAR fee.
4. **Micropayment Settlement**: Buyer Agent signs and executes sub-second HBAR transfer via Blocky402 facilitator.
5. **Verified Inference Execution**: API Gateway verifies transaction hash, executes FastAPI RAG Engine call (fetching live SaucerSwap & Bonzo data), and returns strategy payload.
6. **HCS Audit Logging**: Payment proof, query hash, and response hash are committed to Hedera Consensus Service Topic for verifiable audit trail.
