# 🎨 Major Gainz: Frontend UI/UX Architecture & Component System
**Project Name:** Major Gainz — Autonomous x402 AI DeFi Agent  
**Framework:** Next.js 14 (App Router) + TypeScript + TailwindCSS + Framer Motion + Recharts + Privy Web3  
**Design Paradigm:** Dark Institutional Financial Theme (Glassmorphism, Neon Cyan/Emerald Accents, Micro-animations)

---

## 📐 1. General UI/UX Design System & Theme Tokens

### 🎨 Color Palette & Glassmorphism Tokens
```css
/* Dark Institutional Glassmorphism Theme */
--bg-primary: #08090D;          /* Deep Void Black */
--bg-surface: #0E1118;          /* Card Dark Surface */
--bg-surface-hover: #161B26;    /* Interactive Surface Hover */
--border-subtle: rgba(255, 255, 255, 0.08);
--border-glow: rgba(0, 242, 254, 0.3);

/* Accent Gradients */
--gradient-primary: linear-gradient(135deg, #00F2FE 0%, #4FACFE 100%); /* x402 Cyan Glow */
--gradient-emerald: linear-gradient(135deg, #00E676 0%, #1DE9B6 100%); /* Yield/Gainz Green */
--gradient-warning: linear-gradient(135deg, #FF9100 0%, #FF5252 100%); /* Risk Red/Orange */

/* Shadows & Glow Effects */
--glow-cyan: 0px 0px 30px rgba(0, 242, 254, 0.2);
--glow-emerald: 0px 0px 25px rgba(0, 230, 118, 0.18);
--glass-blur: blur(16px) saturate(180%);
```

### ✨ Motion & Animation Principles (Framer Motion)
* **Page Transitions:** Fade & Scale-Up (`opacity: 0 -> 1, scale: 0.98 -> 1`).
* **Card Entrance:** Staggered Children Animations (`staggerChildren: 0.08s`).
* **Hover Micro-interactions:** Magnetic button tilt, subtle border glow illumination, card lift (`y: -4px`).
* **Real-time Data Counters:** Smooth number ticking via `framer-motion` animate counter.

---

## 🖥️ 2. Screen-by-Screen UI/UX Architecture & Components

```
apps/web/src/app/
├── (marketing)/
│   └── page.tsx                    # Screen 1: Landing Page & Agent Marketplace
├── dashboard/
│   └── page.tsx                    # Screen 2: Main Dashboard & Risk Analytics
├── studio/
│   └── page.tsx                    # Screen 3: Interactive AI Strategy Studio & Chat Canvas
├── audit/
│   └── page.tsx                    # Screen 4: x402 Micro-Payment & HCS Audit Explorer
└── orders/
    └── page.tsx                    # Screen 5: AutoSwap Limit Order Manager
```

---

### 🌐 Screen 1: Landing Page & Agent Marketplace (`/`)

