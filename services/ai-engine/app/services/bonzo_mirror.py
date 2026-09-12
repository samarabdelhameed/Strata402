"""Strata402 ai-engine — Bonzo Finance Lend data adapter (real probe, pending until proven).

Source: the public Bonzo Lend Data API documented at
https://docs.bonzo.finance/hub/developer/bonzo-lend/lend-data-api — base URL
https://data.bonzo.finance (endpoints `/market`, `/stats`, `/config`).

Honesty contract (same discipline as the SaucerSwap and Mirror adapters):
- ONLY wire facts from a live read are reported. Nothing is fabricated.
- If the documented source is unreachable, non-200 (currently `503`), times out
  or returns a malformed body, the read FAILS to a `pending` stub: zero reserves,
  APY UNAVAILABLE, and a machine-readable reason. No hardcoded reserve table and
  no invented supply/borrow APY is ever returned.
- Testnet vs mainnet selection is the caller's choice via base_url; the adapter
  never guesses a network identity from a static id list.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

BONZO_BASE_URL = "https://data.bonzo.finance"
BONZO_MARKET_PATH = "/market"
BONZO_TIMEOUT_SECONDS = 10.0


@dataclass(frozen=True)
class BonzoReserve:
    """One reserve published by the live Bonzo Lend `/market` read.

    `token_id` is the Native Hedera HTS address (`hts_address`) as published on
    the wire. APY fields are only populated from the live response; a Bonzo
    market read that exposes no fee/APY history keeps them UNAVAILABLE.
    """

    symbol: str
    name: str | None
    token_id: str
    ltv_percent: float | None
    liquidation_threshold_percent: float | None
    reserve_factor_percent: float | None
    variable_borrowing_enabled: bool | None
    active: bool | None
    frozen: bool | None
    supply_apy: float | None
    variable_borrow_apy: float | None
    utilization_rate: float | None
    apy_status: str = "UNAVAILABLE"


@dataclass(frozen=True)
class BonzoMarketRead:
    """Result of one live Bonzo market probe.

    `status` is either `available` (real wire facts returned) or `pending`
    (source unreachable / non-200 / malformed — nothing claimed).
    """

    status: str
    reserves_count: int
    protocol: str
    network: str
    source: str
    reserves: tuple[BonzoReserve, ...]
    note: str
    error_code: str | None = None
    fetched_at: str | None = None

    @property
    def apy_status(self) -> str:
        return "UNAVAILABLE"

    @classmethod
    def pending(
        cls,
        source: str,
        note: str = "No eligible live Bonzo Lend data source; lending matrix stays pending.",
        error_code: str | None = None,
    ) -> "BonzoMarketRead":
        return cls(
            status="pending",
            reserves_count=0,
            protocol="Bonzo Finance",
            network="hedera",
            source=source,
            reserves=(),
            note=note,
            error_code=error_code,
        )


class BonzoReadError(Exception):
    """Machine-readable Bonzo read failure. Never raised as a bare string."""

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


def _to_bool(value: Any) -> bool | None:
    if isinstance(value, bool):
        return value
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


def _parse_reserve(raw: Any) -> BonzoReserve | None:
    if not isinstance(raw, dict):
        return None
    token_id = _to_str(raw.get("hts_address"))
    symbol = _to_str(raw.get("symbol"))
    if token_id is None or symbol is None:
        return None
    return BonzoReserve(
        symbol=symbol,
        name=_to_str(raw.get("name")),
        token_id=token_id,
        ltv_percent=_to_float(raw.get("ltv")),
        liquidation_threshold_percent=_to_float(raw.get("liquidation_threshold")),
        reserve_factor_percent=_to_float(raw.get("reserve_factor")),
        variable_borrowing_enabled=_to_bool(raw.get("variable_borrowing_enabled")),
        active=_to_bool(raw.get("active")),
        frozen=_to_bool(raw.get("frozen")),
        supply_apy=_to_float(raw.get("supply_apy")),
        variable_borrow_apy=_to_float(raw.get("variable_borrow_apy")),
        utilization_rate=_to_float(raw.get("utilization_rate")),
        apy_status=(
            "available"
            if _to_float(raw.get("supply_apy")) is not None
            else "UNAVAILABLE"
        ),
    )


def parse_market_json(
    payload: Any,
    network: str = "hedera",
    source: str = BONZO_BASE_URL,
    fetched_at: str | None = None,
) -> BonzoMarketRead:
    """Parse a real Bonzo Lend `/market` body into a typed read.

    Raises BonzoReadError on a malformed body; never fabricates reserves.
    """
    if not isinstance(payload, dict):
        raise BonzoReadError("MALFORMED_JSON", "bonzo market payload must be an object")
    raw_reserves = payload.get("reserves")
    if not isinstance(raw_reserves, list):
        raise BonzoReadError("MALFORMED_JSON", "bonzo market payload has no reserves list")
    reserves: list[BonzoReserve] = []
    for raw in raw_reserves:
        reserve = _parse_reserve(raw)
        if reserve is not None:
            reserves.append(reserve)
    if not reserves:
        raise BonzoReadError("EMPTY_RESERVES", "bonzo market returned zero usable reserves")
    return BonzoMarketRead(
        status="available",
        reserves_count=len(reserves),
        protocol="Bonzo Finance",
        network=network,
        source=source,
        reserves=tuple(reserves),
        note="Live Bonzo Lend `/market` read; wire facts only. APY only when published.",
        fetched_at=fetched_at,
    )


class BonzoClient:
    """Read-only Bonzo Lend Data API client with a pending fail-closed probe."""

    def __init__(self, base_url: str = BONZO_BASE_URL, fetch_fn: Any = None) -> None:
        self._base_url = base_url.rstrip("/")
        if fetch_fn is None:
            import httpx

            fetch_fn = httpx.AsyncClient(timeout=BONZO_TIMEOUT_SECONDS)
        self._fetch = fetch_fn

    @property
    def base_url(self) -> str:
        return self._base_url

    async def read_market(self) -> BonzoMarketRead:
        try:
            data = await self._get_json(f"{self._base_url}{BONZO_MARKET_PATH}")
        except BonzoReadError as exc:
            return BonzoMarketRead.pending(
                source=self._base_url,
                note=f"Bonzo Lend `/market` failed ({exc.code}); lending matrix stays pending. "
                "No fabricated reserves.",
                error_code=exc.code,
            )
        fetched_at = _fetched_at_now(data)
        return parse_market_json(data, source=self._base_url, fetched_at=fetched_at)

    async def _get_json(self, url: str) -> Any:
        try:
            response = await self._fetch.get(url)
        except Exception as exc:  # network-level failure
            raise BonzoReadError("REQUEST_FAILED", f"bonzo request failed: {exc}") from exc
        if response.status_code != 200:
            raise BonzoReadError(
                "HTTP_STATUS", f"bonzo HTTP {response.status_code} (expected 200)"
            )
        try:
            return response.json()
        except Exception as exc:
            raise BonzoReadError("MALFORMED_JSON", f"bonzo body is not JSON: {exc}") from exc

    async def aclose(self) -> None:
        try:
            close = getattr(self._fetch, "aclose", None)
            if close is not None:
                await close()
        except Exception:
            pass


def _fetched_at_now(payload: Any) -> str | None:
    timestamp = _to_str((payload or {}).get("timestamp"))
    return timestamp