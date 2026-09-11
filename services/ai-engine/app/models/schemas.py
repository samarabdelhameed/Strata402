"""Strata402 ai-engine — pydantic request/response schemas.

Mirrors the shared yield-risk contract already implemented in the gateway
(TypeScript): validate `accountId`, `riskTolerance`, and `amountHbar` BEFORE
any mirror read, with the exact same failure semantics.
"""

from __future__ import annotations

import re
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator

ACCOUNT_ID_PATTERN = re.compile(r"^\d{1,20}\.\d{1,20}\.\d{1,20}$")
MAX_ANALYSIS_AMOUNT_HBAR = 1_000_000.0
TINYBARS_PER_HBAR = 100_000_000

RiskTolerance = Literal["conservative", "balanced", "aggressive"]


class YieldRiskRequest(BaseModel):
    accountId: str
    riskTolerance: RiskTolerance
    amountHbar: float = Field(gt=0, le=MAX_ANALYSIS_AMOUNT_HBAR)

    @field_validator("accountId")
    @classmethod
    def _valid_account(cls, value: str) -> str:
        value = value.strip()
        if not ACCOUNT_ID_PATTERN.match(value):
            raise ValueError("accountId must match shard.realm.num")
        return value

    @field_validator("amountHbar")
    @classmethod
    def _safe_precision(cls, value: float) -> float:
        if not (0 < value <= MAX_ANALYSIS_AMOUNT_HBAR):
            raise ValueError("amountHbar out of range")
        scaled = value * TINYBARS_PER_HBAR
        rounded = float(int(scaled))
        if abs(scaled - rounded) > 1e-6:
            raise ValueError("amountHbar precision is unsafe (tinybar loss > 1e-6)")
        return value


class YieldRiskBadRequest(BaseModel):
    status: Literal["error"]
    code: Literal["invalid_request_contract"]
    message: str
    issues: list[str]


class AccountObserved(BaseModel):
    accountId: str
    exists: bool
    deleted: bool
    createdTimestamp: str | None = None


class BalanceObserved(BaseModel):
    tinybars: str
    hbar: str
    timestamp: str | None = None
    tokenBalancesCount: int = 0


class Recent30dObserved(BaseModel):
    transactionCount: int = 0
    hbarInTinybars: str = "0"
    hbarOutTinybars: str = "0"
    latestTimestamp: str | None = None


class Observed(BaseModel):
    account: AccountObserved
    balance: BalanceObserved
    recent30d: Recent30dObserved


class FreshnessDetail(BaseModel):
    balanceTimestamp: str | None = None
    latestActivityTimestamp: str | None = None
    ageSeconds: int | None = None
    staleAfterSeconds: int


class Narrative(BaseModel):
    generatedBy: Literal["deterministic"] = "deterministic"
    llm: Literal[False] = False
    summary: str
    points: list[str]


class SuccessAnalysis(BaseModel):
    scope: str
    source: str
    network: str
    dataTimestamp: str | None = None
    freshnessHealth: Literal["fresh", "stale", "unknown"]
    freshness: FreshnessDetail
    observed: Observed
    derivedMetrics: dict[str, Any]
    narrative: Narrative
    unavailable: list[str]
    limitations: list[str]


class DegradedIndications(BaseModel):
    accountNotReadable: Literal[True] = True
    reason: str


class DegradedAnalysis(BaseModel):
    scope: str
    source: str
    network: str
    dataTimestamp: None = None
    dataUnavailable: Literal[True] = True
    indications: DegradedIndications
    narrative: Narrative
    unavailable: list[str]
    limitations: list[str]


class PaymentBlock(BaseModel):
    protocol: Literal["x402"] = "x402"
    version: Literal[2] = 2
    network: str
    asset: Literal["0.0.0"] = "0.0.0"
    amountTinybars: str


class YieldRiskResponse(BaseModel):
    status: Literal["success"] = "success"
    service: str
    request: YieldRiskRequest
    analysis: SuccessAnalysis | DegradedAnalysis
    payment: PaymentBlock
    disclaimer: str


class YieldRiskSuccessPayload(BaseModel):
    accountId: str
    endpoint: str = "/v1/strategy/yield-risk"
    status: str
    requestId: str

    @model_validator(mode="after")
    def _validate(self) -> "YieldRiskSuccessPayload":
        if not 1 <= len(self.accountId) <= 100:
            raise ValueError("accountId too long")
        if len(self.requestId) < 8:
            raise ValueError("requestId too short")
        return self