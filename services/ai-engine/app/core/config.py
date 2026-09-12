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
    "Bonzo data",
)

LIMITATIONS = (
    "Account-level on-chain risk; protocol holdings and smart-contract "
    "risk are out of scope.",
    "Snapshot is a Mirror Node point-in-time read; not a real-time quote.",
    "SaucerSwap data is read-only snapshot; no live pool APY is claimed.",
    "Bonzo lending matrix pending: no live Bonzo Lend source proven "
    "(data.bonzo.finance probed live, currently unavailable).",
    "Not financial advice.",
)


@dataclass(frozen=True)
class Settings:
    mirror_base_url: str
    network: str
    llm_provider: str | None
    llm_model: str | None
    llm_api_key: str | None
    saucerswap_enabled: bool = True
    saucerswap_base_url: str = "https://test-api.saucerswap.finance"
    bonzo_enabled: bool = True
    bonzo_base_url: str = "https://data.bonzo.finance"


def load_settings(env: dict[str, str] | None = None) -> Settings:
    e = dict(os.environ if env is None else env)
    ss_enabled_str = e.get("SAUCERSWAP_ENABLED", "true").strip().lower()
    saucerswap_enabled = ss_enabled_str in ("1", "true", "yes", "on")
    return Settings(
        mirror_base_url=e.get("STRATA402_MIRROR_BASE_URL", DEFAULT_MIRROR_BASE_URL).strip(),
        network=e.get("STRATA402_NETWORK", "hedera:testnet").strip(),
        llm_provider=(e.get("LLM_PROVIDER") or "").strip() or None,
        llm_model=(e.get("LLM_MODEL") or "").strip() or None,
        llm_api_key=(e.get("LLM_API_KEY") or "").strip() or None,
        saucerswap_enabled=saucerswap_enabled,
        saucerswap_base_url=(
            e.get("SAUCERSWAP_API_URL")
            or e.get("SAUCERSWAP_BASE_URL")
            or "https://test-api.saucerswap.finance"
        ).strip(),
        bonzo_enabled=(
            e.get("BONZO_ENABLED", "true").strip().lower() in ("1", "true", "yes", "on")
        ),
        bonzo_base_url=(
            e.get("BONZO_API_URL") or e.get("BONZO_BASE_URL") or "https://data.bonzo.finance"
        ).strip(),
    )