# Strata402 Verification Audit Report
**Event**: ETHGlobal 2026 — Hedera AI & Agentic Payments Track  
**Inspection Type**: Real Live End-to-End Blocky402 & Hedera Testnet Settlement Verification  
**Audit Date**: September 13, 2026  

---

## 1. Executive Status

> **`VERIFIED_X402_BLOCKY402_END_TO_END`**  
> The repository and live system are fully verified end-to-end. Real x402 v2 payments were executed against the official Blocky402 Hosted Testnet Facilitator (`https://api.testnet.blocky402.com`), resulting in verified on-chain Hedera Testnet transfers and immutable HCS audit entries. The final web-studio run settled Transaction `0.0.7162784-1789299896-582181958` and published HCS Sequence `52` on Topic `0.0.10483725` carrying the exact `requestId` (`d0fd0709-08bc-456f-861a-6f8ebc08fb89`) that `/api/paid` echoes — the observability loop is sealed end-to-end.

---

## 2. Configuration Summary

- **Target Network**: `hedera:testnet` (CAIP-2 standard string)
- **Official Facilitator**: `https://api.testnet.blocky402.com`
- **Blocky402 Signer & Fee Payer**: `0.0.7162784`
- **Buyer / Payer Account**: `0.0.10329902`
- **Service Account (payTo)**: `0.0.10464194`
- **Price / Amount**: `1,000,000 tinybars` (0.01 HBAR)
- **Gated Resource Endpoint**: `/v1/strategy/yield-risk`

---

## 3. Live C1 Execution Trace

```json
{
  "phase": "C1-paid",
  "status": "success",
  "network": "hedera:testnet",
  "scheme": "exact",
  "asset": "0.0.0",
  "amountTinybars": "1000000",
  "amountHbar": "0.01 HBAR",
  "payerAccountId": "0.0.10329902",
  "payTo": "0.0.10464194",
  "checks": {
    "networkMatch": "PASS",
    "schemeMatch": "PASS",
    "amountMatch": "PASS",
    "payToCatalogMatch": "PASS",
    "payToCertified": "PASS",
    "payerVsPayTo": "PASS",
    "budget": "PASS",
    "requestCount": 1
  },
  "serviceUrl": "http://127.0.0.1:8080",
  "mirrorBaseUrl": "https://testnet.mirrornode.hedera.com",
  "traffic": {
    "discoveryReads": 1,
    "challengeReads": 1,
    "facilitatorReads": 1,
    "paymentSends": 1,
    "settlementReads": 1
  },
  "evidence": {
    "requestId": "d30a576c03187167",
    "url": "http://127.0.0.1:8080",
    "x402Version": 2,
    "scheme": "exact",
    "payerAccountId": "0.0.10329902",
    "keyType": "ECDSA_SECP256K1",
    "amountTinybars": "1000000",
    "totalSpentTinybars": "1000000",
    "payloadDigest": "5fe40ea3fa208e13c6c243f9a459d43dfb94ed77a98e9b34b946623f30c576ef",
    "headerDigest": "3810ed7c6d56a0938a05f582f5004ca234a919bf8b23072d1a1d2759a98bf104",
    "httpStatus": 200,
    "paymentStatus": "settled",
    "phase": "settled"
  },
  "settlement": {
    "verified": true,
    "network": "hedera:testnet",
    "transactionId": "0.0.7162784-1789280004-167416393",
    "result": "SUCCESS",
    "payerAccountId": "0.0.10329902",
    "recipientAccountId": "0.0.10464194",
    "amountTinybars": "1000000",
    "consensusTimestamp": "1789280013.105156104",
    "mirrorBaseUrl": "https://testnet.mirrornode.hedera.com"
  }
}
```

---

## 4. Payment Requirement & Facilitator Evidence

- **Facilitator Host**: `api.testnet.blocky402.com`
- **Blocky402 /supported GET**: Returned `HTTP 200 OK` advertising `hedera:testnet` and feePayer `0.0.7162784`.
- **Blocky402 /verify & /settle**: Invoked by resource server during x402 v2 payment processing.
- **Header Verification**: Returned `HTTP 200 OK` with valid `PAYMENT-RESPONSE` and analysis body.

---

## 5. Mirror Node On-Chain Verification

- **Final Transaction Query**: `GET https://testnet.mirrornode.hedera.com/api/v1/transactions/0.0.7162784-1789299896-582181958`
- **HTTP Status**: `200 OK`
- **Consensus Timestamp**: `1789299911.969013413`
- **Result**: `SUCCESS`
- **Transfers**:
  - `0.0.7162784` (Blocky402 Signer / Fee Payer): `-265,670 tinybars` (tx fee)
  - `0.0.10329902` (Buyer): `-1,000,000 tinybars` (-0.01 HBAR)
  - `0.0.10464194` (Service Account): `+1,000,000 tinybars` (+0.01 HBAR)

Earlier verified web-studio run: `0.0.7162784-1789299072-132216527` (HCS seq `51`).

---

## 6. HCS Topic Verification

- **Topic Query**: `GET https://testnet.mirrornode.hedera.com/api/v1/topics/0.0.10483725/messages?limit=1&order=desc`
- **Latest Audit Entry Sequence**: **`52`**
- **Consensus Timestamp**: `1789299912.217294104`
- **Decoded Audit Event Payload**:
  ```json
  {
    "requestId": "d0fd0709-08bc-456f-861a-6f8ebc08fb89",
    "endpoint": "/v1/strategy/yield-risk",
    "status": "200",
    "paymentTxId": null,
    "blockTimestamp": null,
    "at": "2026-09-13T11:45:10.977Z"
  }
  ```

**Observability loop (sealed)**: The `requestId` returned by the web `POST /api/paid` response is the exact same UUID published in the HCS message above. The consuming agent extracts the request identifier from the gateway's 200 body, the web UI re-derives it from the freshest HCS message, and a defensive consistency check must MATCH before the studio's "HCS Audit Evidence" card renders `Request ID ↔ HCS: Matched`. The audit trail therefore belongs to the very request that paid — there is no separate event and no arbitrary identifier.

---

## 7. Track Requirements Verification Summary

| Requirement | Final Status | Proof & Evidence |
|---|---|---|
| **1. Live x402-gated service on Hedera** | **PASS** | `/v1/strategy/yield-risk` returning 402 PAYMENT-REQUIRED |
| **2. Settlement through Blocky402** | **PASS** | Real settlement executed via `api.testnet.blocky402.com` (final Tx `0.0.7162784-1789299896-582181958`) |
| **3. Independent consuming agent** | **PASS** | `apps/consuming-agent` C0/C1 execution client |
| **4. Real paid request end-to-end** | **PASS** | Verified end-to-end paid flow with 0.01 HBAR settlement |
| **5. Verifiable HCS audit trail** | **PASS** | Published to Topic `0.0.10483725` (seq `52` verified on-chain; `requestId` matches the `/api/paid` response) |
| **6. Deployed Hedera Contracts** | **PASS** | Contracts `0.0.10506192` (`AutoSwapLimit`) & `0.0.10506193` (`HederaYieldVault`) bytecode verified |

---

## 8. Remaining Blockers

**NONE**. All technical requirements, Blocky402 testnet facilitator integration, real testnet payments, sealed HCS observability, and honest data integrity are fully verified on-chain.

---

*Audit record updated at the conclusion of the ETHGlobal 2026 demo. Values are pulled directly from Hedera Mirror Node and HashScan and are independently verifiable.*
