# 🚀 Major Gainz: Master Execution Plan & Full Implementation Specification
## x402-Powered AI DeFi Agent on Hedera (1st Place Hackathon Blueprint)

---

## 1. الرؤية التنفيذية واستراتيجية انتزاع المركز الأول (Executive Strategy)

### 🎯 المشكلة الحقيقية والحل المبتكر:
* **المشكلة:** يفتقر متداولو التجزئة في التمويل اللامركزي (DeFi) للبيانات والمصادر والذكاء الاصطناعي المؤسسي، وفي الوقت نفسه تفتقر شبكات الوكلاء البرمجية (Agentic Economy) لبروتوكولات دفع فورية بالطلب بدون اشتراكات أو مفاتيح API.
* **الحل من Major Gainz:** بناء وكيل ذكاء اصطناعي (AI DeFi Agent) يقدم تحليلات واستراتيجيات محفظة بمستوى المؤسسات المالية، مصممة كخدمة **x402-Gated Metered AI Inference** على شبكة **Hedera**.
* **كيفية حسم شروط الهاكاثون:**
  1. **x402 + Blocky402:** تغليف خدمات الـ AI خلف بوابات x402 وتسويتها فورياً بـ HBAR / HTS عبر Blocky402 Facilitator.
  2. **Pay-Per-Call Dynamic Metering (Extra Points):** احتساب تكلفة الاستعلام بناءً على حجم المحفظة وعدد البروتوكولات المطلوبة (مثلاً: 0.1 HBAR للتقرير البسيط، 0.5 HBAR للتقرير العميق).
  3. **HCS Audit Trail (Extra Points):** كتابة وتوثيق كل معاملة استعلام ودفع على **Hedera Consensus Service (HCS Topic)** لإنشاء أثر مالي وفني غير قابل للتعديل.
  4. **Agent Discovery via HCS-14 (Extra Points):** تسجيل هوية الخدمة بدليل HCS-14 لتتمكن الوكلاء الأخرى (Consuming Agents) من اكتشافها والدفع لها تلقائياً.

---

## 2. معمارية وقواعد البيانات (Database Architecture & Strategy)

### 💡 هل سنحتاج قاعدة بيانات؟
**نعم، سنحتاج لـ Hybrid Database Strategy تتكون من 3 طبقات لضمان السرعة والأداء العالي:**

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│                               HYBRID DATABASE LAYER                               │
├───────────────────────────────┬─────────────────────────────────┬─────────────────┤
│    Relational DB (PostgreSQL) │    Vector DB (ChromaDB/Pinecone)│  Cache (Redis)  │
├───────────────────────────────┼─────────────────────────────────┼─────────────────┤
│ • سجل المستخدمين والمحافظ    │ • تضمينات بروتوكولات Hedera DeFi│ • x402 Nonces   │
│ • مؤشرات الأداء والتحليلات   │ • مستندات عقود SaucerSwap/Bonzo │ • Challenges    │
│ • ذاكرة مؤقتة لـ HCS Logs     │ • قواعد إدارة المخاطر المالية   │ • Rate Limits   │
└───────────────────────────────┴─────────────────────────────────┴─────────────────┘
```

### 1. PostgreSQL Schema (عبر Prisma ORM):

```prisma
// datasource db { provider = "postgresql", url = env("DATABASE_URL") }

model UserPortfolio {
  id              String   @id @default(uuid())
  hederaAccountId String   @unique
  riskScore       Int      @default(50)
  totalValueUsd   Float    @default(0.0)
  lastAnalyzedAt  DateTime @updatedAt
  createdAt       DateTime @default(now())
  
  auditLogs       HcsAuditLog[]
}

model HcsAuditLog {
  id              String        @id @default(uuid())
  userPortfolioId String
  userPortfolio   UserPortfolio @relation(fields: [userPortfolioId], references: [id])
  txHash          String        @unique
  hbarAmount      Float
  hcsSequenceNum  BigInt
  hcsTopicId      String
  queryType       String        // e.g., "DEEP_PORTFOLIO_RAG"
  timestamp       DateTime      @default(now())
}

