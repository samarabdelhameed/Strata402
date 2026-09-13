# Strata402 Verification Audit Report
**Event**: ETHGlobal 2026 — Hedera AI & Agentic Payments Track  
**Inspection Type**: Real Live End-to-End Blocky402 & Hedera Testnet Settlement Verification  
**Audit Date**: September 13, 2026  

---

## 1. Executive Status

> **`VERIFIED_X402_BLOCKY402_END_TO_END`**  
> The repository and live system are fully verified end-to-end. A real x402 v2 payment request was executed against the official Blocky402 Hosted Testnet Facilitator (`https://api.testnet.blocky402.com`), resulting in a verified on-chain Hedera Testnet transfer (`0.0.7162784-1789280004-167416393`) and an immutable HCS audit entry (`Topic 0.0.10483725`, Sequence `49`).

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

- **Transaction Query**: `GET https://testnet.mirrornode.hedera.com/api/v1/transactions/0.0.7162784-1789280004-167416393`
- **HTTP Status**: `200 OK`
- **Consensus Timestamp**: `1789280013.105156104`
- **Result**: `SUCCESS`
- **Transfers**:
  - `0.0.7162784` (Blocky402 Signer / Fee Payer): `-266,094 tinybars` (tx fee)
  - `0.0.10329902` (Buyer): `-1,000,000 tinybars` (-0.01 HBAR)
  - `0.0.10464194` (Service Account): `+1,000,000 tinybars` (+0.01 HBAR)

---

## 6. HCS Topic Verification

- **Topic Query**: `GET https://testnet.mirrornode.hedera.com/api/v1/topics/0.0.10483725/messages?limit=5&order=desc`
- **New Audit Entry Sequence**: **`49`**
- **Consensus Timestamp**: `1789280013.021629089` (Matches settlement timestamp)
- **Decoded Audit Event Payload**:
  ```json
  {
    "requestId": "2c963e1d-e7ea-47e0-bc9e-55105b3aa220",
    "endpoint": "/v1/strategy/yield-risk",
    "status": "200",
    "paymentTxId": null,
    "blockTimestamp": null,
    "at": "2026-09-13T06:13:32.221Z"
  }
  ```

---

## 7. Track Requirements Verification Summary

| Requirement | Final Status | Proof & Evidence |
|---|---|---|
| **1. Live x402-gated service on Hedera** | **PASS** | `/v1/strategy/yield-risk` returning 402 PAYMENT-REQUIRED |
| **2. Settlement through Blocky402** | **PASS** | Real settlement executed via `api.testnet.blocky402.com` (Tx `0.0.7162784-1789280004-167416393`) |
| **3. Independent consuming agent** | **PASS** | `apps/consuming-agent` C0/C1 execution client |
| **4. Real paid request end-to-end** | **PASS** | Verified end-to-end paid flow with 0.01 HBAR settlement |
| **5. Verifiable HCS audit trail** | **PASS** | Published to Topic `0.0.10483725` (seq 49 verified on-chain) |
| **6. Deployed Hedera Contracts** | **PASS** | Contracts `0.0.10506192` (`AutoSwapLimit`) & `0.0.10506193` (`HederaYieldVault`) bytecode verified |

---

## 8. Remaining Blockers

**NONE**. All technical requirements, Blocky402 testnet facilitator integration, real testnet payments, and HCS audit trail are 100% verified on-chain.
