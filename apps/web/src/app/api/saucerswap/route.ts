import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SAUCER_BASE = (
  process.env.SAUCERSWAP_API_URL ||
  process.env.SAUCERSWAP_BASE_URL ||
  "https://test-api.saucerswap.finance"
).replace(/\/$/, "");

export async function GET() {
  try {
    const [poolsRes, tokensRes] = await Promise.all([
      fetch(`${SAUCER_BASE}/v2/pools/full`, {
        headers: { accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      }).catch(() => null),
      fetch(`${SAUCER_BASE}/tokens`, {
        headers: { accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      }).catch(() => null),
    ]);

    let pools: Array<Record<string, unknown>> = [];
    if (poolsRes && poolsRes.ok) {
      const data = await poolsRes.json();
      if (Array.isArray(data)) {
        pools = data.slice(0, 10).map((p: Record<string, unknown>) => {
          const tokenA = (p.tokenA as Record<string, unknown>) || {};
          const tokenB = (p.tokenB as Record<string, unknown>) || {};
          const fee = Number(p.fee) || 0;
          return {
            id: p.id,
            contractId: p.contractId,
            pair: `${tokenA.symbol || "unknown"}/${tokenB.symbol || "unknown"}`,
            feeTierPercent: (fee / 10000).toFixed(2) + "%",
            liquidity: String(p.liquidity || "0"),
            tokenA: { symbol: tokenA.symbol, id: tokenA.id },
            tokenB: { symbol: tokenB.symbol, id: tokenB.id },
            apyStatus: "UNAVAILABLE (Wire data carries no fee-earnings history)",
          };
        });
      }
    }

    let tokenCount = 0;
    if (tokensRes && tokensRes.ok) {
      const tokensData = await tokensRes.json();
      if (Array.isArray(tokensData)) {
        tokenCount = tokensData.length;
      }
    }

    return NextResponse.json({
      ok: true,
      readOnly: true,
      network: "hedera:testnet",
      source: SAUCER_BASE,
      tokenCount,
      poolCount: pools.length,
      pools,
      apyStatus: "UNAVAILABLE",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