model AgentRegistration {
  id            String   @id @default(uuid())
  agentName     String
  hcs14TopicId  String
  endpointUrl   String
  pricePerCall  Float
  isActive      Boolean  @default(true)
}
```

### 2. Vector Database (ChromaDB / Pinecone):
* **Collections:**
  * `hedera_defi_protocols`: يحتوي على كافة الشروط والمعطيات الخاصة ببروتوكولات SaucerSwap, Bonzo Finance, Stader, Silo.
  * `risk_frameworks`: قواعد فحص الثغرات، أخطاء العقود الذكية، وتوزيع السيولة.

---

## 3. تصميم وشكل شاشات الواجهة الأمامية (Frontend Screens & UI/UX)

تتكون الواجهة الأمامية (Next.js 14 App Router + TailwindCSS + Shadcn UI) من **4 شاشات رئيسية تفاعلية**:

### 📱 الشاشة 1: Landing Page & Agent Marketplace (سوق الوكلاء والاكتشاف)
* **الشكل والتصميم:**
  * **Header:** شعار Major Gainz، زر الاتصال بالمحفظة (`Connect HashPack Wallet`)، ومؤشر سرعة Hedera (`Sub-second Finality: Active`).
  * **Hero Section:** عنوان عريض: *"Institutional AI DeFi Intelligence, Paid Machine-to-Machine via Hedera x402"*.
  * **Interactive Calculator (Metered Pricing):** شريط سحب (Slider) يتيح للمستخدم إدخال عدد الاستعلامات وحجم المحفظة لمعاينة تكلفة الـ Pay-Per-Call بـ HBAR فورياً.
  * **Live Agent Directory (HCS-14 Discovery Feed):** بطاقات تعرض الخدمات المتاحة، عنوان Endpoint، والتكلفة لكل استعلام.

### 📱 الشاشة 2: Interactive DeFi Portfolio Dashboard (لوحة تحكم المحفظة والمخاطر)
* **الشكل والتصميم:**
  * **Top Metrics Ribbon:** إجمالي قيمة الأصول ($ Value)، عدد الرموز (Tokens/HTS)، ونسبة توزيع المخاطر.
  * **Risk Score Meter:** عداد دائري تفاعلي من 1 إلى 100 يوضح درجة خطورة المحفظة الحالية.
  * **Asset Breakdown Chart:** رسم بياني (Doughnut Chart) بـ Chart.js/Recharts يعرض توزيع الأصول على شبكة Hedera.
  * **Hedera Yield Opportunities Table:** جدول يعرض أسرع الفرص المتاحة على SaucerSwap / Bonzo Finance مع أزرار تنفيذ سريعة.

### 📱 الشاشة 3: x402 Pay-Per-Call Challenge Modal (نافذة الدفع السريع)
* **الشكل والتصميم:**
  * عند ضغط المستخدم أو الوكيل على "Generate AI Strategy":
  * تظهر نافذة انبثاقية شفافة (Glassmorphism Modal) تعرض:
    1. **HTTP Status:** `402 Payment Required`.
    2. **Cost Breakdown:** e.g., `0.2 HBAR ($0.012 USD)`.
    3. **Payment Target:** `0.0.123456 (Major Gainz Vault)`.
    4. **Button:** `Approve & Pay via HashPack (1-Click Settlement)`.
  * شريط تقدم يوضح: `Requesting -> 402 Challenge Received -> Signing HBAR Micro-Tx -> Verification via Blocky402 -> Instant AI Strategy Unlocked!`.

### 📱 الشاشة 4: Live HCS Audit Trail & Agent Console (شاشة تدقيق المعاملات)
* **الشكل والتصميم:**
  * جدول حي (Real-time Stream) يعرض كل طلب تم تسفيته عبر x402.
  * **الأعمدة:**
    * `Time` | `Client Account` | `HBAR Paid` | `Query Type` | `HCS Sequence #` | `Hedera Explorer Link`.
  * إمكانية الضغط على أي صف لرؤية الـ Hash والتحقق منه مباشرة على Hedera Mirror Node.

---

## 4. ربط الواجهة الأمامية بالخلفية والذكاء الاصطناعي (Integration Wiring)

