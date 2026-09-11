import { NextResponse } from "next/server";
import { readAccountFromMirror, MIRROR_BASE_URL } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId") ?? "";
  if (!/^0\.0\.\d{1,19}$/.test(accountId) || accountId === "0.0.0") {
    return NextResponse.json(
      { ok: false, error: "invalid accountId; expected 0.0.X", accountId },
      { status: 400 },
    );
  }
  const view = await readAccountFromMirror(accountId);
  return NextResponse.json({ ok: view.exists && !view.error, mirrorBaseUrl: MIRROR_BASE_URL, ...view });
}