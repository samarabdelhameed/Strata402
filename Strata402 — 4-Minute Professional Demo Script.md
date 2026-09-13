# Strata402 — 4-Minute Full-Stack Professional Demo Script
### Complete Frontend, Backend, CLI, and Hedera Testnet On-Chain Proof

## 🎯 هدف الفيديو والجمهور المستهدف
فيديو ديمو احترافي مدته **4 دقائق (3:45 إلى 4:00 دقيقة)** مخصص لحكام **ETHGlobal 2026 / Hedera Track**.
يغطي الديمو الدورة الكاملة (Full-Stack End-to-End):
1. **الـ Terminal / Backend**: تشغيل وفحص الـ Gateway والـ AI Engine وأوامر الـ `curl` لاستخراج الإثباتات المباشرة من Hedera Mirror Node و Blocky402.
2. **الـ Frontend (Web UI)**: التفاعل المباشر على `http://localhost:3000` واختبار الـ x402 Paid Strategy و HCS Audit Log و Onchain Orders.
3. **إثبات الـ On-Chain المزدوج**: استعراض المخرجات من التيرمينال ومن متصفح HashScan المباشر.

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
| **HCS Sequence** | `52` |
| **Verified Contracts** | `AutoSwapLimit` (`0.0.10506192`) & `HederaYieldVault` (`0.0.10506193`) |

---

# 🎬 السكريبت الزمني المزدوج (Terminal + Web UI)

---

### ⏱️ [0:00 – 0:45] 1. الفكرة والـ Backend Health & Live Blocky402 Check (Terminal)

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

2. نفذ الـ C0 Discovery Preflight وافحص Blocky402 Host مباشر بالـ curl:
```bash
bun run preflight:c0
curl -s "https://api.testnet.blocky402.com/supported" | jq '.kinds[] | select(.network=="hedera:testnet")'
```
**النتيجة في الشاشة**:
```json
{
  "x402Version": 2,
  "scheme": "exact",
  "network": "hedera:testnet",
  "extra": {
    "feePayer": "0.0.7162784"
  }
}
```

#### 🎙️ الكلام الصوتي (English Script)
> "Hi everyone, this is Strata402 — Autonomous DeFi Intelligence for Machine-to-Machine Payments on Hedera.
> Strata402 lets autonomous agents discover paid AI strategy services, process x402 micropayments via Blocky402, receive deterministic risk analysis, and log immutable audit entries on Hedera Consensus Service.
> As you can see in our terminal, our Express Gateway and Python AI Engine are live on Hedera Testnet. Querying the official Blocky402 testnet facilitator confirms active support for Hedera Testnet with exact scheme and fee payer 0.0.7162784."

---

### ⏱️ [0:45 – 1:30] 2. إثبات الـ Backend Transaction & HCS Topic المباشر بالـ Terminal Commands

#### 🖥️ الشاشة (Screen)
في التيرمينال، شغّل الأوامر التالية لإستخراج الإثبات المباشر من Hedera Mirror Node:

1. **إثبات تحويل الـ 0.01 HBAR الموثق**:
```bash
curl -s "https://testnet.mirrornode.hedera.com/api/v1/transactions/0.0.7162784-1789280004-167416393" | jq '{result: .transactions[0].result, transfers: .transactions[0].transfers}'
```
**النتيجة في الشاشة**:
```json
{
  "result": "SUCCESS",
  "transfers": [
    { "account": "0.0.7162784", "amount": -266094 },
    { "account": "0.0.10329902", "amount": -1000000 },
    { "account": "0.0.10464194", "amount": 1000000 }
  ]
}
```

2. **إثبات الـ HCS Audit Message المباشر**:
```bash
curl -s "https://testnet.mirrornode.hedera.com/api/v1/topics/0.0.10483725/messages?limit=1&order=desc" | jq '{seq: .messages[0].sequence_number, payload: (.messages[0].message | @base64d)}'
```
**النتيجة في الشاشة**:
```json
{
  "seq": 52,
  "payload": "{\"requestId\":\"d0fd0709-08bc-456f-861a-6f8ebc08fb89\",\"endpoint\":\"/v1/strategy/yield-risk\",\"status\":\"200\"}"
}
```

