# وثيقة المعمارية التقنية الشاملة: Major Gainz (x402 Powered AI DeFi Agent)

## 1. الفكرة العامة وكيفية حسم شروط الهاكاثون (100% Core + Extra Points)

### 💡 الفكرة العامة ورسالة المشروع:
مشروع **Major Gainz** يحل مشكلة "فجوة المعلومات والذكاء" في التمويل اللامركزي (DeFi) لمتداولي التجزئة. يقدم المشروع محرك استدلال منطقي (RAG-based AI Engine) يحلل محفظة المستخدم على الشبكة (Onchain)، ويصمم استراتيجيات إدارة مخاطر وتوزيع عائد (Yield Farming / Staking) بمستوى المؤسسات الكبرى.

### ⚡ آلية تطبيق شروط الهاكاثون (x402 Agentic Economy):
تحويل منصة Major Gainz إلى **خدمة استدلال اصطناعي مدفوعة بالطلب (x402-Gated Metered AI Inference Service)**:
1. **الخدمة المحمية بـ x402:** بدلاً من الاشتراك الشهري أو استخدام مفاتيح API، يتم تغليف الـ APIs الخاصة بالذكاء الاصطناعي (مثل `POST /api/v1/ai/analyze-portfolio` و `POST /api/v1/ai/yield-strategy`) ببروتوكول **x402**.
2. **تسوية المدفوعات الدقيقة (Micropayments):** يتم تحصيل المدفوعات برمز **HBAR** أو **HTS Tokens** عبر **Blocky402 Facilitator** بسرعة خيالية ورسوم لا تتعدى سنتات.
3. **التسعير بالطلب/الديناميكي (Metered Pay-Per-Call) [Extra Points]:** احتساب تكلفة كل الاستعلام بناءً على عمق التقييم أو عدد البروتوكولات المطلوب فحصها.
4. **تدقيق المدفوعات على الشبكة (HCS Audit Trail) [Extra Points]:** تسجيل تجزئة (Hash) كل عملية دفع واستعلام على **Hedera Consensus Service (HCS)** لإنشاء أثر مالي وفني موثق وغير قابل للتعديل.
5. **هوية واكتشاف الوكيل (Agent Identity & Discovery) [Extra Points]:** تسجيل الخدمة عبر **HCS-14 / ERC-8004** لتستطيع الوكلاء البرمجية الأخرى (Consuming Agents) اكتشاف Major Gainz والدفع له تلقائياً دون تدخل بشري.

---

## 2. معمارية النظام (System Architecture Diagram)

