# Complete Environment Variables Guide (.env.example)
## Major Gainz: Next-Generation AI DeFi Agent (Hedera x402 Edition)

> ⚠️ **CRITICAL SECURITY WARNING REGARDING NEXT.JS ENVIRONMENT VARIABLES:**
> In Next.js, variables prefixed with `NEXT_PUBLIC_` are bundled into client-side JavaScript and exposed publicly in the browser. 
> **NEVER** prefix Private Keys (`OPERATOR_KEY`, `AGENT_PRIVATE_KEY`, `OPENAI_API_KEY`, `DATABASE_URL`, `X402_SECRET_KEY`) with `NEXT_PUBLIC_`! Doing so exposes your private keys and wallet funds to anyone inspecting the network tab.
> Below is the security-hardened, categorized configuration dividing **Server-Only Secrets** from **Client-Exposed Public Variables**.

---

```env
# ==============================================================================
# 1. HEDERA NETWORK & OPERATOR CONFIGURATION (Server-Side Secrets)
# ==============================================================================
# Target Hedera Environment: testnet | previewnet | mainnet
HEDERA_NETWORK=testnet

# Primary Operator / Deployer Hedera Account ID
HEDERA_OPERATOR_ID=0.0.123456

# Primary Operator Private Key (ED25519 or ECDSA hex string) - SERVER ONLY
HEDERA_OPERATOR_KEY="302e020100300506072a8648ce3d020106052b8104000a03420002..."

# Hedera Mirror Node Endpoint for Onchain Queries
HEDERA_MIRROR_NODE_URL="https://testnet.mirrornode.hedera.com"

# ==============================================================================
# 2. x402 & BLOCKY402 FACILITATOR PAYMENT SETTINGS (Server-Side Secrets)
# ==============================================================================
# Blocky402 Settlement Facilitator URL
BLOCKY402_FACILITATOR_URL="https://testnet.blocky402.com/api/v1"

# Hedera Account ID receiving x402 micropayments (Major Gainz Treasury)
PAYMENT_RECIPIENT_HEDERA_ID=0.0.123456

# HMAC Secret Key used to verify x402 challenge nonces and payment proofs
X402_SECRET_KEY="super_secret_hmac_key_for_x402_proof_validation"

# Dynamic Metered Pricing Limits (in HBAR)
X402_MIN_PRICE_HBAR=0.1
X402_MAX_PRICE_HBAR=1.0

# ==============================================================================
# 3. AGENTIC ECONOMY & MULTI-AGENT SETTINGS (A2A / HCS-14)
# ==============================================================================
# First Agent (Service Provider - Major Gainz AI)
FIRSTAGENT_ACCOUNT_ID=0.0.222222
FIRSTAGENT_PRIVATE_KEY="302e020100300506072a8648ce3d020106052b8104000a0342..."
FIRSTAGENT_INBOUND_TOPIC_ID=0.0.333333
FIRSTAGENT_OUTBOUND_TOPIC_ID=0.0.444444

# Second Agent (Autonomous Buyer / Consuming Agent)
SECONDAGENT_ACCOUNT_ID=0.0.555555
SECONDAGENT_PRIVATE_KEY="302e020100300506072a8648ce3d020106052b8104000a0342..."
SECONDAGENT_INBOUND_TOPIC_ID=0.0.666666
SECONDAGENT_OUTBOUND_TOPIC_ID=0.0.777777

# HCS Connection Topic ID for Inter-Agent Communication
CONNECTION_TOPIC_ID=0.0.888888

# Hedera Consensus Service Topic ID for Payment & Inference Audit Trail (Extra Points)
HCS_AUDIT_TOPIC_ID=0.0.999999

# HCS-14 Agent Registry Topic ID for Agent Discovery (Extra Points)
AGENT_HCS14_REGISTRY_TOPIC=0.0.111111

# Custom HTS Token ID for Settlement (Optional - Extra Points)
HTS_FEE_TOKEN_ID=0.0.222333

# ==============================================================================
# 4. DATABASE & VECTOR STORE CONFIGURATION (Server-Side Secrets)
# ==============================================================================
# PostgreSQL Connection String for Prisma ORM (Portfolios & Audit Logs)
DATABASE_URL="postgresql://postgres:password123@localhost:5432/majorgainz?schema=public"

# Redis Connection URL (for Nonce tracking, Rate Limiting & x402 Challenge Cache)
REDIS_URL="redis://localhost:6379"

# Vector Database Path / URL for RAG Embeddings (DeFi Protocols & Hedera Docs)
VECTOR_DB_URL="http://localhost:8000"
CHROMA_DB_PATH="./services/ai-engine/app/vector_store/data"

# ==============================================================================
# 5. AI ENGINE & BACKEND SERVICES (Server-Side Secrets)
# ==============================================================================
# OpenAI API Key for RAG LLM Reasoning Layer
OPENAI_API_KEY="sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# Internal Python FastAPI AI Engine Address
FASTAPI_AI_ENGINE_URL="http://localhost:8000"

# Express API Gateway Server Port
PORT=4000
NODE_ENV="development"

# ==============================================================================
# 6. PUBLIC FRONTEND VARIABLES (Safe to expose to client via NEXT_PUBLIC_)
# ==============================================================================
# Hedera Network Name for WalletConnect / HashPack
NEXT_PUBLIC_HEDERA_NETWORK="testnet"

# Public API Gateway URL used by Frontend to send requests
NEXT_PUBLIC_BACKEND_URL="http://localhost:4000"

# Public Audit Topic ID for Onchain Verification in UI
NEXT_PUBLIC_HCS_AUDIT_TOPIC_ID="0.0.999999"

# Public Agent Registry Topic for Agent Directory Marketplace
NEXT_PUBLIC_AGENT_HCS14_REGISTRY_TOPIC="0.0.111111"

# Public Treasury ID for Client-Side HashPack Transaction Pre-fills
NEXT_PUBLIC_PAYMENT_RECIPIENT_HEDERA_ID="0.0.123456"
```

