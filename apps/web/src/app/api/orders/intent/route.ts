import { NextResponse } from "next/server";
import {
  buildIntentMessage,
  isIntentPublishAvailable,
  publishLimitOrderIntent,
} from "@/lib/hcs";

export const dynamic = "force-dynamic";

const DEFAULT_ACCOUNT = "0.0.10329902";

export async function GET() {
  const avail = isIntentPublishAvailable(process.env);
  return NextResponse.json({
    enabled: avail.enabled,
    reason: avail.enabled ? null : (avail.reason ?? "closed"),
  });
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