```
=======================================================================================================================
                                             MAJOR GAINZ SYSTEM ARCHITECTURE
=======================================================================================================================

   [ Human User / Dashboard UI ]             [ Autonomous Consuming Agent / External API ]
              │                                                     │
              │ (HTTP Request / Web3 Wallet)                         │ (x402 HTTP Request / HBAR Payment)
              ▼                                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                     API GATEWAY / x402 MIDDLEWARE LAYER                                              │
│                                            (Next.js / Node.js Express)                                              │
│                                                                                                                     │
│   ┌───────────────────────────┐      ┌───────────────────────────────┐      ┌───────────────────────────────────┐   │
│   │   x402 Interceptor Guard  │ ───► │  Dynamic Metering Calculator │ ───► │ Blocky402 Facilitator Verifier    │   │
│   └───────────────────────────┘      └───────────────────────────────┘      └───────────────────────────────────┘   │
└───────────────────────────────────────────────────┬─────────────────────────────────────────────────────────────────┘
                                                    │ (HTTP 200 OK after Paid Challenge)
                                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                           AI & RAG ENGINE (Python FastAPI)                                           │
│                                                                                                                     │
│   ┌───────────────────────────┐      ┌───────────────────────────────┐      ┌───────────────────────────────────┐   │
│   │ LangChain / LlamaIndex    │ ───► │ Vector DB (ChromaDB / Pinecone)│ ───► │ Hedera DeFi Knowledge Base        │   │
│   └───────────────────────────┘      └───────────────────────────────┘      └───────────────────────────────────┘   │
└───────────────────────────────────────────────────┬─────────────────────────────────────────────────────────────────┘
                                                    │ (Onchain Assessment & Strategy Payload)
                                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                         HEDERA NETWORK & INTEGRATION LAYER                                          │
│                                                                                                                     │
│   ┌───────────────────────────┐      ┌───────────────────────────────┐      ┌───────────────────────────────────┐   │
│   │ Hedera Mirror Node API    │      │ HCS Audit Logger (Topic)      │      │ Agent Identity (HCS-14 / HTS)     │   │
│   └───────────────────────────┘      └───────────────────────────────┘      └───────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. الهيكل التنظيمي للريبو (Monorepo Repository Architecture)

```text
major-gainz-x402/
├── .github/
│   └── workflows/
│       └── ci-cd.yml                   # أتمتة الاختبارات والرفع
├── apps/
│   ├── web/                            # Frontend (Next.js 14 App Router + Web3)
│   │   ├── src/
│   │   │   ├── app/                    # الصفحات والـ Routes
│   │   │   │   ├── layout.tsx          # التخطيط الرئيسي مع الموفرات (Providers)
│   │   │   │   ├── page.tsx            # Landing Page + Hero
│   │   │   │   ├── dashboard/          # لوحة تحكم المستخدم والـ Portfolio
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── agent-market/       # سوق الوكلاء ودليل الاكتشاف (UCP/HCS-14)
│   │   │   │   │   └── page.tsx
│   │   │   │   └── api/                # Next.js API Routes (Proxy / Middleware)
│   │   │   │       ├── x402/           # x402 Challenge & Payment Handler
│   │   │   │       │   └── route.ts
│   │   │   │       └── portfolio/      # Portfolio Fetcher
│   │   │   │           └── route.ts
│   │   │   ├── components/             # واجهات المستخدم (React Components)
│   │   │   │   ├── ui/                 # عناصر التصميم (Buttons, Cards, Modals)
│   │   │   │   ├── portfolio/          # رسوم بيانية ومؤشرات المحفظة
│   │   │   │   │   ├── PortfolioChart.tsx
│   │   │   │   │   └── RiskScoreCard.tsx
│   │   │   │   ├── x402/               # مكونات مدفوعات x402
│   │   │   │   │   ├── PaymentModal.tsx
│   │   │   │   │   └── PayPerCallBadge.tsx
│   │   │   │   └── ai/                 # مكونات تحليلات الذكاء الاصطناعي
│   │   │   │       ├── StrategyRecommend.tsx
│   │   │   │       └── ChatInterface.tsx
│   │   │   ├── lib/                    # أدوات ومكتبات واجهة المستخدم
│   │   │   │   ├── hedera-wallet.ts    # الاتصال بمحفظة HashPack / WalletConnect
│   │   │   │   ├── x402-client.ts      # العميل البرمجي لـ x402 HTTP Fetch
│   │   │   │   └── utils.ts
│   │   │   └── types/                  # TypeScript Types & Interfaces
│   │   │       ├── portfolio.ts
│   │   │       └── x402.ts
│   │   ├── package.json
│   │   └── tailwind.config.js
│   │
│   └── consuming-agent/                # الوكيل المستهلك الذاتي (Autonomous Buyer Agent)
│       ├── src/
│       │   ├── index.ts                # تشغيل السيناريو الأوتوماتيكي للدفع والطلب
│       │   ├── discover.ts             # البحث عن خدمة Major Gainz عبر HCS-14
│       │   └── x402-payer.ts           # التعامل مع رد الـ 402 وتوقيع معاملات HBAR
│       ├── package.json
│       └── tsconfig.json
│
├── services/
│   ├── api-gateway/                    # Express.js Middleware Backend
│   │   ├── src/
│   │   │   ├── middlewares/
│   │   │   │   ├── x402Auth.ts         # فحص ترويسة x402 والدفع مع Blocky402
│   │   │   │   └── meteredPricing.ts   # حساب التكلفة الديناميكية للطلب
│   │   │   ├── routes/
│   │   │   │   ├── ai.ts               # حماية APIs الذكاء الاصطناعي
│   │   │   │   └── hcsLogs.ts          # قراءة سجلات التدقيق
│   │   │   ├── services/
│   │   │   │   ├── blocky402.ts        # التواصل مع Blocky402 Facilitator
│   │   │   │   └── hcsLogger.ts        # كتابة المعاملات في Hedera Consensus Topic
│   │   │   └── server.ts
│   │   └── package.json
│   │
│   └── ai-engine/                      # Python FastAPI RAG Engine
│       ├── app/
│       │   ├── main.py                 # FastAPI Application Server
│       │   ├── api/
│       │   │   └── v1/
│       │   │       ├── reasoning.py    # RAG Analytical Endpoint
│       │   │       └── yield.py        # Yield & Staking Strategy Generator
│       │   ├── core/
│       │   │   ├── config.py           # إعدادات البيئة وتوليد المفاتيح
│       │   │   └── rag_pipeline.py     # LlamaIndex / LangChain RAG Setup
│       │   ├── services/
│       │   │   ├── hedera_mirror.py    # جلب بيانات الحسابات والمحافظ من Hedera
│       │   │   └── defi_protocols.py   # أسعار وسيولة SaucerSwap / Bonzo Finance
│       │   └── vector_store/           # تخزين وتكشيف المعرفة
│       │       └── docs/               # قواعد المعرفة للـ DeFi Risk & Yield
│       ├── requirements.txt
│       └── Dockerfile
│
├── packages/
│   └── x402-hedera-sdk/                # SDK مشترك بين الخدمات لبروتوكول x402
│       ├── src/
│       │   ├── header.ts               # تشكيل وتفكيك Header 402 / Authorization
│       │   ├── blocky.ts               # الواجهة البرمجية لتسوية Blocky402
│       │   └── hcs-audit.ts            # تسجيل تجزئة الطلبات في HCS
│       └── package.json
│
├── scripts/
│   ├── create-hcs-topic.ts             # إنشاء Hedera Consensus Topic لسجلات التدقيق
│   ├── register-agent-hcs14.ts         # تسجيل هوية الوكيل بدليل HCS-14
│   └── mint-hts-agent-tokens.ts        # إنشاء رموز HTS المخصصة للحوافز
│
├── .env.example                        # نموذج المتغيرات البيئية
├── docker-compose.yml                  # تشغيل جميع الخدمات معاً
├── README.md                           # التوثيق والتشغيل
└── package.json                        # Root Monorepo Package Settings
```

---

## 4. تفاصيل المكونات والملفات والوظائف الرئيسية (Functions & API Contracts)

### أ. محرك الذكاء الاصطناعي (`services/ai-engine`)
* **`app/api/v1/reasoning.py`**:
  * **Function:** `analyze_portfolio_risk(account_id: str, depth: str)`
  * **الوظيفة:** يستقبل معرف حساب Hedera، يجلب الأصول عبر `hedera_mirror.py`، ويمررها لمحرك الـ RAG لحساب مستوى المخاطرة وتوليد التتقرير المالي.
* **`app/core/rag_pipeline.py`**:
  * **Function:** `generate_contextual_strategy(portfolio_data: dict)`
  * **الوظيفة:** دمج بيانات المحفظة مع قواعد المعرفة للـ DeFi على Hedera لتقديم توصيات إقراض وتداول أوتوماتيكية.

### ب. بوابة بوابات x402 والمدفوعات (`services/api-gateway`)
* **`src/middlewares/meteredPricing.ts`**:
  * **Function:** `calculateCallFee(req: Request): { amountInHbar: number, tokenSymbol: string }`
  * **الوظيفة:** فحص نص الطلب (Request Body)؛ إذا طلب المستخدم تحليلاً بسيطاً يُحتسب `0.1 HBAR`، وإذا طلب تحليلاً عميقاً لكافة شبكات الـ DeFi يُحتسب `0.5 HBAR` (**Metered Pay-Per-Call**).
* **`src/middlewares/x402Auth.ts`**:
  * **Function:** `x402GatedGuard(req, res, next)`
  * **الوظيفة:**
    1. يفحص وجود الترويسة `X-402-Payment-Proof`.
    2. في حال عدم وجودها، يرجع كود الاستجابة `402 Payment Required` مع محتوى التحدي (Challenge): المبلغ المطلوب، عنوان المستلم، ومعرف تسوية Blocky402.
    3. عند إرسال الإثبات، يتأكد من صحته عبر `blocky402.ts` ويمرر الطلب للـ AI Engine.
* **`src/services/hcsLogger.ts`**:
  * **Function:** `logTransactionToHCS(account: str, feePaid: number, status: str)`
  * **الوظيفة:** إرسال رسالة تشمل (مُعرف الحساب، المبلغ المدفوع بـ HBAR، وتجزئة التتقرير) إلى **Hedera Consensus Service Topic ID** للتدقيق المالي غير القابل للتزوير.

### ج. الوكيل المستهلك الأوتوماتيكي (`apps/consuming-agent`)
* **`src/discover.ts`**:
  * **Function:** `findMajorGainzAgent(): Promise<{ endpoint: string, hcsTopic: string }>`
  * **الوظيفة:** استعلام دليل **HCS-14** على Hedera لجلب عنوان API الخاص بـ Major Gainz بدون ضبط يدوي.
* **`src/x402-payer.ts`**:
  * **Function:** `executePaidInferenceCall(endpoint: string, payload: object)`
  * **الوظيفة:** إرسال طلب استعلام -> استقبال استجابة `402` -> توقيع وإرسال معاملة **HBAR Transfer** سريعة عبر **Blocky402** -> إعادة إرسال الإثبات واستلام النتيجة المباشرة.

---

## 5. مخططات تدفق البيانات (Flowcharts & User Scenarios)

### السيناريو الأول: استعلام الوكيل البرمجي الأوتوماتيكي (Agent-to-Agent - x402 Flow)

```
[Consuming Agent]             [Major Gainz API Gateway]         [Blocky402 / Hedera]           [AI RAG Engine]
        │                                 │                               │                           │
        │─── 1. POST /api/v1/ai/analyze ─►│                               │                           │
        │                                 │                               │                           │
        │◄── 2. HTTP 402 Required ────────│                               │                           │
        │    (Price: 0.2 HBAR + Challenge)│                               │                           │
        │                                 │                               │                           │
        │─── 3. Submit HBAR Micro-Tx ────────────────────────────────────►│                           │
        │                                 │                               │                           │
        │◄── 4. Return Payment Proof (Tx Hash) ───────────────────────────│                           │
        │                                 │                               │                           │
        │─── 5. Re-send Request with ────►│                               │                           │
        │    X-402-Payment-Proof          │                               │                           │
        │                                 │─── 6. Verify Proof ──────────►│                           │
        │                                 │◄── 7. Proof Validated ────────│                           │
        │                                 │                               │                           │
        │                                 │─── 8. Execute Pay-per-call AI Inference ─────────────────►│
        │                                 │◄── 9. Return Portfolio Strategy Payload ─────────────────│
        │                                 │                               │                           │
        │                                 │─── 10. Write Audit Trail Log to HCS Topic ───────────────►│
        │                                 │                               │                           │
        │◄── 11. Final AI Response (200) ─│                               │                           │