#### 🎯 Goal & Purpose
Attract judges and Web3 users instantly. Present the core value proposition ("Institutional AI DeFi Engine for Hedera x402"), display live metrics, and showcase the Agent Marketplace.

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│ [Logo: Major Gainz]  [Marketplace] [Dashboard] [HCS Explorer]  [Connect Wallet]   │
├───────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│    🤖 Next-Generation Autonomous AI DeFi Engine for Hedera x402                   │
│    Institutional Risk Scoring • SaucerSwap Yields • Bonzo Finance • HCS Audited   │
│                                                                                   │
│    [ 🚀 Launch AI Studio ]               [ 🔍 View Live HCS Audit Feed ]           │
│                                                                                   │
├───────────────────────────────────────────────────────────────────────────────────┤
│ 📊 LIVE NETWORK STATS TICKER                                                      │
│ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ ┌────────────────┐ │
│ │ Total NAV Scanned│ │ x402 Tx Settled  │ │ Avg Yield (APY)  │ │ HCS Topic ID   │ │
│ │ $14,285,900      │ │ 128,490 HBAR     │ │ 18.4% APY        │ │ 0.0.491028     │ │
│ └──────────────────┘ └──────────────────┘ └──────────────────┘ └────────────────┘ │
├───────────────────────────────────────────────────────────────────────────────────┤
│ 🛍️ AGENT MARKETPLACE (HCS-14 Registered Agents)                                    │
│ ┌─────────────────────────┐ ┌─────────────────────────┐ ┌─────────────────────────┐ │
│ │ Major Gainz Core Agent  │ │ SaucerSwap LP Optimizer │ │ Bonzo Risk Guard Agent  │ │
│ │ Price: 0.15 HBAR/call   │ │ Price: 0.10 HBAR/call   │ │ Price: 0.08 HBAR/call   │ │
│ │ [ Try Demo Agent ]      │ │ [ Try Demo Agent ]      │ │ [ Try Demo Agent ]      │ │
│ └─────────────────────────┘ └─────────────────────────┘ └─────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────────────────┘
```

#### 🧩 Key Components & Buttons
1. **`HeroSection.tsx`**: Particle mesh background with Framer Motion floating glowing shapes.
2. **`LiveStatsTicker.tsx`**: Ticker fetching real-time data from Hedera Mirror Node & HCS Audit Topic.
3. **`AgentMarketplaceGrid.tsx`**: Grid of available AI agents registered via **HCS-14**.
4. **Buttons & Actions:**
   * **`[Connect Wallet]` (`PrivyConnectBtn.tsx`)**: Triggers Privy modal for Social/Web3 auth.
   * **`[Launch AI Studio]`**: Navigates to `/studio`.
   * **`[Try Demo Agent]`**: Triggers a simulated x402 call with instant `PaymentModal` preview.

#### 🔗 Integrations
* **Auth & Wallet:** Privy SDK (`@privy-io/react-auth`).
* **Backend:** HCS-14 Agent Registry Topic query.

---

### 📊 Screen 2: Main Dashboard & Risk Analytics (`/dashboard`)

#### 🎯 Goal & Purpose
Provide retail investors with an institutional-grade financial dashboard: Health Factor, Portfolio Net Asset Value (NAV), live SaucerSwap pool yields, and Bonzo Finance lending APYs.

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│ NAV: $45,820.50 | Health Factor: 2.14 [SAFE] | ENS: majorgainz.eth | [Testnet 🟢]  │
├─────────────────────────────────────────┬─────────────────────────────────────────┤
│ 🛡️ PORTFOLIO RISK & HEALTH GAUGE        │ 📈 NET ASSET VALUE & YIELD CHART        │
│                                         │                                         │
│          [Radial Gauge Meter]           │      (Recharts Area Chart with Gradient)│
│            Risk Score: 28/100           │   $50k ─────────────────┐             │
│            Status: Low Risk             │   $25k ───────────────/─┘             │
│                                         │         Jan   Feb   Mar   Apr           │
│ [ ⚡ Run AI Portfolio Health Scan ]     │ [ 1D ] [ 1W ] [ 1M ] [ 1Y ] [ Live ]    │
├─────────────────────────────────────────┴─────────────────────────────────────────┤
│ 🥞 SAUCERSWAP V2 POOLS & YIELD OPPORTUNITIES                                       │
│ ┌────────────────┬──────────┬───────────┬──────────────┬────────────────────────┐ │
│ │ Pool Pair      │ TVL      │ 24h Vol   │ Est. APY     │ Action                 │ │
│ ├────────────────┼──────────┼───────────┼──────────────┼────────────────────────┤ │
│ │ HBAR / USDC    │ $4.2M    │ $850K     │ 24.2%        │ [ ⚡ Deposit LP ]       │ │
│ │ HBAR / SAUCE   │ $1.8M    │ $320K     │ 38.5%        │ [ ⚡ Deposit LP ]       │ │
│ └────────────────┴──────────┴───────────┴──────────────┴────────────────────────┘ │
├───────────────────────────────────────────────────────────────────────────────────┤
│ 🏦 BONZO FINANCE LENDING & BORROWING MATRIX                                       │
│ ┌──────────────┬───────────┬────────────┬──────────────┬────────────────────────┐ │
│ │ Asset        │ Supply APY│ Borrow APY │ Max LTV      │ Quick Action           │ │
│ ├──────────────┼───────────┼────────────┼──────────────┼────────────────────────┤ │
│ │ HBAR         │ 6.8%      │ 9.2%       │ 75%          │ [ Supply ] [ Borrow ]  │ │
│ │ USDC         │ 11.4%     │ 14.1%      │ 80%          │ [ Supply ] [ Borrow ]  │ │
│ └──────────────┴───────────┴────────────┴──────────────┴────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────────────────┘
```

