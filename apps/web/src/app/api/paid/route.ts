import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Light availability probe — does not import x402 / Hiero SDK (those crash Next RSC via pino). */
export async function GET() {
  const env = process.env;
  const runC1 = env.STRATA402_RUN_C1 ?? "true";
  const c1Confirm = env.STRATA402_C1_CONFIRM ?? "true";
  const enabled =
    runC1 === "true" &&
    c1Confirm === "true" &&
    Boolean(env.STRATA402_PAYER_PRIVATE_KEY);
  let reason: string | null = null;
  if (!enabled) {
    if (runC1 !== "true") reason = "STRATA402_RUN_C1 is not enabled on this deployment";
    else if (c1Confirm !== "true")
      reason = "STRATA402_C1_CONFIRM is not enabled on this deployment";
    else reason = "payer private key is not configured on the server";
  }
  return NextResponse.json({
    enabled,
    reason,
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

  // Dynamic import keeps GET healthy when @x402/hedera + pino break Next's RSC loader.
  try {
    // Ensure node:diagnostics_channel tracingChannel is present when pino is evaluated in Next runtime
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const dc = require("node:diagnostics_channel");
      if (dc && typeof dc.tracingChannel !== "function") {
        dc.tracingChannel = function () {
          return {
            start: () => {},
            end: () => {},
            asyncRun: (fn: (...a: unknown[]) => unknown, ...args: unknown[]) => fn(...args),
            traceSync: (fn: (...a: unknown[]) => unknown, ...args: unknown[]) => fn(...args),
            tracePromise: (fn: (...a: unknown[]) => unknown, ...args: unknown[]) => fn(...args),
            traceCallback: (fn: (...a: unknown[]) => unknown, ...args: unknown[]) => fn(...args),
            subscribe: () => {},
            unsubscribe: () => {},
          };
        };
      }
    } catch {
      // ignore
    }

    const { runWebPaidRequest } = await import("@/lib/paid");
    const result = await runWebPaidRequest({ accountId, riskTolerance, amountHbar }, process.env);
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        code: "INTERNAL",
        message: error instanceof Error ? error.message : String(error),
        fundsOnly: false,
      },
      { status: 500 },
    );
  }
}
