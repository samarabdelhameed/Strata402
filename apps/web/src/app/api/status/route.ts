import { NextResponse } from "next/server";
import {
  AI_ENGINE_BASE_URL,
  GATEWAY_BASE_URL,
  HCS_AUDIT_TOPIC_ID,
  MIRROR_BASE_URL,
  readAiEngineHealth,
  readGateway,
  readHealth,
} from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  const [health, services, aiEngine] = await Promise.all([
    readHealth(),
    readGateway("/v1/services"),
    readAiEngineHealth(),
  ]);
  const mirrorOk = await fetch(`${MIRROR_BASE_URL}/api/v1/accounts/0.0.2`, {
    cache: "no-store",
    signal: AbortSignal.timeout(4000),
  })
    .then((r) => r.ok)
    .catch(() => false);

  return NextResponse.json({
    gateway: { baseUrl: GATEWAY_BASE_URL, ok: health.ok, health },
    aiEngine: { baseUrl: AI_ENGINE_BASE_URL, ok: aiEngine.ok, health: aiEngine },
    mirror: { baseUrl: MIRROR_BASE_URL, ok: mirrorOk },
    hcs: { topicId: HCS_AUDIT_TOPIC_ID, configured: HCS_AUDIT_TOPIC_ID !== "" },
    services,
  });
}