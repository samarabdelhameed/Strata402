# Strata402 — 4-Minute Full-Stack Professional Demo Script
### Complete Frontend, Backend, CLI, and Hedera Testnet On-Chain Proof

## 🎯 هدف الفيديو والجمهور المستهدف
فيديو ديمو احترافي مدته **4 دقائق (3:45 إلى 4:00 دقيقة)** مخصص لحكام **ETHGlobal 2026 / Hedera Track**.
يغطي الديمو الدورة الكاملة (Full-Stack End-to-End):
1. **الـ Terminal / Backend**: تشغيل وفحص الـ Gateway والـ AI Engine والـ CLI Consuming Agent.
2. **الـ Frontend (Web UI)**: التفاعل المباشر على `http://localhost:3000` وااختبار الـ x402 Paid Strategy و HCS Audit Log و Onchain Orders.
3. **إثبات الـ On-Chain**: استعراض الحسابات والمستندات الحية والمعاملات الموثقة على Hedera Testnet Mirror Node و HashScan.

---

## 📊 الأرقام والحقائق الحقيقية المثبتة (Real Verified Proofs)

| العنصر | القيمة الحقيقية المثبتة |
| :--- | :--- |
| **Network** | `hedera:testnet` |
| **Payer Account** | `0.0.10329902` |
| **Service Account (payTo)** | `0.0.10464194` |
| **Blocky402 Fee Payer** | `0.0.7162784` |
| **Facilitator Endpoint** | `https://api.testnet.blocky402.com` |
| **Price / Call** | `1,000,000 tinybars` (`0.01 HBAR`) |
| **Verified Transaction ID** | `0.0.7162784-1789280004-167416393` |
| **HCS Audit Topic** | `0.0.10483725` |
| **HCS Sequence** | `49` |
| **Verified Contracts** | `AutoSwapLimit` (`0.0.10506192`) & `HederaYieldVault` (`0.0.10506193`) |

---

# 🎬 السكريبت الزمني المزدوج (Terminal + Web UI)

---

### ⏱️ [0:00 – 0:40] 1. الفكرة والـ Backend Health & C0 Discovery (Terminal)

#### 🖥️ الشاشة (Screen)
افتح التيرمينال (Terminal) واعرض شاشتين أو نافذتين:
1. نفذ فحص الـ Health للـ Gateway والـ AI Engine:
```bash
curl -s http://localhost:8080/health
curl -s http://localhost:8000/health
```
**النتيجة في الشاشة**:
```json
{"status":"ok","service":"strata402-api-gateway","version":"0.1.0","network":"hedera:testnet"}
{"status":"ok","service":"strata402-ai-engine","network":"hedera:testnet","llmNarration":false}
```

2. نفذ الـ C0 Discovery Preflight لـ x402 Protocol:
```bash
bun run preflight:c0
```
**النتيجة في الشاشة**:
```text
✔ Discovery ok: payTo=0.0.10464194, price=1000000 tinybars (0.01 HBAR)
✔ HTTP 402 challenge verified: feePayer=0.0.7162784, facilitator=https://api.testnet.blocky402.com
```

#### 🎙️ الكلام الصوتي (English Script)
> "Hi everyone, this is Strata402 — Autonomous DeFi Intelligence for Machine-to-Machine Payments on Hedera.
> Strata402 lets autonomous agents discover paid AI strategy services, process x402 micropayments via Blocky402, receive deterministic risk analysis, and log immutable audit entries on Hedera Consensus Service.
> As you can see in our terminal, our Express Gateway and Python AI Engine are live on Hedera Testnet. Running our C0 discovery preflight confirms an active HTTP 402 challenge requesting exactly 0.01 HBAR via Blocky402 fee payer 0.0.7162784."

---

### ⏱️ [0:40 – 2:00] 2. الـ Frontend Live Experience & x402 Paid Execution (Web UI)

#### 🖥️ الشاشة (Screen)
انتقل إلى المتصفح على `http://localhost:3000` وادخل قسم **AI Studio** (`/studio`).
1. أظهر الشارات: `x402 ACTIVE` و `hedera:testnet` و `Account 0.0.10329902`.
2. اكتب في خانة الشات (Prompt):
   `Evaluate balanced yield strategy for HBAR holding`
3. اضغط **Enter**.
4. شاهد خطوات الـ Pipeline تتحول إلى حالة **DONE**:
   - `Read account facts` (Mirror Node)
   - `Settle x402 micropayment` (0.01 HBAR via Blocky402)
   - `Deterministic risk analysis`
5. أظهر استجابة الذكاء الاصطناعي وشارة التسوية:
   `⚡ Settled 0.01 HBAR via Blocky402`
   وإثبات الـ Transaction ID والـ HCS Topic.

