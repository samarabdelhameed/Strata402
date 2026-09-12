"""API-level tests for the ai-engine FastAPI service (in-process, fake mirror)."""

from __future__ import annotations

import pytest


@pytest.mark.anyio
async def test_health_ok(client) -> None:
    res = await client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["service"] == "strata402-ai-engine"
    assert body["network"] == "hedera:testnet"


@pytest.mark.anyio
async def test_valid_contract_returns_deterministic_success(client) -> None:
    res = await client.post("/v1/strategy/yield-risk", json={
        "accountId": "0.0.7777",
        "riskTolerance": "balanced",
        "amountHbar": 100,
    })
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "success"
    analysis = body["analysis"]
    assert analysis["source"] == "hedera-mirror-node"
    assert analysis["freshnessHealth"] == "fresh"
    assert analysis["narrative"]["generatedBy"] == "deterministic"
    assert analysis["narrative"]["llm"] is False
    assert analysis["observed"]["account"]["accountId"] == "0.0.7777"
    assert "live pool APY" in analysis["unavailable"]
    assert "Bonzo data" in analysis["unavailable"]
    assert analysis.get("derivedMetrics", {}).get("bonzo", {}).get("status") != "available"
    assert "riskScore" not in analysis
    assert "confidence" not in analysis
    assert body["disclaimer"]


@pytest.mark.anyio
async def test_bonzo_pending_gate_never_fabricates_reserves(client) -> None:
    # The fake Bonzo probe returns 503 (same as the real source today). The
    # derived block must stay pending with zero reserves and a failure code.
    res = await client.post("/v1/strategy/yield-risk", json={
        "accountId": "0.0.7777",
        "riskTolerance": "balanced",
        "amountHbar": 100,
    })
    assert res.status_code == 200
    bonzo = res.json()["analysis"]["derivedMetrics"]["bonzo"]
    assert bonzo["status"] == "pending"
    assert bonzo["reservesCount"] == 0
    assert bonzo["reserves"] == []
    assert bonzo["apyStatus"] == "UNAVAILABLE"
    assert bonzo["errorCode"] == "HTTP_STATUS"
    assert "no fabricated reserves" in bonzo["note"].lower() or "pending" in bonzo["note"].lower()


@pytest.mark.anyio
async def test_bonzo_available_uses_only_wire_facts(client) -> None:
    bonzo = client.state["bonzo"]
    bonzo._fetch.available = True
    res = await client.post("/v1/strategy/yield-risk", json={
        "accountId": "0.0.7777",
        "riskTolerance": "balanced",
        "amountHbar": 100,
    })
    assert res.status_code == 200
    derived = res.json()["analysis"]["derivedMetrics"]["bonzo"]
    assert derived["status"] == "available"
    assert derived["reservesCount"] == 2
    symbols = [r["symbol"] for r in derived["reserves"]]
    assert symbols == ["HBAR", "SAUCE"]
    sauce = next(r for r in derived["reserves"] if r["symbol"] == "SAUCE")
    assert sauce["tokenId"] == "0.0.1183558"
    assert sauce["ltvPercent"] == 0.6
    # No supply_apy on the wire for SAUCE -> APY stays UNAVAILABLE per reserve.
    assert sauce.get("supplyApy") is None
    assert sauce["apyStatus"] == "UNAVAILABLE"
    hbar = next(r for r in derived["reserves"] if r["symbol"] == "HBAR")
    assert hbar["supplyApy"] == 0.04
    assert derived["apyStatus"] == "available"


@pytest.mark.anyio
async def test_invalid_contract_rejected_400_before_mirror(client) -> None:
    # The fake mirror would 500, but the contract must be checked first.
    fetch = client.state["fetch"]
    fetch.fail = True
    bad_bodies = [
        {},
        {"accountId": "not-an-account", "riskTolerance": "balanced", "amountHbar": 1},
        {"accountId": "0.0.7777", "riskTolerance": "extreme", "amountHbar": 1},
        {"accountId": "0.0.7777", "riskTolerance": "balanced", "amountHbar": 0},
        {"accountId": "0.0.7777", "riskTolerance": "balanced", "amountHbar": -5},
        {"accountId": "0.0.7777", "riskTolerance": "balanced", "amountHbar": 0.123456789},
    ]
    for body in bad_bodies:
        res = await client.post("/v1/strategy/yield-risk", json=body)
        assert res.status_code == 400, f"expected 400 for {body}"
        assert res.json()["code"] == "invalid_request_contract"
    assert fetch.calls == 0


@pytest.mark.anyio
async def test_mirror_failure_degrades_honestly(client) -> None:
    fetch = client.state["fetch"]
    fetch.fail = True
    res = await client.post("/v1/strategy/yield-risk", json={
        "accountId": "0.0.7777",
        "riskTolerance": "balanced",
        "amountHbar": 100,
    })
    assert res.status_code == 200
    body = res.json()
    analysis = body["analysis"]
    assert analysis["dataUnavailable"] is True
    assert analysis["indications"]["accountNotReadable"] is True
    assert "mirror read failed" in analysis["indications"]["reason"]
    assert analysis["narrative"]["generatedBy"] == "deterministic"
    assert analysis["narrative"]["llm"] is False
    assert "no account facts" in analysis["narrative"]["summary"]