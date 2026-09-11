import { NextResponse } from "next/server";
import { readHcsAuditMessages, MIRROR_BASE_URL } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawLimit = Number(searchParams.get("limit") ?? "25");
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 25;
  const read = await readHcsAuditMessages(limit);
  return NextResponse.json({
    ...read,
    mirrorBaseUrl: MIRROR_BASE_URL,
  });
}