```

---

### السيناريو الثاني: رحلة المستخدم عبر واجهة التحكم (Human User Flow)

```
 [User] ──► [Connect HashPack/Wallet] ──► [Select Portfolio Analysis Depth]
                                                  │
                                                  ▼
                                      [Click "Run AI Strategy"]
                                                  │
                                                  ▼
                                 [System Triggers x402 Modal]
                                                  │
                                                  ▼
                               [User Approves ~0.2 HBAR Micro-Tx]
                                                  │
                                                  ▼
                                  [Hedera Sub-second Settlement]
                                                  │
                                                  ▼
                         [Dashboard Renders Instant Strategy & Risk Score]
                                                  │
                                                  ▼
                                   [Transaction Hash Logged to HCS]
```

---

## 6. نموذج ملف المتغيرات البيئية (`.env.example`)

```env
# ===============================================
# HEDERA NETWORK CONFIGURATION
# ===============================================
HEDERA_NETWORK=testnet
HEDERA_OPERATOR_ID=0.0.123456
HEDERA_OPERATOR_KEY=302e020100300506072a8648ce3d020106052b8104000a03420002...
HEDERA_MIRROR_NODE_URL=https://testnet.mirrornode.hedera.com

# ===============================================
# HEDERA SERVICES (HCS & HTS)
# ===============================================
HCS_AUDIT_TOPIC_ID=0.0.789012
AGENT_HCS14_REGISTRY_TOPIC=0.0.345678
HTS_FEE_TOKEN_ID=0.0.901234