#### 🧩 Key Components & Buttons
1. **`RiskGaugeCard.tsx`**: Animated SVG/Canvas Radial Gauge showing Risk Score (0-100) and Health Factor.
2. **`PortfolioChart.tsx`**: `Recharts` AreaChart with custom tooltip, gradient fill, and time-frame selectors.
3. **`SaucerSwapYieldTable.tsx`**: Interactive table with live APY calculations fetched from The Graph.
4. **`BonzoLendingMatrix.tsx`**: Collateral simulator slider to preview Health Factor changes before borrowing.
5. **Buttons & Actions:**
   * **`[Run AI Portfolio Health Scan]`**: Triggers `/api/v1/ai/reasoning` protected by `x402Auth`. Pops `PaymentModal` if unpaid.
   * **`[Deposit LP]`**: Pre-populates liquidity deposit transaction payload for SaucerSwap V2.
   * **`[Supply / Borrow]`**: Opens Bonzo Finance transaction drawer for collateral deposits.

#### 🔗 Integrations
* **Hedera Mirror Node REST API:** Fetch account token balances & native HBAR.
* **The Graph Subgraph:** Query SaucerSwap V2 pools & volume.
* **Chainlink Oracles:** Price feed calibration for USD values.
* **Smart Contract:** `HederaYieldVault.sol` read methods.

---

### 💬 Screen 3: Interactive AI Strategy Studio & Chat Canvas (`/studio`)

#### 🎯 Goal & Purpose
The main interaction hub. Combines a conversational AI Assistant (Left Canvas) with an Interactive Strategy Execution Canvas (Right Panel). Demonstrates the x402 payment flow live.

```
┌──────────────────────────────────────────┬────────────────────────────────────────┐
│ 💬 AI STRATEGY ASSISTANT (x402 Active)    │ 🛠️ STRATEGY EXECUTION CANVAS          │
├──────────────────────────────────────────┼────────────────────────────────────────┤
│ [AI]: Hello! I noticed you hold 5,000    │ 🎯 GENERATED STRATEGY PIPELINE          │
│ HBAR idle. SaucerSwap HBAR/USDC pool is  │ ┌────────────────────────────────────┐ │
│ offering 24.2% APY, while Bonzo supply   │ │ Step 1: Swap 2,500 HBAR -> USDC    │ │
│ is 6.8%. Shall I build a balanced yield  │ │ Protocol: SaucerSwap V2 Router     │ │
│ strategy for you?                        │ │ Est. Slippage: 0.12%               │ │
│                                          │ ├────────────────────────────────────┤ │
│ ⚡ [Paid 0.15 HBAR via Blocky402]         │ │ Step 2: Deposit LP to HBAR/USDC    │ │
│                                          │ │ Protocol: SaucerSwap LP            │ │
│ [User]: Yes, optimize for medium risk.   │ └────────────────────────────────────┘ │
│                                          │                                        │
│ [AI]: Strategy ready! Preview pipeline   │ 📊 ESTIMATED 1-YEAR RETURN             │
│ on the right panel.                      │ Projected APY: +21.8% ($1,090 / yr)   │
│                                          │                                        │
│ ┌──────────────────────────────────────┐ │ 🔒 HCS AUDIT HASH                      │
│ │ Type your prompt...        [🎙️] [Send]│ │ 0x8f2a...c4b9 (Verified Onchain)     │
│ └──────────────────────────────────────┘ │ [ 🚀 Approve & Execute Strategy ]     │
└──────────────────────────────────────────┴────────────────────────────────────────┘
```

#### 🧩 Key Components & Buttons
1. **`ChatInterface.tsx`**: Message stream with markdown syntax highlighting, code blocks, and animated typing indicators.
2. **`X402Badge.tsx`**: Micro-badge attached to AI messages displaying payment proof (`Settled 0.15 HBAR via Blocky402`).
3. **`StrategyPipelineCanvas.tsx`**: Visual card list showing execution steps (Swap -> Deposit -> Stake).
4. **`PaymentModal.tsx`**: Popup modal triggered when a `402 Payment Required` header is returned.
5. **Buttons & Actions:**
   * **`[Send]`**: Submits natural language prompt to `/api/v1/ai/reasoning`.
   * **`[Approve & Execute Strategy]`**: Invokes Privy/Hedera SDK to sign the multi-hop transaction batch.
   * **`[View HCS Proof]`**: Opens modal displaying consensus timestamp and topic message hash.

