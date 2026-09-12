"""Strata402 ai-engine — deterministic risk engine and narrative.

Honesty contract (mirrors the gateway TypeScript analyst):
- Only on-chain facts published by the Hedera Mirror Node are used.
- No `riskScore` / `confidence` numbers are invented.
- The LLM (if configured) may only re-narrate already-observed facts; its
  failure or absence NEVER changes the underlying analysis — the deterministic
  narrative is always produced and is the source of truth.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.core.config import (
    ANALYSIS_SCOPE,
    ANALYSIS_SOURCE,
    DEFAULT_STALE_AFTER_SECONDS,
    DISCLAIMER,
    LIMITATIONS,
    SERVICE_NAME,
    Settings,
    UNVAILABLE_FEATURES,
    load_settings,
)
from app.models.schemas import (
    AccountObserved,
    BalanceObserved,
    DegradedAnalysis,
    DegradedIndications,
    FreshnessDetail,
    Narrative,
    Observed,
    PaymentBlock,
    Recent30dObserved,
    SuccessAnalysis,
    YieldRiskRequest,
    YieldRiskResponse,
)
from app.services.hedera_mirror import (
    MirrorAccountRead,
    MirrorReadError,
    format_hbar_from_tinybars,
)
from app.services.bonzo_mirror import BonzoMarketRead


def _newest_timestamp(a: str | None, b: str | None) -> str | None:
    if a is None:
        return b
    if b is None:
        return a
    return a if a >= b else b


def freshness_of(
    balance_timestamp: str | None,
    latest_activity_timestamp: str | None,
    now_seconds: int,
    stale_after_seconds: int,
) -> tuple[str | None, str, int | None]:
    data_timestamp = _newest_timestamp(balance_timestamp, latest_activity_timestamp)
    if data_timestamp is None:
        return None, "unknown", None
    try:
        seconds = int(data_timestamp.split(".")[0])
    except (ValueError, IndexError):
        return data_timestamp, "unknown", None
    age = max(0, now_seconds - seconds)
    health = "stale" if age > stale_after_seconds else "fresh"
    return data_timestamp, health, age


def observed_from_read(read: MirrorAccountRead) -> Observed:
    state = read.account_state
    recent = read.recent_activity
    return Observed(
        account=AccountObserved(
            accountId=state.account,
            exists=state.exists,
            deleted=state.deleted,
            createdTimestamp=state.created_timestamp,
        ),
        balance=BalanceObserved(
            tinybars=str(state.balance_tinybars),
            hbar=format_hbar_from_tinybars(state.balance_tinybars),
            timestamp=state.balance_timestamp,
            tokenBalancesCount=state.token_balances_count,
        ),
        recent30d=Recent30dObserved(
            transactionCount=recent.transactions30d,
            hbarInTinybars=str(recent.hbar_in_tinybars),
            hbarOutTinybars=str(recent.hbar_out_tinybars),
            latestTimestamp=recent.latest_consensus_timestamp,
        ),
    )


from app.services.saucerswap_mirror import SaucerPoolsRead, SaucerTokensRead


def build_narrative(
    observed: Observed,
    net30d_tinybars: str,
    health: str,
    saucerswap_pools: SaucerPoolsRead | None = None,
) -> Narrative:
    net_hbar = format_hbar_from_tinybars(int(net30d_tinybars))
    points = [
        f"Account {observed.account.accountId} exists on the Hedera Testnet Mirror Node (created {observed.account.createdTimestamp or 'unknown'}).",
        f"Balance: {observed.balance.hbar} HBAR ({observed.balance.tinybars} tinybars) at {observed.balance.timestamp or 'unknown'}.",
        f"Last 30 days: {observed.recent30d.transactionCount} transaction(s), "
        f"{format_hbar_from_tinybars(int(observed.recent30d.hbarInTinybars))} HBAR in, "
        f"{format_hbar_from_tinybars(int(observed.recent30d.hbarOutTinybars))} HBAR out, net {net_hbar} HBAR.",
        f"Freshness: {health}.",
    ]
    if saucerswap_pools is not None:
        points.append(
            f"SaucerSwap DEX Read-Only Snapshot: {saucerswap_pools.pool_count} pools observed across "
            f"fee tiers {list(saucerswap_pools.fee_tiers_seen_hundredths_bps)} (live pool APY unavailable)."
        )
    return Narrative(
        generatedBy="deterministic",
        llm=False,
        summary=(
            f"Deterministic account-level summary for {observed.account.accountId} "
            f"from Hedera Mirror Node data ({ANALYSIS_SOURCE}). No LLM involved."
        ),
        points=points,
    )


def _degraded_narrative(reason: str) -> Narrative:
    return Narrative(
        generatedBy="deterministic",
        llm=False,
        summary=(
            "Mirror Node data is currently unavailable; no account facts or "
            "indicators are claimed from a live read."
        ),
        points=[f"Mirror read failed: {reason}."],
    )


def _payment_block(network: str, amount_tinybars: str) -> PaymentBlock:
    return PaymentBlock(network=network, amountTinybars=amount_tinybars)


def _pending_bonzo_block(source: str, note: str, error_code: str | None = None) -> dict[str, Any]:
    return {
        "status": "pending",
        "readOnly": True,
        "protocol": "Bonzo Finance",
        "source": source,
        "reservesCount": 0,
        "reserves": [],
        "apyStatus": "UNAVAILABLE",
        "errorCode": error_code,
        "note": note,
    }


def _bonzo_derived(bonzo_read: BonzoMarketRead | None, network: str) -> dict[str, Any]:
    """Real Bonzo `derivedMetrics.bonzo` block — live facts or an honest pending gate.

    Never fabricates reserves: a `pending` read surfaces zero reserves and
    UNAVAILABLE APY with the exact failure code.
    """
    if bonzo_read is None:
        return _pending_bonzo_block(
            source="unconfigured",
            note="Bonzo read disabled; lending matrix not claimed.",
        )
    if bonzo_read.status != "available":
        return _pending_bonzo_block(
            source=bonzo_read.source,
            note=bonzo_read.note,
            error_code=bonzo_read.error_code,
        )
    reserves: list[dict[str, Any]] = []
    for reserve in bonzo_read.reserves:
        item: dict[str, Any] = {
            "symbol": reserve.symbol,
            "name": reserve.name,
            "tokenId": reserve.token_id,
            "ltvPercent": reserve.ltv_percent,
            "liquidationThresholdPercent": reserve.liquidation_threshold_percent,
            "reserveFactorPercent": reserve.reserve_factor_percent,
            "borrowEnabled": reserve.variable_borrowing_enabled,
            "active": reserve.active,
            "frozen": reserve.frozen,
            "apyStatus": reserve.apy_status,
        }
        if reserve.supply_apy is not None:
            item["supplyApy"] = reserve.supply_apy
        if reserve.variable_borrow_apy is not None:
            item["variableBorrowApy"] = reserve.variable_borrow_apy
        if reserve.utilization_rate is not None:
            item["utilizationRate"] = reserve.utilization_rate
        reserves.append(item)
    return {
        "status": "available",
        "readOnly": True,
        "protocol": "Bonzo Finance",
        "network": network,
        "source": bonzo_read.source,
        "reservesCount": bonzo_read.reserves_count,
        "reserves": reserves,
        "apyStatus": "available" if any(r.get("supplyApy") is not None for r in reserves) else "UNAVAILABLE",
        "fetchedAt": bonzo_read.fetched_at,
        "note": bonzo_read.note,
    }


def analyze_read(
    read: MirrorAccountRead,
    request: YieldRiskRequest,
    settings: Settings,
    now_seconds: int,
    stale_after_seconds: int = DEFAULT_STALE_AFTER_SECONDS,
    saucerswap_tokens: SaucerTokensRead | None = None,
    saucerswap_pools: SaucerPoolsRead | None = None,
    bonzo_read: BonzoMarketRead | None = None,
) -> YieldRiskResponse:
    observed = observed_from_read(read)
    data_timestamp, health, age = freshness_of(
        observed.balance.timestamp,
        observed.recent30d.latestTimestamp,
        now_seconds,
        stale_after_seconds,
    )
    net30d = str(read.recent_activity.hbar_in_tinybars - read.recent_activity.hbar_out_tinybars)
    derived: dict[str, Any] = {"net30dTinybars": net30d}

    derived["bonzo"] = _bonzo_derived(bonzo_read, settings.network)

    if saucerswap_pools is not None or saucerswap_tokens is not None:
        ss_info: dict[str, Any] = {
            "status": "available",
            "readOnly": True,
            "poolApy": "UNAVAILABLE",
        }
        if saucerswap_tokens is not None:
            ss_info["tokensCount"] = saucerswap_tokens.token_count
            ss_info["sampleSymbols"] = list(saucerswap_tokens.sample_symbols)
        if saucerswap_pools is not None:
            ss_info["poolsCount"] = saucerswap_pools.pool_count
            ss_info["feeTiers"] = list(saucerswap_pools.fee_tiers_seen_hundredths_bps)
            ss_info["samplePools"] = [
                {
                    "id": p.id,
                    "contractId": p.contract_id,
                    "pair": (
                        f"{p.token_a.symbol if p.token_a else '?'}/"
                        f"{p.token_b.symbol if p.token_b else '?'}"
                    ),
                    "feeTierBp": p.fee_hundredths_bps / 100.0,
                    "liquidity": p.liquidity,
                }
                for p in saucerswap_pools.pools[:5]
            ]
        derived["saucerswap"] = ss_info

    analysis = SuccessAnalysis(
        scope=ANALYSIS_SCOPE,
        source=ANALYSIS_SOURCE,
        network=settings.network,
        dataTimestamp=data_timestamp,
        freshnessHealth=health,
        freshness=FreshnessDetail(
            balanceTimestamp=observed.balance.timestamp,
            latestActivityTimestamp=observed.recent30d.latestTimestamp,
            ageSeconds=age,
            staleAfterSeconds=stale_after_seconds,
        ),
        observed=observed,
        derivedMetrics=derived,
        narrative=build_narrative(observed, net30d, health, saucerswap_pools=saucerswap_pools),
        unavailable=list(UNVAILABLE_FEATURES),
        limitations=list(LIMITATIONS),
    )
    return YieldRiskResponse(
        status="success",
        service=SERVICE_NAME,
        request=request,
        analysis=analysis,
        payment=_payment_block(settings.network, request_amount_tinybars(request)),
        disclaimer=DISCLAIMER,
    )



def analyze_degraded(
    request: YieldRiskRequest,
    settings: Settings,
    error: BaseException,
) -> YieldRiskResponse:
    reason = (
        f"mirror read failed ({error.code})"
        if isinstance(error, MirrorReadError)
        else f"mirror read failed ({error})"
    )
    analysis = DegradedAnalysis(
        scope=ANALYSIS_SCOPE,
        source=ANALYSIS_SOURCE,
        network=settings.network,
        indications=DegradedIndications(accountNotReadable=True, reason=reason),
        narrative=_degraded_narrative(reason),
        unavailable=list(UNVAILABLE_FEATURES),
        limitations=list(LIMITATIONS),
    )
    return YieldRiskResponse(
        status="success",
        service=SERVICE_NAME,
        request=request,
        analysis=analysis,
        payment=_payment_block(settings.network, request_amount_tinybars(request)),
        disclaimer=DISCLAIMER,
    )


def request_amount_tinybars(request: YieldRiskRequest) -> str:
    from decimal import Decimal

    return str(int(Decimal(str(request.amountHbar)) * 100_000_000) if request.amountHbar else 0)


@dataclass
class RiskEngine:
    settings: Settings
    mirror: object

    def __init__(self, settings: Settings | None = None, mirror: object | None = None) -> None:
        self.settings = settings or load_settings()
        self.mirror = mirror

    @property
    def llm_available(self) -> bool:
        return bool(self.settings.llm_provider and self.settings.llm_model and self.settings.llm_api_key)

    async def llm_narration(self, observed: Observed, narrative: Narrative) -> Narrative:
        """LLM re-narration hook. Degrades to the deterministic narrative always.

        When credentials are absent this is a no-op; when present but failing it
        returns the deterministic narrative unchanged (never modifying `points`).
        """
        if not self.llm_available:
            return narrative
        try:
            return await self._call_llm(observed, narrative)
        except Exception:
            return narrative

    async def _call_llm(self, observed: Observed, narrative: Narrative) -> Narrative:
        raise NotImplementedError("LLM provider adapter arrives with a verified provider")