# Strata402 ai-engine

Deterministic risk engine over real Hedera Mirror Node data, served as a Python
FastAPI service. The paid x402 wall lives on the API gateway; this service owns
the analysis and (post-verification) AI narration.

## What it does

- `POST /v1/strategy/yield-risk` — validates the shared yield-risk contract
  (`accountId`, `riskTolerance`, `amountHbar`) BEFORE any mirror read,
  returning HTTP 400 with a machine-readable body on violation.
- Reads real Hedera Mirror Node facts (account existence, balance, 30-day Hbar
  throughput) read-only via `app/services/hedera_mirror.py`.
- `app/services/risk_engine.py` builds a deterministic narrative from those
  facts only. No `riskScore` / `confidence` numbers are invented; protocol
  liquidity and smart-contract risk are explicitly `unavailable`.
- If the mirror read fails, the response degrades honestly
  (`dataUnavailable: true`) instead of fabricating numbers.
- LLM narration is a hook that only runs when `LLM_PROVIDER`/`LLM_MODEL`/
  `LLM_API_KEY` are all set — the deterministic path never depends on it.

## Run

```bash
cd services/ai-engine
uv venv --python 3.13 && source .venv/bin/activate
uv pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Test

```bash
cd services/ai-engine
source .venv/bin/activate
python -m pytest
```

Tests are in-process (no network); live reads are covered by the gateway
integration path against the public testnet mirror.

## Env

| Var | Default | Used for |
| :-- | :-- | :-- |
| `STRATA402_MIRROR_BASE_URL` | `https://testnet.mirrornode.hedera.com` | mirror reads |
| `STRATA402_NETWORK` | `hedera:testnet` | network label |
| `LLM_PROVIDER` / `LLM_MODEL` / `LLM_API_KEY` | empty | optional LLM narration hook (off) |