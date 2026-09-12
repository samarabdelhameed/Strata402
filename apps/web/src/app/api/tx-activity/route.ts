import { NextResponse } from "next/server";
import { MIRROR_BASE_URL, readAccountActivity } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId")?.trim() || "0.0.10329902";
  const rawBuckets = Number(searchParams.get("buckets") ?? "12");
  const buckets = Number.isFinite(rawBuckets) ? Math.min(Math.max(rawBuckets, 2), 24) : 12;
  if (!/^0\.0\.\d{1,19}$/.test(accountId) || accountId === "0.0.0") {
    return NextResponse.json(
      { ok: false, error: "invalid accountId; expected 0.0.X", accountId },
      { status: 400 },
    );
  }
  const view = await readAccountActivity(accountId, buckets);
  return NextResponse.json({ ...view, mirrorBaseUrl: MIRROR_BASE_URL });
}