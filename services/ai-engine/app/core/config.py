"""Strata402 ai-engine — core configuration and shared constants."""

from __future__ import annotations

import os
from dataclasses import dataclass

TINYBARS_PER_HBAR = 100_000_000

DISCLAIMER = (
    "Not financial advice. Deterministic account-level analysis from Hedera "
    "Mirror Node data only; no fabricated metrics."
)

SERVICE_NAME = "strata402-ai-engine"
ANALYSIS_SOURCE = "hedera-mirror-node"
ANALYSIS_SCOPE = "account-level on-chain risk"

DEFAULT_MIRROR_BASE_URL = "https://testnet.mirrornode.hedera.com"
DEFAULT_STALE_AFTER_SECONDS = 24 * 60 * 60
DEFAULT_RECENT_WINDOW_SECONDS = 30 * 24 * 60 * 60

RISK_TOLERANCE_VALUES = ("conservative", "balanced", "aggressive")

UNVAILABLE_FEATURES = (
    "live pool APY",
    "protocol liquidity",
    "smart-contract risk",
    "SaucerSwap data",
    "Bonzo data",
)

LIMITATIONS = (
    "Account-level on-chain risk only; protocol holdings and smart-contract "
    "risk are out of scope.",
    "Snapshot is a Mirror Node point-in-time read; not a real-time quote.",
    "No live pool APY or liquidity data is claimed for any protocol.",
    "Not financial advice.",
)


@dataclass(frozen=True)
class Settings:
    mirror_base_url: str
    network: str
    llm_provider: str | None
    llm_model: str | None
    llm_api_key: str | None


def load_settings(env: dict[str, str] | None = None) -> Settings:
    e = dict(os.environ if env is None else env)
    return Settings(
        mirror_base_url=e.get("STRATA402_MIRROR_BASE_URL", DEFAULT_MIRROR_BASE_URL).strip(),
        network=e.get("STRATA402_NETWORK", "hedera:testnet").strip(),
        llm_provider=(e.get("LLM_PROVIDER") or "").strip() or None,
        llm_model=(e.get("LLM_MODEL") or "").strip() or None,
        llm_api_key=(e.get("LLM_API_KEY") or "").strip() or None,
    )