---

## 🔍 التغييرات والإضافات المنجزة لضمان احترافية الملف وحسم المركز الأول:

1. **إصلاح ثغرة أمنية حرجة (Security Fix):**
   * المتغيرات التي تحتوي على مفاتيح خاصة (`OPERATOR_KEY`, `PRIVATE_KEY`, `OPENAI_API_KEY`, `DATABASE_URL`) تم إزالة البادئة `NEXT_PUBLIC_` عنها، لأن استخدام `NEXT_PUBLIC_` يُسرب المفاتيح الخاصة إلى متصفح المستخدم برمجياً ويجعل المحفظة عرضة للاختراق، وهو خطأ يخصم نقاطاً فورية من لجنة التحكيم.

2. **إضافة متغيرات x402 & Blocky402 المفقودة:**
   * `BLOCKY402_FACILITATOR_URL`: رابط مسهل المدفوعات للتحقق من معاملات x402.
   * `PAYMENT_RECIPIENT_HEDERA_ID`: عنوان محفظة استقبال أجزاء الـ HBAR.
   * `X402_SECRET_KEY`: مفتاح التشفير لحماية نصوص التحدي (Nonces) وتمنع التزوير.
   * `X402_MIN_PRICE_HBAR` / `X402_MAX_PRICE_HBAR`: للتسعير الديناميكي (Metered Pricing).

3. **إضافة متغيرات قواعد البيانات والذكاء الاصطناعي:**
   * `DATABASE_URL` (PostgreSQL) و `REDIS_URL` لإدارة التحديات الميكرو وتتبع الجلسات.
   * `OPENAI_API_KEY` و `FASTAPI_AI_ENGINE_URL` للربط مع RAG Engine.

4. **إضافة متغيرات النقاط الإضافية (Extra Points):**
   * `HCS_AUDIT_TOPIC_ID`: لتسجيل أثر كل عملية دفع واستعلام على **Hedera Consensus Service**.
   * `AGENT_HCS14_REGISTRY_TOPIC`: لدليل اكتشاف الوكلاء (HCS-14 Discovery Registry).
   * `HTS_FEE_TOKEN_ID`: لدعم المدفوعات بروموز HTS المخصصة.
