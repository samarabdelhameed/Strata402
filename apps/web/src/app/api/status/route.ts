import { NextResponse } from "next/server";
import { readHealth, readGateway, GATEWAY_BASE_URL } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  const [health, services] = await Promise.all([readHealth(), readGateway("/v1/services")]);
  return NextResponse.json({
    gateway: { baseUrl: GATEWAY_BASE_URL, ok: health.ok, health },
    services,
  });
}