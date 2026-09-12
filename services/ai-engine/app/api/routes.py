"""Strata402 ai-engine — /v1/strategy/yield-risk router."""

from __future__ import annotations

import time
from typing import Any

from fastapi import APIRouter, HTTPException, Request

from app.core.config import (
    DEFAULT_STALE_AFTER_SECONDS,
    DEFAULT_RECENT_WINDOW_SECONDS,
)
from app.models.schemas import YieldRiskBadRequest, YieldRiskRequest, YieldRiskResponse
from app.services.hedera_mirror import MirrorClient
from app.services.risk_engine import RiskEngine, analyze_degraded, analyze_read

router = APIRouter()


def get_settings(request: Request) -> Any:
    return request.app.state.settings


def get_mirror(request: Request) -> MirrorClient:
    return request.app.state.mirror


def get_engine(request: Request) -> RiskEngine:
    return request.app.state.engine


def get_saucerswap(request: Request) -> Any:
    return getattr(request.app.state, "saucerswap", None)


def get_bonzo(request: Request) -> Any:
    return getattr(request.app.state, "bonzo", None)


@router.post(
    "/v1/strategy/yield-risk",
    response_model=YieldRiskResponse,
    responses={400: {"model": YieldRiskBadRequest}, 406: {"model": YieldRiskBadRequest}},
)
async def yield_risk(request: Request, body: YieldRiskRequest) -> YieldRiskResponse:
    engine = get_engine(request)
    settings = engine.settings
    mirror = get_mirror(request)
    saucerswap = get_saucerswap(request)
    bonzo = get_bonzo(request)
    now_seconds = int(time.time())

    ss_tokens = None
    ss_pools = None
    if settings.saucerswap_enabled and saucerswap is not None:
        try:
            ss_tokens = await saucerswap.read_tokens()
            ss_pools = await saucerswap.read_pools()
        except Exception:
            # Graceful degradation - failed read on SaucerSwap never blocks yield-risk
            ss_tokens = None
            ss_pools = None

    bonzo_read = None
    if settings.bonzo_enabled and bonzo is not None:
        # Real Bonzo Lend probe. The adapter itself returns a pending stub (never
        # fabricated numbers) when the documented source is unreachable/non-200.
        try:
            bonzo_read = await bonzo.read_market()
        except Exception:
            bonzo_read = None

    try:
        read = await mirror.read_account_snapshot(
            body.accountId,
            now_seconds=now_seconds,
            window_seconds=DEFAULT_RECENT_WINDOW_SECONDS,
            stale_after_seconds=DEFAULT_STALE_AFTER_SECONDS,
        )
        response = analyze_read(
            read,
            body,
            settings,
            now_seconds,
            saucerswap_tokens=ss_tokens,
            saucerswap_pools=ss_pools,
            bonzo_read=bonzo_read,
        )
    except Exception as exc:  # degraded-but-honest, never a bare crash
        response = analyze_degraded(body, settings, exc)

    return response


@router.get("/health")
async def health(request: Request) -> dict[str, Any]:
    return {
        "status": "ok",
        "service": "strata402-ai-engine",
        "network": request.app.state.settings.network,
        "llmNarration": request.app.state.engine.llm_available,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }