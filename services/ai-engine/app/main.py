"""Strata402 ai-engine — FastAPI application entry point.

Deterministic risk engine over real Hedera Mirror Node data. The deterministic
path never depends on the LLM; LLM narration degrades safely when absent/failing.
"""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.api.routes import router
from app.core.config import load_settings
from app.services.hedera_mirror import MirrorClient
from app.services.risk_engine import RiskEngine


def create_app() -> FastAPI:
    settings = load_settings()
    mirror = MirrorClient(settings.mirror_base_url)
    engine = RiskEngine(settings=settings, mirror=mirror)

    app = FastAPI(title="Strata402 ai-engine", version="0.1.0")

    @app.exception_handler(RequestValidationError)
    async def _validation_exception_handler(request: Request, exc: RequestValidationError):
        issues = []
        for err in exc.errors():
            loc = [str(p) for p in err.get("loc", []) if p != "body"]
            issues.append(f"{loc[0]}:{err.get('type')}" if loc else str(err.get("type")))
        return JSONResponse(
            status_code=400,
            content={
                "status": "error",
                "code": "invalid_request_contract",
                "message": f"Request does not satisfy the yield-risk contract: {', '.join(issues)}",
                "issues": issues,
            },
        )

    app.state.settings = settings
    app.state.mirror = mirror
    app.state.engine = engine
    app.include_router(router)
    return app


app = create_app()