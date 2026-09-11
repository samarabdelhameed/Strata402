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


@pytest.fixture
async def client():
    """FastAPI ASGI client with a labeled in-process mirror fake."""
    app = create_app()
    fetch = FixtureFetch()
    app.state.mirror._fetch = fetch
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        ac.state = {"fetch": fetch}
        yield ac