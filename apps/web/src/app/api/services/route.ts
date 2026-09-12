import { NextResponse } from "next/server";
import { readGateway } from "@/lib/data";

export const dynamic = "force-dynamic";

interface GatewayService {
  id: string;
  name: string;
  description: string;
  priceTinybars: number;
  asset: string;
}

interface Integration {
  id: string;
  name: string;
  status: "available" | "pending" | "unavailable";
  note: string;
}

export async function GET() {
  const gateway = await readGateway("/v1/services");
  let integrations: Integration[] = [];

  if (gateway.ok && "body" in gateway && gateway.body) {
    const raw = gateway.body as {
      network?: string;
      payTo?: string;
      services?: GatewayService[];
    };
    integrations = (raw.services ?? []).map((s, i) => ({
      id: s.id,
      name: s.name,
      status: "available" as const,
      note: i === 0
        ? `Live on ${raw.network ?? "hedera"}. Price ${(s.priceTinybars / 1e8).toFixed(2)} HBAR per call, exact x402 settlement.`
        : `Served by the live gateway today.`,
    }));
  }

  integrations = integrations.concat(
    [
      {
        id: "saucerswap",
        name: "SaucerSwap Read-Only Adapter",
        status: "available" as const,
        note: "Keyless Testnet API (test-api.saucerswap.finance): tokens + V2 pools read-only. APY unavailable.",
      },
      {
        id: "bonzo",
        name: "Bonzo Finance Read-Only Lending",
        status: "pending" as const,
        note: "No eligible live Bonzo Testnet API wired. Not claimed as live market data.",
      },
      {
        id: "hcs-14",
        name: "HCS-14 Standardized Discovery",
        status: "pending" as const,
        note: "HCS-14 agent discovery/registry not proven live in this build. HCS audit topic is separate.",
      },
    ],
  );

  return NextResponse.json({ ok: true, body: integrations });
}
