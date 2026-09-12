"""Fixtures for ai-engine tests."""

from __future__ import annotations

from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import create_app

ACCOUNT = "0.0.7777"
NOW = 2_000_000_100
FRESH = "2000000000.000000000"

VALID_BODY = {"accountId": ACCOUNT, "riskTolerance": "balanced", "amountHbar": 100}


class FixtureFetch:
    """In-process fake mirror honoring the read-only REST shape."""

    def __init__(self, account: str = ACCOUNT, *, fail: bool = False) -> None:
        self.account = account
        self.fail = fail
        self.calls = 0

    async def get(self, url: str) -> Any:
        self.calls += 1
        if self.fail:
            return _resp(500, {"error": "mirror down"})
        if "/api/v1/accounts/" in url:
            return _resp(
                200,
                {
                    "account": self.account,
                    "balance": {"balance": 1000000000, "timestamp": FRESH},
                    "created_timestamp": "1500000000.000000000",
                    "deleted": False,
                    "tokens": [],
                },
            )
        if "/api/v1/transactions" in url:
            return _resp(
                200,
                {
                    "transactions": [
                        {
                            "transaction_id": f"{self.account}-0000000000-000000000",
                            "consensus_timestamp": FRESH,
                            "result": "SUCCESS",
                            "transfers": [{"account": self.account, "amount": 1000000}],
                        }
                    ]
                },
            )
        return _resp(404, {"error": "not found"})


class _resp:
    def __init__(self, status_code: int, json: dict[str, Any]) -> None:
        self.status_code = status_code
        self._json = json

    def json(self) -> dict[str, Any]:
        return self._json


class BonzoFixtureFetch:
    """In-process Bonzo probe double: non-200 by default (the real source is 503).

    Keeps API tests hermetic while exercising the honest pending path.
    """

    def __init__(self, *, available: bool = False) -> None:
        self.available = available
        self.calls = 0

    async def get(self, url: str) -> Any:
        self.calls += 1
        if self.available:
            return _resp(
                200,
                {
                    "timestamp": "2000000000.000000000",
                    "reserves": [
                        {
                            "symbol": "HBAR",
                            "name": "HBAR",
                            "hts_address": "0.0.0",
                            "ltv": 0.75,
                            "liquidation_threshold": 0.8,
                            "reserve_factor": 0.15,
                            "variable_borrowing_enabled": True,
                            "active": True,
                            "frozen": False,
                            "supply_apy": 0.04,
                            "variable_borrow_apy": 0.06,
                            "utilization_rate": 0.3,
                        },
                        {
                            "symbol": "SAUCE",
                            "name": "Sauce",
                            "hts_address": "0.0.1183558",
                            "ltv": 0.6,
                            "liquidation_threshold": 0.7,
                            "reserve_factor": 0.2,
                            "variable_borrowing_enabled": True,
                            "active": True,
                            "frozen": False,
                        },
                    ],
                },
            )
        # The real documented source currently returns 503 (Heroku app error).
        return _resp(503, {"error": "bonzo down"})


@pytest.fixture
async def client():
    """FastAPI ASGI client with labeled in-process data fakes."""
    app = create_app()
    fetch = FixtureFetch()
    app.state.mirror._fetch = fetch
    app.state.bonzo._fetch = BonzoFixtureFetch()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        ac.state = {"fetch": fetch, "bonzo": app.state.bonzo}
        yield ac