```
[Next.js Frontend]
       │
       │ (1. HTTP POST /api/v1/ai/analyze)
       ▼
[x402 Axios Client Interceptor]
       │
       ├─► (No Proof) ──► Receive 402 Challenge ──► Open HashPack Modal ──► User Signs HBAR Tx
       │                                                                         │
       └─► (With Proof Header: X-402-Payment-Proof) ◄──────────────────────────────┘
               │
               ▼
   [Express API Gateway] ──► Validate via Blocky402 ──► [FastAPI Python AI Engine]
               │                                                      │
               ▼                                                      ▼
  [Write Log to HCS Topic]                                  [Execute RAG & Return Strategy]
```

### خطة الربط (Integration Wiring Protocol):
1. **العميل المخصص (Custom Axios Client):** تم بناء ملف `lib/x402-client.ts` ليكون الوسيط بين الواجهة والـ Backend.
2. **التعامل مع كود 402 تلقائياً:** عند إرسال أي طلب واستلام `402 Payment Required`، يقدم العميل محتوى التحدي لـ `PaymentModal.tsx` بدلاً من إظهار خطأ للمستخدم.
3. **توقيع المحفظة الدقيق:** يتم استدعاء `hedera-wallet.ts` لتوقيع وتحويل أجزاء الـ HBAR عبر WalletConnect / HashPack.
4. **إعادة الإرسال التلقائي:** بمجرد تأكيد المعاملة على Hedera واستلام الـ Tx Hash، يعيد العميل إرسال الطلب الأصلي مرفقاً بـ Header: `X-402-Payment-Proof: <TxHash>`.

---

## 5. دليل الفانكشنز التفصيلي لكافة أجزاء المشروع (Function Inventory)

### أ. ملفات الواجهة الأمامية (Frontend Functions):

#### `apps/web/src/lib/x402-client.ts`
* **`fetchX402GatedApi<T>(url: string, payload: object): Promise<T>`**
  * **المداخل:** `url` (رابط الخدمة), `payload` (بيانات الاستعلام).
  * **المخرجات:** البيانات المسترجعة من الـ AI بعد الدفع.
  * **الطقوس التنفيذية:** يرسل طلب مبدئي؛ إذا استلم status 402، يستخرج بيانات التحدي، يتواصل مع المحفظة لتنفيذ معاملة HBAR، يستلم Hash المعاملة، ثم يعيد الطلب مع الترويسة `X-402-Payment-Proof`.

#### `apps/web/src/lib/hedera-wallet.ts`
* **`connectHashPackWallet(): Promise<string>`**
  * **الوظيفة:** الاتصال بمحفظة HashPack وإرجاع `AccountId` الخاص بالمستخدم (e.g., `0.0.98765`).
* **`executeHbarMicroPayment(recipientId: string, amountHbar: number): Promise<string>`**
  * **المداخل:** `recipientId` (حساب المستلم), `amountHbar` (المبلغ المطلق).
  * **المخرجات:** `transactionId` / `txHash` الموثق على شبكة Hedera Testnet.

---

### ب. ملفات بوابة الخدمات والـ Middleware (API Gateway - Express):

#### `services/api-gateway/src/middlewares/x402Auth.ts`
* **`x402GatedGuard(req: Request, res: Response, next: NextFunction): Promise<void>`**
  * **العملية:**
    1. يفحص وجود الترويسة `req.headers['x-402-payment-proof']`.
    2. في حال غيابها: يدعو `calculateMeteredFee(req)` ثم يرجع `res.status(402).json({ challenge: ... })`.
    3. في حال وجودها: يدعو `verifyBlocky402Proof(proofHash)` للتحقق من وصول المبلغ لبروتوكول Blocky402. إذا نجح التحقق، يمرر الطلب عبر `next()`.

#### `services/api-gateway/src/middlewares/meteredPricing.ts`
* **`calculateMeteredFee(req: Request): { hbarAmount: number, reason: string }`**
  * **العملية:** يفحص `req.body.analysisDepth`.
    * إذا كانت `BASIC`: التكلفة = `0.1 HBAR`.
    * إذا كانت `DEEP_PORTFOLIO_RAG`: التكلفة = `0.5 HBAR`.

#### `services/api-gateway/src/services/hcsLogger.ts`
* **`logToHcsConsensusTopic(data: HcsLogPayload): Promise<BigInt>`**
  * **المداخل:** `{ accountId, hbarPaid, queryType, txHash }`.
  * **العملية:** استخدام `TopicMessageSubmitTransaction` من `hashgraph/sdk` لإرسال البيانات إلى `HCS_AUDIT_TOPIC_ID` وإرجاع `SequenceNumber`.

