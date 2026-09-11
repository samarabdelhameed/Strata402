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
        name: "SaucerSwap AutoSwap",
        status: "pending" as const,
        note: "Gated: requires official SaucerSwap testnet routing keys. No fabricated fills.",
      },
      {
        id: "bonzo",
        name: "Bonzo Finance Lending",
        status: "pending" as const,
        note: "Gated: requires official Bonzo testnet protocol keys. No fabricated APY.",
      },
      {
        id: "hcs-14",
        name: "HCS-14 Autonomous Economy",
        status: "pending" as const,
        note: "Gated: published on HCS audit topic, execution pending protocol rollout.",
      },
    ],
  );

  return NextResponse.json({ ok: true, body: integrations });
}