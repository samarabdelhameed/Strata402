"""Deterministic risk-engine and policy tests (no network)."""

from __future__ import annotations

import pytest

from app.services.hedera_mirror import (
    MirrorReadError,
    format_hbar_from_tinybars,
    parse_account_json,
    parse_transactions_json,
)
from app.services.risk_engine import build_narrative
from app.models.schemas import Narrative, Observed

ACCOUNT = "0.0.7777"


def test_format_hbar_whole() -> None:
    assert format_hbar_from_tinybars(100_000_000) == "1"
    assert format_hbar_from_tinybars(0) == "0"


def test_format_hbar_fractional() -> None:
    assert format_hbar_from_tinybars(1_500_000) == "0.015"
    assert format_hbar_from_tinybars(1_000_000) == "0.01"


def test_parse_account_json_typed() -> None:
    state = parse_account_json(
        {"account": ACCOUNT, "balance": {"balance": 200000000, "timestamp": "2000000000.000000000"}, "tokens": []},
        ACCOUNT,
    )
    assert state.account == ACCOUNT
    assert state.balance_tinybars == 2_0000_0000
    assert state.balance_timestamp == "2000000000.000000000"
    assert state.exists is True
    assert state.token_balances_count == 0


def test_parse_account_json_rejects_bad_balance() -> None:
    with pytest.raises(MirrorReadError) as exc:
        parse_account_json({"balance": {"balance": "abc"}}, ACCOUNT)
    assert exc.value.code == "UNREADABLE_FIELD"


def test_parse_transactions_sums_in_out() -> None:
    payload = {
        "transactions": [
            {
                "consensus_timestamp": "2000000000.000000000",
                "result": "SUCCESS",
                "transfers": [{"account": ACCOUNT, "amount": 1_000_000}, {"account": "0.0.1", "amount": -1_000_000}],
            },
            {
                "consensus_timestamp": "1999999000.000000000",
                "result": "SUCCESS",
                "transfers": [{"account": ACCOUNT, "amount": -500_000}, {"account": "0.0.1", "amount": 500_000}],
            },
        ]
    }
    recent = parse_transactions_json(payload, ACCOUNT, now_seconds=2_000_000_100, window_seconds=30 * 86400)
    assert recent.hbar_in_tinybars == 1_000_000
    assert recent.hbar_out_tinybars == 500_000
    assert recent.transactions30d == 2
    assert recent.latest_consensus_timestamp == "2000000000.000000000"


def test_parse_transactions_excludes_outside_window() -> None:
    payload = {
        "transactions": [
            {"consensus_timestamp": "1000000000.000000000", "result": "SUCCESS", "transfers": []}
        ]
    }
    recent = parse_transactions_json(payload, ACCOUNT, now_seconds=2_000_000_100, window_seconds=30 * 86400)
    assert recent.transactions30d == 0


def test_narrative_uses_only_supplied_facts() -> None:
    observed = Observed(
        account={"accountId": ACCOUNT, "exists": True, "deleted": False, "createdTimestamp": "1500000000.000000000"},
        balance={"tinybars": "1000000", "hbar": "0.01", "timestamp": "2000000000.000000000", "tokenBalancesCount": 0},
        recent30d={"transactionCount": 1, "hbarInTinybars": "1000000", "hbarOutTinybars": "0", "latestTimestamp": "2000000000.000000000"},
    )
    narrative = build_narrative(observed, "1000000", "fresh")
    assert narrative.generatedBy == "deterministic"
    assert narrative.llm is False
    joined = "\n".join(narrative.points)
    assert ACCOUNT in joined
    assert "0.01 HBAR" in joined
    assert "net 0.01 HBAR" in joined
    assert "No LLM involved" in narrative.summary
    assert "Bonzo" not in joined
    assert "lending reserves active" not in joined.lower()


def test_narrative_always_deterministic_type() -> None:
    n = Narrative(generatedBy="deterministic", llm=False, summary="s", points=["p"])
    assert n.generatedBy == "deterministic"


def test_narrative_with_saucerswap() -> None:
    from app.services.saucerswap_mirror import SaucerPoolsRead
    observed = Observed(
        account={"accountId": ACCOUNT, "exists": True, "deleted": False, "createdTimestamp": "1500000000.000000000"},
        balance={"tinybars": "1000000", "hbar": "0.01", "timestamp": "2000000000.000000000", "tokenBalancesCount": 0},
        recent30d={"transactionCount": 1, "hbarInTinybars": "1000000", "hbarOutTinybars": "0", "latestTimestamp": "2000000000.000000000"},
    )
    pools_read = SaucerPoolsRead(pool_count=20, fee_tiers_seen_hundredths_bps=(500, 3000), pools=())
    narrative = build_narrative(observed, "1000000", "fresh", saucerswap_pools=pools_read)
    joined = "\n".join(narrative.points)
    assert "SaucerSwap DEX Read-Only Snapshot: 20 pools" in joined
    assert "live pool APY unavailable" in joined