---

### ج. ملفات محرك الذكاء الاصطناعي (Python FastAPI AI Engine):

#### `services/ai-engine/app/api/v1/reasoning.py`
* **`@app.post("/api/v1/ai/analyze-portfolio")`**
* **`async def analyze_portfolio_endpoint(request: PortfolioAnalysisRequest)`**
  * **المداخل:** `account_id` (حساب Hedera), `analysis_depth` (عمق التحليل).
  * **المخرجات:** JSON يحتوي على: `risk_score`, `portfolio_summary`, `yield_opportunities`, `recommended_actions`.
  * **الطقوس التنفيذية:**
    1. يستدعي `hedera_mirror.fetch_account_balances(account_id)`.
    2. يستدعي `rag_pipeline.query_defi_knowledge_base(portfolio_assets)`.
    3. يصيغ التقرير النهائي ويرجعه للـ API Gateway.

#### `services/ai-engine/app/core/rag_pipeline.py`
* **`query_defi_knowledge_base(assets: list) -> dict`**
  * **العملية:** إجراء بحث دلالي (Semantic Search) داخل ChromaDB لجلب أفضل الفرص المتاحة للـ Yield Farming المطابقة لأصول المستخدم مع حساب المخاطر.

---

### د. ملفات الوكيل المستهلك الأوتوماتيكي (Autonomous Consuming Agent CLI):

#### `apps/consuming-agent/src/index.ts`
* **`runAutonomousAgentWorkflow(): Promise<void>`**
  * **العملية:**
    1. استدعاء `discover.ts` للبحث عن الخدمة عبر HCS-14.
    2. إرسال طلب استعلام للـ API Gateway تلقائياً بدون مفاتيح API.
    3. التقاط استجابة `402 Payment Required`.
    4. توقيع وإرسال معاملة HBAR من محفظة الوكيل المبرمجة.
    5. إعادة إرسال الإثبات واستلام وتحليل تقرير الذكاء الاصطناعي.

---

## 6. دليل التنفيذ البرمجي خطوة بخطوة من الصفر (Step-by-Step Step-by-Step Implementation)

```text
[STEP 1: Hedera Setup] ──► [STEP 2: Vector DB & AI] ──► [STEP 3: x402 Middleware] ──► [STEP 4: Next.js UI] ──► [STEP 5: Agent CLI & Audit]
```

### 1️⃣ الخطوة الأولى: تجهيز شبكة Hedera و HCS Topics
```bash
# 1. الانتقال لمجلد المساعدة وتشغيل سكريبت إنشاء HCS Topic
cd scripts
npx ts-node create-hcs-topic.ts
# سيتم طباعة: HCS Topic Created! ID: 0.0.789012
```

### 2️⃣ الخطوة الثانية: تهيئة قاعدة البيانات ومحرك الـ RAG
```bash
# 1. إعداد قاعدة البيانات وتطبيق Prisma Migrations
cd ../services/api-gateway
npx prisma migrate dev --name init

# 2. تشغيل محرك الذكاء الاصطناعي وتكشيف بيانات الـ DeFi
cd ../ai-engine
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python app/core/rag_pipeline.py # لتكشيف ملفات الـ Vector DB
uvicorn app.main:app --reload --port 8000
```

### 3️⃣ الخطوة الثالثة: تشغيل بوابة API Gateway مع x402
```bash
cd ../api-gateway
npm install
npm run dev # يعمل على المنفذ 4000
```

### 4️⃣ الخطوة الرابعة: تشغيل الواجهة الأمامية Next.js
```bash
cd ../../apps/web
npm install
npm run dev # يعمل على المنفذ 3000
```

### 5️⃣ الخطوة الخامسة: تشغيل واختبار الوكيل المستهلك الأوتوماتيكي
```bash
cd ../consuming-agent
npm install
npm run start
```

---

🏆 **بهذا الدليل التنفيذي المكتمل، يمتلك المشروع كل مقومات التفوق التقني، الحل المالي الحقيقي، والالتزام الكامل بكافة شروط الهاكاثون والنقاط الإضافية لانتزاع المركز الأول.**