#### 🎙️ الكلام الصوتي (English Script)
> "Directly from our backend terminal, we query the Hedera Mirror Node API.
> The transaction result is SUCCESS: Payer 0.0.10329902 transferred exactly 1,000,000 tinybars (0.01 HBAR) to service account 0.0.10464194 with Blocky402 covering the network fee.
> Furthermore, querying our HCS Topic 0.0.10483725 retrieves the live base64 decoded audit entry, matching our API request ID and status 200."

---

### ⏱️ [1:30 – 2:45] 3. الـ Frontend Live Experience & x402 Paid Execution (Web UI)

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

### ⏱️ [2:45 – 3:30] 4. التدقيق الحي HCS Audit & Onchain Orders (`/audit` & `/orders`)

#### 🖥️ الشاشة (Screen)
1. انتقل إلى تبويب **HCS Auditor** (`/audit`).
   - سلط الضوء على Topic `0.0.10483725` والـ Sequence (Seq `52`) والـ Decoded JSON Payload الذي يحتوي على رقم الـ Transaction والـ Status `200`.
2. انتقل إلى تبويب **Orders** (`/orders`).
   - اضغط على **🚀 Create Onchain Limit Order** (لطلب شراء HBAR/USDC).
   - أظهر تسجيل نية الأمر على HCS بنجاح، مع إبقاء حالة التنفيذ `PENDING FEED` أمادًا للمستخدم.

#### 🎙️ الكلام الصوتي (English Script)
> "In the HCS Auditor tab, every handled request is published to Hedera Consensus Service Topic 0.0.10483725. We can verify the sequence number, timestamp, and decoded metadata directly from the Mirror Node.
> Moving to the Orders tab, users can publish limit order intents directly to HCS. The intent is signed and written on-chain, while the market feed stays honestly marked as PENDING until official testnet oracle feeds are available."

---

### ⏱️ [3:30 – 4:00] 5. الختام وإثبات HashScan (Summary & Wrap Up)

#### 🖥️ الشاشة (Screen)
افتح متصفح HashScan سريعا على المعاملة:
`https://hashscan.io/testnet/transaction/0.0.7162784-1789280004-167416393`
ثم ارجع لشاشة الـ Dashboard الرئيسية.

#### 🎙️ الكلام الصوتي (English Script)
> "To summarize: Strata402 delivers a complete, production-ready pay-per-call AI strategy gateway on Hedera Testnet.
> Verified on-chain via Hedera Mirror Node, settled by Blocky402, audited by HCS, and built with strict failure safety and zero fake data.
> Thank you for watching!"

---

## 🛠️ الأوامر السريعة الجاهزة للنسخ في التيرمينال أثناء الفيديو

```bash
# 1. فحص صحة الخوادم
curl -s http://localhost:8080/health
curl -s http://localhost:8000/health

# 2. فحص دعم Blocky402 Testnet و Fee Payer
curl -s "https://api.testnet.blocky402.com/supported" | jq '.kinds[] | select(.network=="hedera:testnet")'

# 3. استخراج تفاصيل المعاملة الحية من Mirror Node
curl -s "https://testnet.mirrornode.hedera.com/api/v1/transactions/0.0.7162784-1789280004-167416393" | jq '{result: .transactions[0].result, transfers: .transactions[0].transfers}'

# 4. قراءة وفك تشفير آخر رسالة HCS Audit من Mirror Node
curl -s "https://testnet.mirrornode.hedera.com/api/v1/topics/0.0.10483725/messages?limit=1&order=desc" | jq '{seq: .messages[0].sequence_number, payload: (.messages[0].message | @base64d)}'
```
