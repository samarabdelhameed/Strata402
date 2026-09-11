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


@router.post(
    "/v1/strategy/yield-risk",
    response_model=YieldRiskResponse,
    responses={400: {"model": YieldRiskBadRequest}, 406: {"model": YieldRiskBadRequest}},
)
async def yield_risk(request: Request, body: YieldRiskRequest) -> YieldRiskResponse:
    engine = get_engine(request)
    settings = engine.settings
    mirror = get_mirror(request)
    now_seconds = int(time.time())

    try:
        read = await mirror.read_account_snapshot(
            body.accountId,
            now_seconds=now_seconds,
            window_seconds=DEFAULT_RECENT_WINDOW_SECONDS,
            stale_after_seconds=DEFAULT_STALE_AFTER_SECONDS,
        )
        response = analyze_read(read, body, settings, now_seconds)
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