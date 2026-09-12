"""Strata402 ai-engine — verified SaucerSwap Finance public data adapter.

Reads only facts published by the keyless SaucerSwap Testnet REST API
(https://test-api.saucerswap.finance). No API key required. All reads are
read-only and typed. Prefer Settings.saucerswap_base_url (SAUCERSWAP_API_URL).

Honesty contract (same discipline as the Hedera Mirror adapter):
- Only facts actually observed on the wire are reported; nothing is fabricated.
- The public pool/token endpoints expose no historical volume or fee-earnings
  history, so a trustworthy pool APY cannot be derived from public daily data.
  APY is therefore ALWAYS reported UNAVAILABLE — never invented, never blended.
- Fail-closed: a malformed or non-200 body raises a machine-readable
  SaucerReadError; no partial or guessed facts are ever returned.
- Machine-readable error codes; never a bare string raise.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

SAUCER_BASE_URL = "https://test-api.saucerswap.finance"
SAUCER_TOKENS_PATH = "/tokens"
SAUCER_POOLS_FULL_PATH = "/v2/pools/full"
SAUCER_TIMEOUT_SECONDS = 20.0


@dataclass(frozen=True)
class SaucerPoolToken:
    """Token facts nested inside a pool entry (public price incl. priceUsd)."""

    id: str
    symbol: str | None
    name: str | None
    decimals: int | None
    price_usd: float | None


@dataclass(frozen=True)
class SaucerPool:
    """One pool from /v2/pools/full. Amounts stay raw (they may be signed)."""

    id: int
    contract_id: str
    token_a: SaucerPoolToken | None
    token_b: SaucerPoolToken | None
    amount_a: str
    amount_b: str
    fee_hundredths_bps: int
    sqrt_ratio_x96: str
    tick_current: int | None
    liquidity: str


@dataclass(frozen=True)
class SaucerTokensRead:
    token_count: int
    sample_symbols: tuple[str, ...]
    top_pool_symbols: tuple[str, ...]


@dataclass(frozen=True)
class SaucerPoolsRead:
    pool_count: int
    fee_tiers_seen_hundredths_bps: tuple[int, ...]
    pools: tuple[SaucerPool, ...]


class SaucerReadError(Exception):
    """Machine-readable SaucerSwap read failure. Never raised as a bare string."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def _to_str(value: Any) -> str | None:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        value = str(value)
    if isinstance(value, str):
        stripped = value.strip()
        return stripped or None
    return None


def _to_int(value: Any) -> int | None:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, int):
        return value
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _to_float(value: Any) -> float | None:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def parse_tokens_json(payload: Any) -> SaucerTokensRead:
    """Parse the real /tokens body: a top-level JSON array of token objects."""
    if not isinstance(payload, list):
        raise SaucerReadError("MALFORMED_JSON", "tokens payload must be a list")
    symbols: list[str] = []
    top_pool_symbols: list[str] = []
    for raw in payload:
        if not isinstance(raw, dict):
            continue
        token_id = _to_str(raw.get("id"))
        symbol = _to_str(raw.get("symbol"))
        if token_id is None or symbol is None:
            continue
        symbol = symbol.upper()
        symbols.append(symbol)
        if _to_int(raw.get("inTopPools")) == 1:
            top_pool_symbols.append(symbol)
    return SaucerTokensRead(
        token_count=len(symbols),
        sample_symbols=tuple(symbols[:8]),
        top_pool_symbols=tuple(top_pool_symbols[:8]),
    )


def _parse_pool_token(raw: Any) -> SaucerPoolToken | None:
    if not isinstance(raw, dict):
        return None
    token_id = _to_str(raw.get("id"))
    if token_id is None:
        return None
    return SaucerPoolToken(
        id=token_id,
        symbol=_to_str(raw.get("symbol")),
        name=_to_str(raw.get("name")),
        decimals=_to_int(raw.get("decimals")),
        price_usd=_to_float(raw.get("priceUsd")),
    )


def parse_pools_json(payload: Any) -> SaucerPoolsRead:
    """Parse the real /v2/pools/full body: a top-level JSON array of pools."""
    if not isinstance(payload, list):
        raise SaucerReadError("MALFORMED_JSON", "pools payload must be a list")
    pools: list[SaucerPool] = []
    fee_tiers: set[int] = set()
    for raw in payload:
        if not isinstance(raw, dict):
            continue
        pool_id = _to_int(raw.get("id"))
        if pool_id is None:
            continue
        fee = _to_int(raw.get("fee"))
        if fee is None:
            continue
        fee_tiers.add(fee)
        pools.append(
            SaucerPool(
                id=pool_id,
                contract_id=_to_str(raw.get("contractId")) or "",
                token_a=_parse_pool_token(raw.get("tokenA")),
                token_b=_parse_pool_token(raw.get("tokenB")),
                amount_a=_to_str(raw.get("amountA")) or "",
                amount_b=_to_str(raw.get("amountB")) or "",
                fee_hundredths_bps=fee,
                sqrt_ratio_x96=_to_str(raw.get("sqrtRatioX96")) or "",
                tick_current=_to_int(raw.get("tickCurrent")),
                liquidity=_to_str(raw.get("liquidity")) or "",
            )
        )
    return SaucerPoolsRead(
        pool_count=len(pools),
        fee_tiers_seen_hundredths_bps=tuple(sorted(fee_tiers)),
        pools=tuple(pools),
    )


class SaucerSwapClient:
    """Keyless, read-only SaucerSwap public API client with typed results."""

    def __init__(self, base_url: str = SAUCER_BASE_URL, fetch_fn: Any = None) -> None:
        self._base_url = base_url.rstrip("/")
        if fetch_fn is None:
            import httpx

            fetch_fn = httpx.AsyncClient(timeout=SAUCER_TIMEOUT_SECONDS)
        self._fetch = fetch_fn

    async def read_tokens(self) -> SaucerTokensRead:
        data = await self._get_json(f"{self._base_url}{SAUCER_TOKENS_PATH}")
        return parse_tokens_json(data)

    async def read_pools(self) -> SaucerPoolsRead:
        data = await self._get_json(f"{self._base_url}{SAUCER_POOLS_FULL_PATH}")
        return parse_pools_json(data)

    async def _get_json(self, url: str) -> Any:
        try:
            response = await self._fetch.get(url)
        except Exception as exc:  # network-level failure
            raise SaucerReadError("REQUEST_FAILED", f"saucerswap request failed: {exc}") from exc
        if response.status_code != 200:
            raise SaucerReadError("HTTP_STATUS", f"saucerswap HTTP {response.status_code}")
        try:
            return response.json()
        except Exception as exc:
            raise SaucerReadError("MALFORMED_JSON", f"saucerswap body is not JSON: {exc}") from exc

    async def aclose(self) -> None:
        try:
            close = getattr(self._fetch, "aclose", None)
            if close is not None:
                await close()
        except Exception:
            pass
