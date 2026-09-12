import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const DEFAULT_ACCOUNT = "0.0.10329902";

/** Light availability probe — avoids loading @hiero-ledger/sdk (pino) on GET. */
export async function GET() {
  const env = process.env;
  const topic = env.HCS_AUDIT_TOPIC_ID?.trim() ?? "";
  const account = env.STRATA402_PAYER_ACCOUNT_ID?.trim() ?? "";
  const key = env.STRATA402_PAYER_PRIVATE_KEY?.trim() ?? "";
  const enabled = Boolean(topic && account && key);
  let reason: string | null = null;
  if (!enabled) {
    if (!topic) reason = "HCS_AUDIT_TOPIC_ID is not configured on the server";
    else if (!account) reason = "payer account is not configured on the server";
    else reason = "payer private key is not configured on the server";
  }
  return NextResponse.json({ enabled, reason });
}

export async function POST(request: Request) {
  let input: {
    side?: unknown;
    pair?: unknown;
    targetPriceUsdc?: unknown;
    amountHbar?: unknown;
    expiryDays?: unknown;
    accountId?: unknown;
  };
  try {
    input = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, reason: "CONTRACT", error: "request body must be JSON", messageType: "autoswap-limit" },
      { status: 400 },
    );
  }

  const side = input.side === "sell" ? "sell" : "buy";
  const pair = typeof input.pair === "string" && input.pair.trim() !== "" ? input.pair : "HBAR/USDC";
  const rawPrice = typeof input.targetPriceUsdc === "string" ? input.targetPriceUsdc : "";
  const targetPriceUsdc = /^\d{1,8}(\.\d{1,8})?$/.test(rawPrice) ? rawPrice : "";
  const rawAmount =
    typeof input.amountHbar === "number"
      ? String(input.amountHbar)
      : typeof input.amountHbar === "string"
        ? input.amountHbar.replace(/,/g, "")
        : "";
  const amountHbar = /^\d+(\.\d{1,8})?$/.test(rawAmount) ? Number(rawAmount) : NaN;
  const expiryDays = input.expiryDays === 30 || input.expiryDays === 0 ? input.expiryDays : 7;
  const accountId =
    typeof input.accountId === "string" && input.accountId.trim() !== ""
      ? input.accountId.trim()
      : DEFAULT_ACCOUNT;

  if (targetPriceUsdc === "") {
    return NextResponse.json(
      {
        ok: false,
        reason: "CONTRACT",
        error: "invalid targetPriceUsdc; expected a positive decimal",
        messageType: "autoswap-limit",
      },
      { status: 400 },
    );
  }
  if (!Number.isFinite(amountHbar) || amountHbar <= 0) {
    return NextResponse.json(
      {
        ok: false,
        reason: "CONTRACT",
        error: "invalid amountHbar; expected a positive number",
        messageType: "autoswap-limit",
      },
      { status: 400 },
    );
  }

  const { buildIntentMessage, publishLimitOrderIntent } = await import("@/lib/hcs");
  const message = buildIntentMessage({
    side,
    pair,
    targetPriceUsdc,
    amountHbar,
    expiryDays,
    accountId,
  });

  const result = await publishLimitOrderIntent(message, process.env);
  return NextResponse.json(result, { status: result.published ? 200 : 502 });
}
