import { NextResponse } from "next/server";
import { runWebPaidRequest, isC1Available } from "@/lib/paid";

export const dynamic = "force-dynamic";

export async function GET() {
  const avail = isC1Available(process.env);
  return NextResponse.json({
    enabled: avail.enabled,
    reason: avail.enabled ? null : (avail.reason ?? "closed"),
    priceTinybars: "1000000",
    priceDisplay: "0.01 HBAR",
  });
}

export async function POST(request: Request) {
  let input: { accountId?: unknown; riskTolerance?: unknown; amountHbar?: unknown };
  try {
    input = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, code: "CONTRACT", message: "request body must be JSON", fundsOnly: false },
      { status: 400 },
    );
  }
  const accountId = typeof input.accountId === "string" ? input.accountId : "";
  const riskTolerance = typeof input.riskTolerance === "string" ? input.riskTolerance : "";
  const amountHbar =
    typeof input.amountHbar === "number" && Number.isFinite(input.amountHbar)
      ? input.amountHbar
      : null;

  if (!/^0\.0\.\d{1,19}$/.test(accountId) || accountId === "0.0.0") {
    return NextResponse.json(
      { ok: false, code: "CONTRACT", message: "invalid accountId; expected 0.0.X", fundsOnly: false },
      { status: 400 },
    );
  }

  const result = await runWebPaidRequest({ accountId, riskTolerance, amountHbar }, process.env);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}