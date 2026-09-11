/**
 * Strata402 web — server-side x402 paid request runner.
 *
 * Delegates to the SAME verified consuming-agent implementation that the
 * project's own e2e test uses (`runC1`), passing the requested yield-risk body
 * through as `requestBody`. The gateway runs on :8080 and the buyer (payer
 * key) is the project's real funded testnet account, held server-side in env.
 * No secrets ever reach the browser; nothing is ever mocked.
 */

import { runC1 } from "@strata402/consuming-agent";
import { buildYieldRiskRequestBody } from "@strata402/consuming-agent/yield-risk-request";
import { GATEWAY_BASE_URL } from "./data";

export interface WebPaidRequestInput {
  accountId: string;
  riskTolerance: string;
  amountHbar: number | null;
}

export interface WebPaidResultOk {
  ok: true;
  phase: string;
  httpStatus: number | null;
  paymentStatus: string | null;
  paymentTxId: string | null;
  settlement: {
    verified: boolean;
    transactionId: string;
    result: string;
    payerAccountId: string;
    recipientAccountId: string;
    amountTinybars: string;
    consensusTimestamp: string | null;
  } | null;
  serviceUrl: string;
  mirrorBaseUrl: string;
}

export interface WebPaidResultError {
  ok: false;
  code: string;
  message: string;
  fundsOnly: boolean;
}

export type WebPaidResult = WebPaidResultOk | WebPaidResultError;

export function isC1Available(env: NodeJS.ProcessEnv = process.env): {
  enabled: boolean;
  reason?: string;
} {
  if (env.STRATA402_RUN_C1 !== "true") {
    return { enabled: false, reason: "STRATA402_RUN_C1 is not enabled on this deployment" };
  }
  if (env.STRATA402_C1_CONFIRM !== "true") {
    return { enabled: false, reason: "STRATA402_C1_CONFIRM is not enabled on this deployment" };
  }
  if (!env.STRATA402_PAYER_PRIVATE_KEY) {
    return { enabled: false, reason: "payer private key is not configured on the server" };
  }
  return { enabled: true };
}

/**
 * Runs a REAL one-shot paid x402 request (exact scheme, 0.01 HBAR) against the
 * live gateway for the requested yield-risk body, then verifies settlement via
 * the public Mirror Node. Returns honest evidence — never mocks and never
 * fabricates settlement.
 */
export async function runWebPaidRequest(
  input: WebPaidRequestInput,
  env: NodeJS.ProcessEnv = process.env,
): Promise<WebPaidResult> {
  const avail = isC1Available(env);
  if (!avail.enabled) {
    return {
      ok: false,
      code: "CLOSED_REQUIRED",
      message: avail.reason ?? "paid analysis is closed on this deployment",
      fundsOnly: false,
    };
  }

  let body: string;
  try {
    body = buildYieldRiskRequestBody({
      accountId: input.accountId,
      riskTolerance:
        input.riskTolerance === "conservative" ||
        input.riskTolerance === "aggressive" ||
        input.riskTolerance === "balanced"
          ? input.riskTolerance
          : undefined,
      amountHbar: input.amountHbar ?? undefined,
      env,
    });
  } catch (error) {
    return {
      ok: false,
      code: "CONTRACT",
      message: error instanceof Error ? error.message : String(error),
      fundsOnly: false,
    };
  }

  try {
    const report = await runC1({
      env,
      serviceUrl: GATEWAY_BASE_URL,
      confirmed: true,
      requestBody: body,
    });

    if (report.status === "awaiting-confirm") {
      return {
        ok: false,
        code: "CONFIRM_REQUIRED",
        message: "the runner refused to send without an explicit confirmation",
        fundsOnly: false,
      };
    }
    if (report.status !== "success" || report.evidence === null) {
      return {
        ok: false,
        code: "PAYMENT_FAILED",
        message: `C1 status=${report.status}; no settlement evidence produced`,
        fundsOnly: true,
      };
    }

    const evidencePaymentTxId =
      typeof report.settlement?.transactionId === "string"
        ? report.settlement.transactionId
        : null;

    return {
      ok: true,
      phase: report.phase,
      httpStatus: report.evidence.httpStatus ?? null,
      paymentStatus: report.evidence.paymentStatus ?? null,
      paymentTxId: evidencePaymentTxId,
      settlement: report.settlement
        ? {
            verified: report.settlement.verified,
            transactionId: report.settlement.transactionId,
            result: report.settlement.result,
            payerAccountId: report.settlement.payerAccountId,
            recipientAccountId: report.settlement.recipientAccountId,
            amountTinybars: report.settlement.amountTinybars,
            consensusTimestamp: report.settlement.consensusTimestamp,
          }
        : null,
      serviceUrl: report.serviceUrl,
      mirrorBaseUrl: report.mirrorBaseUrl,
    };
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code?: string }).code)
        : "INTERNAL";
    const message = error instanceof Error ? error.message : String(error);
    const fundsOnly = ["PAYMENT", "SETTLE", "BUDGET"].some((k) =>
      code.toUpperCase().includes(k),
    );
    return { ok: false, code, message, fundsOnly };
  }
}