# ===============================================
# x402 & BLOCKY402 FACILITATOR CONFIG
# ===============================================
BLOCKY402_FACILITATOR_URL=https://testnet.blocky402.com/api/v1
PAYMENT_RECIPIENT_HEDERA_ID=0.0.123456
X402_SECRET_KEY=super_secret_x402_hmac_key_for_proof_validation

# ===============================================
# AI ENGINE CONFIGURATION
# ===============================================
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxx
FASTAPI_AI_ENGINE_URL=http://localhost:8000
VECTOR_DB_PATH=./services/ai-engine/app/vector_store/data

# ===============================================
# API GATEWAY CONFIGURATION
# ===============================================
PORT=4000
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000
```

---

## 7. دليل وخطوات التنفيذ البرمجي خطوة بخطوة (Implementation Roadmap)

1. **المرحلة 1: تجهيز بنية Hedera و HCS (اليوم 1)** — إنشاء Consensus Topic وتسجيل الوكيل بدليل HCS-14.
2. **المرحلة 2: بناء محرك الذكاء الاصطناعي RAG Engine (اليوم 1-2)** — تطوير FastAPI وتوصيل Hedera Mirror Node.
3. **المرحلة 3: بناء بوابة x402 وحساب التكلفة الديناميكية (اليوم 2-3)** — تفعيل Blocky402 وتوثيق العمليات بـ HCS.
4. **المرحلة 4: تطوير الواجهة الأمامية والوكيل المستهلك (اليوم 3-4)** — واجهة Next.js وسكريبت Consuming Agent.
5. **المرحلة 5: التوثيق والفيديو التجريبي (اليوم 5)** — إعداد الريبو وفيديو الـ Demo بنقاط التقييم الكاملة.