#### 🔗 Integrations
* **Middleware:** `x402Auth.ts` + `x402-client.ts` HTTP Interceptor.
* **AI Engine:** Python FastAPI RAG Engine.
* **Hedera Network:** `HederaYieldVault.sol` / `AutoSwapLimit.sol` contract invocation.

---

### 📜 Screen 4: x402 Micro-Payment & HCS Audit Explorer (`/audit`)

#### 🎯 Goal & Purpose
Provides complete onchain transparency for judges and auditors. Displays live HCS Consensus Service messages, cryptographic hashes, and Blocky402 settlement proofs.

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│ 🔍 HEDERA CONSENSUS SERVICE (HCS) AUDIT EXPLORER — TOPIC ID: 0.0.491028           │
├───────────────────────────────────────────────────────────────────────────────────┤
│ 📈 LIVE x402 PAYMENT VOLUME & INFERENCE CALLS                                    │
│    (Recharts Bar Chart showing micro-payments settled per hour)                  │
├───────────────────────────────────────────────────────────────────────────────────┤
│ 📋 AUDIT LOG TABLE (Live WebSocket Stream 🟢)                                     │
│ ┌──────────┬─────────────┬───────────┬──────────────┬──────────────┬────────────┐ │
│ │ Time     │ Payer ID    │ Fee (HBAR)│ Service Type │ HCS Hash     │ Status     │ │
│ ├──────────┼─────────────┼───────────┼──────────────┼──────────────┼────────────┤ │
│ │ 14:52:10 │ 0.0.381920  │ 0.15 HBAR │ Risk Analysis│ 0x9a8f...3d  │ 🟢 Settled │ │
│ │ 14:51:45 │ 0.0.412093  │ 0.10 HBAR │ Saucer Yield │ 0x4b2c...1e  │ 🟢 Settled │ │
│ │ 14:50:02 │ 0.0.198234  │ 0.08 HBAR │ Bonzo Audit  │ 0x7e1a...8f  │ 🟢 Settled │ │
│ └──────────┴─────────────┴───────────┴──────────────┴──────────────┴────────────┘ │
│ [ 🔄 Refresh Feed ]  [ 📥 Export CSV Report ]  [ 🔗 View Topic on HashScan ]      │
└───────────────────────────────────────────────────────────────────────────────────┘
```

#### 🧩 Key Components & Buttons
1. **`HcsVolumeChart.tsx`**: Recharts BarChart representing hourly micro-payment throughput.
2. **`HcsAuditTable.tsx`**: Real-time updating table connected to Hedera Mirror Node WebSocket / HCS Topic.
3. **`CryptographicProofModal.tsx`**: Modal displaying raw HCS message payload, sequence number, and running hash.
4. **Buttons & Actions:**
   * **`[View Topic on HashScan]`**: External link to `https://hashscan.io/testnet/topic/0.0.491028`.
   * **`[Verify Proof]`**: Re-hashes message client-side and matches against HCS running hash.

#### 🔗 Integrations
* **Hedera Consensus Service (HCS):** Direct Mirror Node HCS Topic listener.
* **Blocky402 API:** Facilitator settlement verification.

---

### ⚙️ Screen 5: AutoSwap Limit Order Manager (`/orders`)

#### 🎯 Goal & Purpose
Dedicated UI for managing non-custodial limit orders executed via `AutoSwapLimit.sol` and Chainlink Oracles.