#### 🎙️ الكلام الصوتي (English Script)
> "Now let's look at the Web UI. Here in the AI Studio, we enter a strategy request.
> Watch the pipeline in real time: First, the gateway reads live account facts from the Hedera Mirror Node. Second, our consuming agent signs a 0.01 HBAR x402 payment, which Blocky402 verifies and settles on Hedera Testnet.
> Third, the AI Engine returns a transparent analysis over real on-chain facts.
> Notice our Honesty Contract: Strategy execution is explicitly marked as GATED and PENDING — we separate payment settlement success from trade execution, ensuring zero fabricated trades or fake APY claims."

---

### ⏱️ [2:00 – 2:50] 3. التدقيق الحي HCS Audit & Onchain Orders (`/audit` & `/orders`)

#### 🖥️ الشاشة (Screen)
1. انتقل إلى تبويب **HCS Auditor** (`/audit`).
   - سلط الضوء على Topic `0.0.10483725` والـ Sequence (Seq `49`) والـ Decoded JSON Payload الذي يحتوي على رقم الـ Transaction والـ Status `200`.
2. انتقل إلى تبويب **Orders** (`/orders`).
   - اضغط على **🚀 Create Onchain Limit Order** (لطلب شراء HBAR/USDC).
   - أظهر تسجيل نية الأمر على HCS بنجاح، مع إبقاء حالة التنفيذ `PENDING FEED` أمادًا للمستخدم.

#### 🎙️ الكلام الصوتي (English Script)
> "In the HCS Auditor tab, every handled request is published to Hedera Consensus Service Topic 0.0.10483725. We can verify the sequence number, timestamp, and decoded metadata directly from the Mirror Node.
> Moving to the Orders tab, users can publish limit order intents directly to HCS. The intent is signed and written on-chain, while the market feed stays honestly marked as PENDING until official testnet oracle feeds are available."

---

### ⏱️ [2:50 – 3:35] 4. إثبات الـ On-Chain الحقيقي (Mirror Node & HashScan)

#### 🖥️ الشاشة (Screen)
افتح التبويبات التالية في المتصفح واستعرضها:
1. **HashScan Paid Transaction**:
   `https://hashscan.io/testnet/transaction/0.0.7162784-1789280004-167416393`
   - أظهر حالة `SUCCESS` والمبلغ `1,000,000 tinybars` من الحساب `0.0.10329902` إلى `0.0.10464194`.
2. **HashScan HCS Topic**:
   `https://hashscan.io/testnet/topic/0.0.10483725`
3. **Bytecode Verified Smart Contracts**:
   `AutoSwapLimit` (`0.0.10506192`) و `HederaYieldVault` (`0.0.10506193`).

#### 🎙️ الكلام الصوتي (English Script)
> "Here is our independent on-chain proof on HashScan:
> Transaction 0.0.7162784-1789280004-167416393 is SUCCESSFUL on Hedera Testnet, transferring 0.01 HBAR from payer 0.0.10329902 to service account 0.0.10464194 via Blocky402 fee payer.
> We also see our HCS topic with all audit entries, and our deployed smart contracts AutoSwapLimit and HederaYieldVault, which are source-code verified on HashScan."

---

### ⏱️ [3:35 – 4:00] 5. الختام (Summary & Wrap Up)

#### 🖥️ الشاشة (Screen)
ارجع إلى شاشة **Studio** أو صفحة الـ Dashboard الرئيسية ذات التصميم الداكن الفاخر.

#### 🎙️ الكلام الصوتي (English Script)
> "To summarize: Strata402 delivers a complete, production-ready pay-per-call AI strategy gateway on Hedera Testnet.
> Powered by x402 v2, settled by Blocky402, audited by HCS, and built with strict failure safety and zero fake data.
> Thank you for watching!"

---

## 🛠️ الأوامر المستخدمة قبل وأثناء التسجيل (Cheat Sheet)

```bash
# 1. فحص سلامة الـ Services (Terminal)
curl -s http://localhost:8080/health
curl -s http://localhost:8000/health

# 2. فحص C0 Discovery و 402 Challenge (Terminal)
bun run preflight:c0

# 3. فحص الاختبارات الشاملة (Terminal)
bun test

# 4. تشغيل C1 CLI Paid Request الحي (اختياري لتصوير الـ Terminal)
STRATA402_RUN_C1=true STRATA402_C1_CONFIRM=true bun run preflight:c1
```

---

## 🔗 الروابط الجاهزة للفتح أثناء الفيديو

1. **HashScan Paid Transaction**:
   `https://hashscan.io/testnet/transaction/0.0.7162784-1789280004-167416393`
2. **HashScan HCS Audit Topic**:
   `https://hashscan.io/testnet/topic/0.0.10483725`
3. **Verified AutoSwap Contract**:
   `https://hashscan.io/testnet/contract/0xbB1c5210B395253B66eA8B8326083c7fD63E2978`
4. **Web UI**:
   `http://localhost:3000`
