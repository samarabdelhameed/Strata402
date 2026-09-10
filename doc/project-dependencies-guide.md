# 📦 الدليل الشامل لمكتبات وحزم المشروع (Project Dependencies Guide)

هذا الدليل يحدد كافة المكتبات والحزم (Dependencies) لجميع أجزاء مشروع **Major Gainz** المنظم بنظام **Bun Monorepo**، شاملاً الواجهة الأمامية، بوابة x402، العقود الذكية بـ Solidity، محرك الذكاء الاصطناعي، والوكيل المستهلك.

---

## 1. هل شبكة Hedera تدعم Solidity؟

**نعم، 100%!** 
شبكة **Hedera متوافقة تماماً مع الـ EVM (EVM Compatible)** عبر خدمة **Hedera Smart Contract Service (HSCS)**.
* يمكنك كتابة عقود ذكية بلغة **Solidity** وتطويرها باستخدام أدوات **Hardhat** أو **Foundry**.
* نشر العقود يتم مباشرة على **Hedera Testnet / Mainnet** مع الاستفادة من سرعة الشبكة العالية ورسومها الزهيدة جداً والثابتة.
* يمكنك التفاعل مع العقود باستخدام مكتبات Web3 القياسية مثل `viem` أو `ethers.js` أو عبر `@hashgraph/sdk`.

---

## 2. الهيكل العام للـ Stack في المشروع

* **Package Manager & Runtime:** `Bun` (لسرعة التشغيل المذهلة وإدارة المونوريبو).
* **Frontend:** `Next.js 14 (App Router)`, `TypeScript`, `TailwindCSS`, `Framer Motion`, `Recharts`.
* **Smart Contracts:** `Solidity (^0.8.20)`, `Hardhat`, `OpenZeppelin Contracts`.
* **Hedera & Web3:** `@hashgraph/sdk`, `viem`, `@privy-io/react-auth`, `@ensdomains/ensjs`.
* **x402 & Agentic Payments:** `@blocky402/sdk` (أو برمجية x402 الوسيطة).
* **Partner Integrations:** `graphql` (The Graph), `1inch API`, `@chainlink/contracts`.
* **AI Engine (Python):** `FastAPI`, `LlamaIndex`, `LangChain`, `ChromaDB`.

---

## 3. ملفات الـ Dependencies لكل مجلد في المشروع

### أ. Root Monorepo (`package.json`)
```json
{
  "name": "major-gainz-x402-monorepo",
  "private": true,
  "workspaces": [
    "apps/*",
    "services/*",
    "packages/*",
    "contracts"
  ],
  "scripts": {
    "dev": "bun run --parallel dev",
    "build": "bun run --filter '*' build",
    "test": "bun test",
    "contracts:compile": "cd contracts && bunx hardhat compile",
    "contracts:deploy": "cd contracts && bunx hardhat run scripts/deploy.ts --network hederaTestnet"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "@types/node": "^20.11.0"
  }
}
```

---

### ب. العقود الذكية (`contracts/package.json`)
```json
{
  "name": "@major-gainz/contracts",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "compile": "hardhat compile",
    "deploy:testnet": "hardhat run scripts/deploy.ts --network hederaTestnet"
  },
  "devDependencies": {
    "@nomicfoundation/hardhat-toolbox": "^4.0.0",
    "@openzeppelin/contracts": "^5.0.1",
    "@chainlink/contracts": "^0.8.0",
    "hardhat": "^2.20.0",
    "typescript": "^5.4.0"
  }
}
```

---

### ج. الواجهة الأمامية (`apps/web/package.json`)
```json
{
  "name": "@major-gainz/web",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "14.1.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "typescript": "^5.4.0",
    "tailwindcss": "^3.4.1",
    "autoprefixer": "^10.4.17",
    "postcss": "^8.4.35",
    "lucide-react": "^0.330.0",
    "framer-motion": "^11.0.5",
    "recharts": "^2.12.0",
    "@hashgraph/sdk": "^2.40.0",
    "@privy-io/react-auth": "^1.55.0",
    "viem": "^2.7.9",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.1"
  },
  "devDependencies": {
    "@types/react": "^18.2.55",
    "@types/node": "^20.11.0"
  }
}
```

---

### د. بوابة x402 والـ Backend (`services/api-gateway/package.json`)
```json
{
  "name": "@major-gainz/api-gateway",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "bun --watch src/server.ts",
    "build": "bun build src/server.ts --outdir dist"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dotenv": "^16.4.4",
    "@hashgraph/sdk": "^2.40.0",
    "@prisma/client": "^5.10.0",
    "ioredis": "^5.3.2",
    "axios": "^1.6.7",
    "graphql": "^16.8.1",
    "graphql-request": "^6.1.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.17",
    "prisma": "^5.10.0",
    "typescript": "^5.4.0"
  }
}
```

---

### هـ. الوكيل المستهلك (`apps/consuming-agent/package.json`)
```json
{
  "name": "@major-gainz/consuming-agent",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "start": "bun run src/index.ts"
  },
  "dependencies": {
    "@hashgraph/sdk": "^2.40.0",
    "axios": "^1.6.7",
    "dotenv": "^16.4.4"
  }
}
```

---

### و. محرك الذكاء الاصطناعي Python RAG (`services/ai-engine/requirements.txt`)
```text
fastapi==0.109.2
uvicorn[standard]==0.27.1
pydantic==2.6.1
python-dotenv==1.0.1
httpx==0.26.0
langchain==0.1.7
llama-index==0.10.3
chromadb==0.4.22
openai==1.12.0
web3==6.15.0
requests==2.31.0
```
