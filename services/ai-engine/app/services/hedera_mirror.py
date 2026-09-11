"""Strata402 ai-engine — verified Hedera Mirror Node data adapter.

Reads account existence, balance, and recent Hbar throughput from the Hedera
Mirror Node REST API. All reads are keyless, read-only, and return only facts
published by the mirror node; no transaction is ever created here.

Raised semantics intentionally mirror the TypeScript gateway mirror client
(read-only, fail-closed, machine-readable error codes).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.core.config import (
    DEFAULT_RECENT_WINDOW_SECONDS,
    DEFAULT_STALE_AFTER_SECONDS,
    TINYBARS_PER_HBAR,
)

MIRROR_ACCOUNTS_PATH = "/api/v1/accounts"
MIRROR_TRANSACTIONS_PATH = "/api/v1/transactions"


@dataclass(frozen=True)
class MirrorAccountState:
    account: str
    exists: bool
    deleted: bool
    created_timestamp: str | None
    balance_tinybars: int
    balance_timestamp: str | None
    token_balances_count: int


@dataclass(frozen=True)
class MirrorRecentActivity:
    transactions30d: int
    hbar_in_tinybars: int
    hbar_out_tinybars: int
    latest_consensus_timestamp: str | None


@dataclass(frozen=True)
class MirrorAccountRead:
    account_state: MirrorAccountState
    recent_activity: MirrorRecentActivity


class MirrorReadError(Exception):
    """Machine-readable mirror failure. Never raised as a bare string."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def _to_int(value: Any, field: str) -> int:
    if isinstance(value, bool):
        raise MirrorReadError("UNREADABLE_FIELD", f"{field} must be an integer")
    try:
        return int(value)
    except (TypeError, ValueError):
        raise MirrorReadError("UNREADABLE_FIELD", f"{field} is not an integer") from None


def parse_account_json(payload: dict[str, Any], account: str) -> MirrorAccountState:
    if not isinstance(payload, dict):
        raise MirrorReadError("MALFORMED_JSON", "account payload must be an object")
    balance = payload.get("balance")
    if not isinstance(balance, dict):
        raise MirrorReadError("MALFORMED_JSON", "account.balance must be an object")
    balance_tinybars = _to_int(balance.get("balance"), "balance.balance")
    balance_timestamp = (
        str(balance["timestamp"]) if isinstance(balance.get("timestamp"), str) and balance["timestamp"] else None
    )
    tokens = payload.get("tokens")
    return MirrorAccountState(
        account=account,
        exists=True,
        deleted=bool(payload.get("deleted", False)),
        created_timestamp=(
            str(payload["created_timestamp"])
            if isinstance(payload.get("created_timestamp"), str) and payload["created_timestamp"]
            else None
        ),
        balance_tinybars=balance_tinybars,
        balance_timestamp=balance_timestamp,
        token_balances_count=len(tokens) if isinstance(tokens, list) else 0,
    )


def parse_transactions_json(
    payload: dict[str, Any],
    account: str,
    now_seconds: int,
    window_seconds: int = DEFAULT_RECENT_WINDOW_SECONDS,
) -> MirrorRecentActivity:
    if not isinstance(payload, dict):
        raise MirrorReadError("MALFORMED_JSON", "transactions payload must be an object")
    transactions = payload.get("transactions")
    if not isinstance(transactions, list):
        raise MirrorReadError("MALFORMED_JSON", "transactions.transactions must be a list")

    in_tinybars = 0
    out_tinybars = 0
    txn_count = 0
    latest: str | None = None
    cutoff = now_seconds - window_seconds

    for txn in transactions:
        if not isinstance(txn, dict):
            continue
        consensus_raw = txn.get("consensus_timestamp")
        if not isinstance(consensus_raw, str) or not consensus_raw:
            continue
        consensus = float(consensus_raw.split(".")[0])
        if consensus < cutoff:
            continue
        if txn.get("result", "UNKNOWN") != "SUCCESS":
            continue
        txn_count += 1
        if latest is None or consensus_raw > latest:
            latest = consensus_raw
        transfers = txn.get("transfers")
        if not isinstance(transfers, list):
            continue
        for transfer in transfers:
            if not isinstance(transfer, dict):
                continue
            if transfer.get("account") != account:
                continue
            amount = _to_int(transfer.get("amount") or 0, "transfers.amount")
            if amount > 0:
                in_tinybars += amount
            else:
                out_tinybars += -amount

    return MirrorRecentActivity(
        transactions30d=txn_count,
        hbar_in_tinybars=in_tinybars,
        hbar_out_tinybars=out_tinybars,
        latest_consensus_timestamp=latest,
    )


class MirrorClient:
    """Read-only mirror client with strict JSON parsing and typed results."""

    def __init__(self, base_url: str, fetch_fn: Any = None) -> None:
        self._base_url = base_url.rstrip("/")
        self._fetch = fetch_fn or __import__("httpx").AsyncClient(timeout=15)

    async def read_account_snapshot(
        self,
        account: str,
        *,
        now_seconds: int,
        window_seconds: int = DEFAULT_RECENT_WINDOW_SECONDS,
        stale_after_seconds: int = DEFAULT_STALE_AFTER_SECONDS,
    ) -> MirrorAccountRead:
        account_state = await self._read_account(account)
        recent_activity = await self._read_recent(account, now_seconds, window_seconds)
        return MirrorAccountRead(
            account_state=account_state,
            recent_activity=recent_activity,
        )

    async def _read_account(self, account: str) -> MirrorAccountState:
        url = f"{self._base_url}{MIRROR_ACCOUNTS_PATH}/{account}"
        data = await self._get_json(url)
        if isinstance(data, dict) and "account" in data:
            return parse_account_json(data, account)
        return MirrorAccountState(
            account=account,
            exists=False,
            deleted=False,
            created_timestamp=None,
            balance_tinybars=0,
            balance_timestamp=None,
            token_balances_count=0,
        )

    async def _read_recent(
        self,
        account: str,
        now_seconds: int,
        window_seconds: int,
    ) -> MirrorRecentActivity:
        url = (
            f"{self._base_url}{MIRROR_TRANSACTIONS_PATH}"
            f"?account.id={account}&timestamp=gt:{now_seconds - window_seconds}.000000000"
            f"&limit=100"
        )
        data = await self._get_json(url)
        return parse_transactions_json(data, account, now_seconds, window_seconds)

    async def _get_json(self, url: str) -> Any:
        client = self._fetch if isinstance(self._fetch, __import__("httpx").AsyncClient) else self._fetch
        try:
            response = await client.get(url)
        except Exception as exc:  # network-level failure
            raise MirrorReadError("REQUEST_FAILED", f"mirror request failed: {exc}") from exc
        if response.status_code == 404:
            return {"account_id": url.rsplit("/", 1)[-1], "exists": False}
        if response.status_code != 200:
            raise MirrorReadError("HTTP_STATUS", f"mirror HTTP {response.status_code}")
        try:
            return response.json()
        except Exception as exc:
            raise MirrorReadError("MALFORMED_JSON", f"mirror body is not JSON: {exc}") from exc

    async def aclose(self) -> None:
        if isinstance(self._fetch, __import__("httpx").AsyncClient):
            await self._fetch.aclose()


def format_hbar_from_tinybars(total_tinybars: int) -> str:
    whole, remainder = divmod(total_tinybars, TINYBARS_PER_HBAR)
    if remainder == 0:
        return str(whole)
    fractional = f"{remainder / TINYBARS_PER_HBAR:.8f}".split(".")[1].rstrip("0")
    return f"{whole}.{fractional}"