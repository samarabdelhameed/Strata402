import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BONZO_BASE = (
  process.env.BONZO_API_URL ||
  process.env.BONZO_BASE_URL ||
  "https://data.bonzo.finance"
).replace(/\/$/, "");

interface WireReserve {
  symbol?: unknown;
  name?: unknown;
  hts_address?: unknown;
  ltv?: unknown;
  liquidation_threshold?: unknown;
  reserve_factor?: unknown;
  variable_borrowing_enabled?: unknown;
  active?: unknown;
  frozen?: unknown;
  supply_apy?: unknown;
  variable_borrow_apy?: unknown;
  utilization_rate?: unknown;
}

function num(v: unknown): number | null {
  if (typeof v === "boolean" || v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function bool(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
}

function str(v: unknown): string | null {
  if (v === null || v === undefined || typeof v === "boolean") return null;
  const s = typeof v === "string" ? v : String(v);
  const t = s.trim();
  return t === "" ? null : t;
}

export async function GET() {
  let status = 0;
  let payload: unknown = null;
  try {
    const res = await fetch(`${BONZO_BASE}/market`, {
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    status = res.status;
    if (res.ok) payload = await res.json();
  } catch (error) {
    return NextResponse.json({
      ok: false,
      status: "pending",
      readOnly: true,
      protocol: "Bonzo Finance",
      source: BONZO_BASE,
      reservesCount: 0,
      reserves: [],
      apyStatus: "UNAVAILABLE",
      errorCode: "REQUEST_FAILED",
      message: `Bonzo Lend probe failed (${error instanceof Error ? error.message : String(error)}). No fabricated reserves.`,
    });
  }

  if (status !== 200 || !payload) {
    return NextResponse.json({
      ok: false,
      status: "pending",
      readOnly: true,
      protocol: "Bonzo Finance",
      source: BONZO_BASE,
      reservesCount: 0,
      reserves: [],
      apyStatus: "UNAVAILABLE",
      errorCode: "HTTP_STATUS",
      message: `Bonzo Lend /market returned HTTP ${status || "n/a"}. Lending matrix stays pending; no fabricated reserves.`,
    });
  }

  const data = payload as { reserves?: unknown; timestamp?: unknown };
  if (!Array.isArray(data?.reserves) || data.reserves.length === 0) {
    return NextResponse.json({
      ok: false,
      status: "pending",
      readOnly: true,
      protocol: "Bonzo Finance",
      source: BONZO_BASE,
      reservesCount: 0,
      reserves: [],
      apyStatus: "UNAVAILABLE",
      errorCode: "EMPTY_RESERVES",
      message: "Bonzo Lend /market returned no usable reserves. Nothing claimed.",
    });
  }

  const reserves = (data.reserves as WireReserve[])
    .map((r) => {
      const tokenId = str(r.hts_address);
      const symbol = str(r.symbol);
      if (!tokenId || !symbol) return null;
      const supplyApy = num(r.supply_apy);
      const borrowApy = num(r.variable_borrow_apy);
      const reserve: Record<string, unknown> = {
        symbol,
        name: str(r.name),
        tokenId,
        ltvPercent: num(r.ltv),
        liquidationThresholdPercent: num(r.liquidation_threshold),
        reserveFactorPercent: num(r.reserve_factor),
        borrowEnabled: bool(r.variable_borrowing_enabled),
        active: bool(r.active),
        frozen: bool(r.frozen),
        utilizationRate: num(r.utilization_rate),
        apyStatus: supplyApy !== null ? "available" : "UNAVAILABLE",
      };
      if (supplyApy !== null) reserve.supplyApy = supplyApy;
      if (borrowApy !== null) reserve.variableBorrowApy = borrowApy;
      return reserve;
    })
    .filter((r): r is Record<string, unknown> => r !== null);

  const apyLive = reserves.some((r) => typeof r.supplyApy === "number");

  return NextResponse.json({
    ok: true,
    status: "available",
    readOnly: true,
    protocol: "Bonzo Finance",
    source: BONZO_BASE,
    network: "hedera",
    reservesCount: reserves.length,
    reserves,
    apyStatus: apyLive ? "available" : "UNAVAILABLE",
    fetchedAt: str(data.timestamp),
    message:
      "Live Bonzo Lend /market read; wire facts only. APY reported only when published by the source.",
  });
}