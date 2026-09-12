"""Bonzo Lend data adapter tests — live-parse and fail-closed pending (no network)."""

from __future__ import annotations

import pytest

from app.core.config import load_settings
from app.services.bonzo_mirror import (
    BONZO_MARKET_PATH,
    BonzoClient,
    BonzoReadError,
    parse_market_json,
)

MARKET_PAYLOAD = {
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
    ],
}


class _Resp:
    def __init__(self, status_code: int, json: object) -> None:
        self.status_code = status_code
        self._json = json

    def json(self) -> object:
        return self._json


class _Fetch:
    def __init__(self, resp: _Resp) -> None:
        self._resp = resp
        self.last_url = None

    async def get(self, url: str) -> _Resp:
        self.last_url = url
        return self._resp


@pytest.mark.anyio
async def test_parse_market_returns_wire_facts() -> None:
    read = parse_market_json(MARKET_PAYLOAD, source="https://data.bonzo.finance")
    assert read.status == "available"
    assert read.reserves_count == 1
    reserve = read.reserves[0]
    assert reserve.symbol == "HBAR"
    assert reserve.token_id == "0.0.0"
    assert reserve.ltv_percent == 0.75
    assert reserve.supply_apy == 0.04
    assert reserve.apy_status == "available"


@pytest.mark.anyio
async def test_parse_market_without_apy_keeps_unavailable() -> None:
    payload = dict(MARKET_PAYLOAD)
    payload["reserves"] = [dict(MARKET_PAYLOAD["reserves"][0], supply_apy=None)]
    read = parse_market_json(payload)
    assert read.reserves[0].supply_apy is None
    assert read.reserves[0].apy_status == "UNAVAILABLE"


@pytest.mark.anyio
async def test_parse_market_rejects_malformed_payload() -> None:
    with pytest.raises(BonzoReadError) as non_list:
        parse_market_json({"reserves": "nope"})
    assert non_list.value.code == "MALFORMED_JSON"
    with pytest.raises(BonzoReadError) as missing:
        parse_market_json({"foo": 1})
    assert missing.value.code == "MALFORMED_JSON"
    with pytest.raises(BonzoReadError) as empty:
        parse_market_json({"reserves": []})
    assert empty.value.code == "EMPTY_RESERVES"


@pytest.mark.anyio
async def test_client_503_fails_closed_to_pending() -> None:
    client = BonzoClient(fetch_fn=_Fetch(_Resp(503, {"error": "down"})))
    read = await client.read_market()
    assert read.status == "pending"
    assert read.reserves_count == 0
    assert read.reserves == ()
    assert read.error_code == "HTTP_STATUS"


@pytest.mark.anyio
async def test_client_reachable_returns_live_read() -> None:
    client = BonzoClient(fetch_fn=_Fetch(_Resp(200, MARKET_PAYLOAD)))
    read = await client.read_market()
    assert read.status == "available"
    assert read.reserves[0].token_id == "0.0.0"
    assert client.base_url == "https://data.bonzo.finance"
    assert "/market" in _fetch_url(client)


def _fetch_url(client: BonzoClient) -> str:
    return client._fetch.last_url


def test_settings_read_bonzo_env() -> None:
    settings = load_settings(
        {"BONZO_API_URL": "https://example.bonzo/data", "BONZO_ENABLED": "true"}
    )
    assert settings.bonzo_base_url == "https://example.bonzo/data"
    assert settings.bonzo_enabled is True
    disabled = load_settings({"BONZO_ENABLED": "false"})
    assert disabled.bonzo_enabled is False
    default = load_settings({})
    assert default.bonzo_base_url == "https://data.bonzo.finance"
    assert BONZO_MARKET_PATH == "/market"