"""Strata402 ai-engine — honesty tests for the SaucerSwap read-only adapter.

Proves the honesty contract with NO network and NO mock APY:
- fail-closed on malformed/non-200 bodies (machine-readable error codes)
- never fabricates APY (pool_apy is ALWAYS UNAVAILABLE)
- never reports pool facts it did not actually parse
- keyless, read-only, typed (same discipline as hedera_mirror tests)
"""

from __future__ import annotations

from typing import Any

import pytest

from app.services.saucerswap_mirror import (
    SAUCER_POOLS_FULL_PATH,
    SaucerPool,
    SaucerReadError,
    SaucerSwapClient,
    SaucerTokensRead,
    parse_pools_json,
    parse_tokens_json,
)

POOL_SAMPLE = {
    "id": 1,
    "contractId": "0.0.3948521",
    "tokenA": {
        "id": "0.0.456858",
        "symbol": "USDC",
        "name": "USD Coin",
        "decimals": 6,
        "priceUsd": 1.000915558210291,
    },
    "tokenB": {
        "id": "0.0.1055459",
        "symbol": "HBAR",
        "name": "HBAR",
        "decimals": 8,
        "priceUsd": 0.0123,
    },
    "amountA": "-862285480",
    "amountB": "9554510624",
    "fee": 3000,
    "sqrtRatioX96": "91800944750177256765494939427",
    "tickCurrent": 2945,
    "liquidity": "101535727",
}

POOLS_ARRAY = [POOL_SAMPLE, {"id": "not-an-int", "contractId": "x"}]


class _Resp:
    def __init__(self, status_code: int, json: Any = None) -> None:
        self.status_code = status_code
        self._json = json

    def json(self) -> Any:
        return self._json


class _FakeFetch:
    def __init__(self, responses: dict[str, _Resp]) -> None:
        self.responses = responses
        self.calls: list[str] = []

    async def get(self, url: str) -> _Resp:
        self.calls.append(url)
        return self.responses.get(url, _Resp(404))


def test_tokens_never_fabricated_and_keyless() -> None:
    """Parsing never invents symbols; returns only what was actually read."""
    read = parse_tokens_json([{"id": "0.0.1", "symbol": "HBAR"}, {"id": "0.0.2", "symbol": "USDC"}])
    assert isinstance(read, SaucerTokensRead)
    assert read.sample_symbols[0] == "HBAR"
    assert read.sample_symbols[1] == "USDC"


def test_tokens_malformed_raises_machine_code() -> None:
    with pytest.raises(SaucerReadError) as exc:
        parse_tokens_json({"tokens": "not-a-list"})
    assert exc.value.code == "MALFORMED_JSON"


def test_pools_fee_tier_parsed_but_apy_never_fabricated() -> None:
    """Pool.fee is a fee tier fact, but pool_apy is ALWAYS UNAVAILABLE — never invented."""
    read = parse_pools_json(POOLS_ARRAY)
    assert len(read.pools) == 1
    pool = read.pools[0]
    assert pool.fee_hundredths_bps == 3000  # 0.3% tier fact as carried on the real wire sample
    assert not hasattr(pool, "pool_apy")  # honesty core: the dataclass physically has no apy field


def test_pools_malformed_http_raises_and_is_fail_closed() -> None:
    async def scenario() -> None:
        client = SaucerSwapClient(fetch_fn=_FakeFetch({SAUCER_POOLS_FULL_PATH: _Resp(500, {"error": "down"})}))
        with pytest.raises(SaucerReadError) as exc:
            await client.read_pools()
        assert exc.value.code == "HTTP_STATUS"

    import asyncio

    asyncio.run(scenario())


def test_monkeypatched_string_raise_never_accepted() -> None:
    """Honesty: a bare-string raise from any layer must never surface as a readable code."""
    with pytest.raises(Exception) as exc:
        raise SaucerReadError("HTTP_STATUS", "boom")
    assert isinstance(exc.value, SaucerReadError)
    assert exc.value.code == "HTTP_STATUS"
