<div align="center">

# ⚡ Strata402 ⚡
### Autonomous DeFi Intelligence on Hedera

[![Hedera Testnet](https://img.shields.io/badge/Hedera-Testnet_Chain_296-3399FF?style=for-the-badge&logo=hedera)](https://hashscan.io/testnet)
[![x402 Protocol](https://img.shields.io/badge/x402-Payment_Required-00F2FE?style=for-the-badge)](https://x402.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![Bun Workspace](https://img.shields.io/badge/Bun-Monorepo-fbf0df?style=for-the-badge&logo=bun)](https://bun.sh)
[![Next.js 14](https://img.shields.io/badge/Next.js-14_App_Router-000000?style=for-the-badge&logo=next.js)](https://nextjs.org)

**x402-powered AI DeFi strategy service for autonomous agents on Hedera.**

[📹 Watch 5-Min Video Demo](https://youtube.com/watch?v=YOUR_DEMO_VIDEO) · [🌐 Live App](https://strata402.vercel.app) · [📜 HashScan HCS Topic](https://hashscan.io/testnet/topic/0.0.YOUR_TOPIC_ID)

</div>

---

## 📌 Executive Summary

**Strata402** bridges the intelligence gap between institutional quant funds and retail investors on **Hedera Hashgraph**. Powered by a specialized **RAG (Retrieval-Augmented Generation) AI Engine**, Strata402 analyzes onchain portfolio risks, tracks live liquidity pools on **SaucerSwap V2**, monitors lending APYs on **Bonzo Finance**, and constructs optimal limit order trades.

To unlock a true **Agentic Economy**, Strata402 monetizes its AI inference endpoints natively using the **x402 Payment Protocol** and **Blocky402 Facilitator**. Consuming agents or human users pay sub-cent micro-fees in **HBAR** per API call with sub-second finality. Every inference request and payment proof leaves an unforgeable cryptographic audit trail on **Hedera Consensus Service (HCS Topic)**.

---

## 🏗️ System Architecture

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│                    1. USER & CONSUMING AGENT LAYER                                │
│   [ Next.js 14 Dashboard + Privy Wallets ]    [ Autonomous Consuming Agent ]      │
└─────────────────────────────────────────┬─────────────────────────────────────────┘
                                          │
                                          ▼ (x402 HTTP Request / HBAR Payment)
┌───────────────────────────────────────────────────────────────────────────────────┐
│                    2. x402 GATEWAY & METERED PAYMENT LAYER                        │
│   • x402 Interceptor Guard (HTTP 402 Challenge Generator)                         │
│   • Blocky402 Payment Facilitator (Sub-second HBAR Settlement)                     │
│   • HCS Audit Logger (Hedera Consensus Service Topic Submission)                  │
└─────────────────────────────────────────┬─────────────────────────────────────────┘
                                          │
                                          ▼ (Verified X-402-Payment-Proof Header)
┌───────────────────────────────────────────────────────────────────────────────────┐
│                    3. AI REASONING & RAG ENGINE (Python FastAPI)                  │
│   • Intent-Based Tool Router (SaucerSwap vs Bonzo vs AutoSwap Router)             │
│   • Portfolio Risk Scoring Engine & Quant Variance Models                         │
│   • ChromaDB Vector Store (Hedera DeFi Protocol Knowledge Base)                   │
└─────────────────────────────────────────┬─────────────────────────────────────────┘
                                          │
                  ┌───────────────────────┴───────────────────────┐
                  ▼                                               ▼
┌──────────────────────────────────┐            ┌──────────────────────────────────┐
│   4a. SaucerSwap V2 Module       │            │   4b. Bonzo Finance Module       │
│   • Liquidity Pool APYs & Swaps  │            │   • Live Lending/Borrowing APYs  │
│   • Infinity Pools Yield Metrics │            │   • Health Factor & LTV Metrics  │
└─────────────────┬────────────────┘            └─────────────────┬────────────────┘
                  │                                               │
                  └───────────────────────┬───────────────────────┘
                                          │
                                          ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                    5. HEDERA INFRASTRUCTURE & ONCHAIN LEDGER                      │
│   [ Hedera Smart Contract Service ]  [ HCS Audit Topic ]  [ HCS-14 Agent Registry ] │
└───────────────────────────────────────────────────────────────────────────────────┘
```

---

## ✨ Key Features & Capabilities

* 🤖 **x402 Pay-Per-Call AI Inference:** Monetize AI reasoning dynamically without API keys or monthly subscriptions.
* 🛡️ **Risk-Adjusted Portfolio Assessment:** Computes real-time Health Factors and VaR (Value at Risk) metrics using Chainlink Oracles and Hedera Mirror Nodes.
* 💧 **SaucerSwap V2 & Infinity Pool Integration:** Real-time liquidity indexing and automated multi-hop swap route building.
* 🏦 **Bonzo Finance Lending Strategies:** Automated monitoring of deposit APYs, borrow rates, and collateral utilization.
* 🎯 **Smart Limit Orders (`AutoSwapLimit.sol`):** Non-custodial Solidity smart contract deployed on Hedera Testnet (HSCS) executing orders upon reaching target price oracle triggers.
* 📜 **Verifiable HCS Audit Trail:** Every inference request hash and payment proof is logged immutably on a dedicated Hedera Consensus Topic.
* 🔍 **HCS-14 Agent Discovery:** Registered on the HCS-14 open directory for autonomous agent-to-agent discovery.

---

## 🏆 Hackathon Tracks & Partner Bounties Alignment

Strata402 is built to win across multiple tracks by utilizing the best-in-class Web3 stack:

| Partner / Track | Integration Purpose in Strata402 | Status |
| :--- | :--- | :---: |
| **Hedera (Main AI Track)** | Native HBAR x402 payments, HSCS EVM contracts, HCS Audit Trail, HCS-14 Agent Discovery | ✅ Live |
| **The Graph ($15k)** | Subgraph indexing for SaucerSwap liquidity pools & Bonzo Finance lending protocols | ✅ Integrated |
| **1inch ($7k)** | Aggregation router for multi-chain liquidity and optimal execution pathing | ✅ Integrated |
| **Chainlink ($3k)** | Decentralized Price Feeds for Net Asset Value (NAV) and risk calculation | ✅ Integrated |
| **ENS ($5k)** | Agent identity resolution (`majorgainz.eth`) for human-readable agent endpoints | ✅ Integrated |
| **Privy ($5k)** | Seamless social/email login with embedded non-custodial wallet creation | ✅ Integrated |

---

## 🛠️ Monorepo Structure

```text
strata402/
├── apps/
│   ├── web/                    # Next.js 14 App Router Frontend + Privy Auth
│   └── consuming-agent/        # Autonomous x402 Client Agent (Automated Payer)
├── contracts/                  # Hardhat EVM Solidity Smart Contracts (HSCS)
│   ├── src/
│   │   ├── AutoSwapLimit.sol   # SaucerSwap V2 Limit Order Engine
│   │   ├── HederaYieldVault.sol# Automated Yield Vault
│   │   └── AgentRegistryHCS14.sol # Onchain Identity Registry
│   └── scripts/deploy.ts       # Testnet Deployment Script
├── services/
│   ├── api-gateway/            # Express.js x402 Gateway Guard & HCS Logger
│   └── ai-engine/              # Python FastAPI & LlamaIndex RAG Engine
└── packages/
    └── x402-hedera-sdk/        # Shared Types & Header Parsing SDK
```

---

## 🚀 Quick Start Guide

### Prerequisites
* [Bun](https://bun.sh) (v1.1+)
* [Python](https://python.org) (v3.11+)
* Hedera Testnet Account (Operator ID & Private Key from [portal.hedera.com](https://portal.hedera.com))

### 1. Installation
```bash
# Clone the repository
git clone https://github.com/your-username/strata402.git
cd strata402

# Install all monorepo dependencies using Bun
bun install
```

### 2. Environment Setup
Copy `.env.example` to `.env` in the root directory:
```bash
cp .env.example .env
```
Fill in your `OPERATOR_ID`, `OPERATOR_KEY`, and API keys for OpenAI, The Graph, 1inch, and Privy.

### 3. Deploy Smart Contracts to Hedera Testnet
```bash
cd contracts
bun run hardhat compile
bun run scripts/deploy.ts --network hedera_testnet
```

### 4. Initialize HCS Audit Topic
```bash
bun run scripts/create-hcs-topic.ts
```

### 5. Start All Services Locally
```bash
# Start API Gateway, AI Engine, and Frontend concurrently
bun run dev
```

Visit `http://localhost:3000` to interact with the Strata402 Dashboard!

---

## 🧪 Running Autonomous Consuming Agent Test (x402 End-to-End)

To test autonomous agent-to-agent payment and execution:

```bash
bun run --filter consuming-agent start
```

**Expected Flow Output:**
1. Agent discovers Strata402 endpoint via HCS-14 Topic.
2. Agent sends AI reasoning request to `http://localhost:4000/api/v1/ai/reasoning`.
3. Server returns `HTTP 402 Payment Required` with `HBAR` amount challenge.
4. Agent executes micro-payment via Blocky402 on Hedera Testnet.
5. Agent re-sends request with `X-402-Payment-Proof` header.
6. Server verifies proof, logs transaction hash to HCS Topic, and returns AI Portfolio Strategy Payload (`HTTP 200 OK`).

---

## 📜 Smart Contract Deployments (Hedera Testnet - Chain ID 296)

* **AutoSwapLimit:** `0x1234567890abcdef1234567890abcdef12345678` ([HashScan Link](https://hashscan.io/testnet/contract/0x1234567890abcdef1234567890abcdef12345678))
* **HederaYieldVault:** `0xabcdef1234567890abcdef1234567890abcdef12` ([HashScan Link](https://hashscan.io/testnet/contract/0xabcdef1234567890abcdef1234567890abcdef12))
* **AgentRegistryHCS14:** `0x7890abcdef1234567890abcdef1234567890abcd` ([HashScan Link](https://hashscan.io/testnet/contract/0x7890abcdef1234567890abcdef1234567890abcd))
* **HCS Audit Topic ID:** `0.0.543210` ([HashScan Topic Messages](https://hashscan.io/testnet/topic/0.0.543210))

> ⚠️ Replace the placeholder addresses above with your actual deployed values from [HashScan](https://hashscan.io/testnet) before the final submission.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.