```
┌──────────────────────────────────────────┬────────────────────────────────────────┐
│ 📉 HBAR / USDC LIVE TRADINGVIEW CHART    │ 📝 CREATE LIMIT ORDER                  │
├──────────────────────────────────────────┼────────────────────────────────────────┤
│                                          │ Order Type: [ Buy HBAR ] [ Sell HBAR ] │
│   (Candlestick / Line Chart)             │                                        │
│   Current Price: $0.0782 USDC            │ Target Price (USDC):                   │
│   24h Change: +5.4%                      │ [ 0.0720                         ]     │
│                                          │                                        │
│                                          │ Amount (HBAR):                         │
│                                          │ [ 10,000                         ]     │
│                                          │                                        │
│                                          │ Expiry: [ 7 Days ] [ 30 Days ] [ Never]│
│                                          │                                        │
│                                          │ [ 🚀 Create Onchain Limit Order ]      │
├──────────────────────────────────────────┴────────────────────────────────────────┤
│ 📋 ACTIVE ONCHAIN LIMIT ORDERS                                                    │
│ ┌──────────┬──────────┬─────────────┬──────────────┬────────────┬───────────────┐ │
│ │ Order ID │ Pair     │ Target Price│ Amount       │ Status     │ Action        │ │
│ ├──────────┼──────────┼─────────────┼──────────────┼────────────┼───────────────┤ │
│ │ #1042    │ HBAR/USDC│ $0.0720 USDC│ 10,000 HBAR  │ 🟡 Pending │ [ Cancel Order│ │
│ └──────────┴──────────┴─────────────┴──────────────┴────────────┴───────────────┘ │
└───────────────────────────────────────────────────────────────────────────────────┘
```

#### 🧩 Key Components & Buttons
1. **`PriceChartWidget.tsx`**: Interactive TradingView / Lightweight Charts widget.
2. **`LimitOrderForm.tsx`**: Form validating user input against balance and target trigger prices.
3. **`ActiveOrdersTable.tsx`**: Reads pending orders directly from `AutoSwapLimit.sol`.
4. **Buttons & Actions:**
   * **`[Create Onchain Limit Order]`**: Calls `createLimitOrder()` on `AutoSwapLimit.sol`.
   * **`[Cancel Order]`**: Calls `cancelOrder()` to refund escrowed tokens immediately.

---

## 🛠️ 3. Core React Hooks & State Management Architecture

### 1. `useX402Payment.ts` (The Core Interceptor Hook)
```typescript
import { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';

export function useX402Payment() {
  const { signTransaction } = usePrivy();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [challengeData, setChallengeData] = useState<any>(null);

  const fetchWithX402 = async (url: string, options: RequestInit = {}) => {
    // 1. First attempt: standard fetch
    let response = await fetch(url, options);

    // 2. Catch 402 Payment Required
    if (response.status === 402) {
      const challenge = await response.json();
      setChallengeData(challenge);
      setIsModalOpen(true); // Open PaymentModal.tsx

      // Wait for user confirmation in modal
      const paymentProof = await handlePaymentExecution(challenge);

      // 3. Retry request with payment proof header
      response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'X-402-Payment-Proof': paymentProof,
        },
      });
    }

    return response.json();
  };

  const handlePaymentExecution = async (challenge: any) => {
    // Executes sub-second HBAR micro-transfer via Blocky402 / Hedera SDK
    // Returns signed cryptographic proof string
    return "SIGNED_PROOF_STRING_X402";
  };

  return { fetchWithX402, isModalOpen, setIsModalOpen, challengeData };
}
```

### 2. `useHederaContracts.ts` (Smart Contract Interaction Hook)
```typescript
import { useContractWrite, useContractRead } from 'wagmi';
import AutoSwapLimitABI from '@/abi/AutoSwapLimit.json';

export function useAutoSwapContract() {
  const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_AUTO_SWAP_CONTRACT!;

  const createOrder = async (targetPrice: string, amount: string) => {
    // Invokes HSCS EVM contract on Hedera Testnet
  };

  return { createOrder };
}
```

---

## 💎 4. Final UI/UX Excellence Checklist for Hackathon First Place

* **Sub-Second Feedback:** Every x402 payment interaction provides instant visual feedback via animated pulse indicators.
* **Glassmorphic Aesthetic:** Dark void background (`#08090D`) with glowing cyan borders and crisp typography (`Inter` / `JetBrains Mono`).
* **Zero Jittering Data:** Skeletal loaders (`Shadcn Skeleton`) for all async queries (Mirror Node & Subgraphs).
* **Fully Responsive:** Seamless layout scaling for desktop judges and mobile device walkthroughs.
