import {
  ENV_ALLOWED_PAYTO,
  ENV_FACILITATOR_URL,
  ENV_MIRROR_BASE_URL,
  ENV_RUN_C0,
  PreflightError,
  runPreflight,
  type PreflightErrorCode,
} from "./preflight";
import { SafetyConfigError, type EnvLike } from "./config";

/**
 * Phase 4.4-C0 — C0 Preflight CLI.
 *
 * Closed by default: unless `STRATA402_RUN_C0=true` the CLI prints a closed
 * message and exits 0 without touching the network. When explicitly enabled
 * it performs ONLY the approved read-only C0 steps (discovery, unpaid 402,
 * facilitator /supported, mirror payer check) and never sends any payment
 * signature, never verifies/settles, never spends, and never prints secrets.
 *
 * Exit codes:
 * - 0: C0 passed (or C0 is closed — nothing was attempted).
 * - 1: a read-only preflight step failed.
 * - 2: misconfiguration (invalid config, or a required explicit URL is missing).
 */

export const EXIT_OK = 0;
export const EXIT_PREFLIGHT_FAILED = 1;
export const EXIT_MISCONFIG = 2;

export function isC0Enabled(env: EnvLike = process.env): boolean {
  return env[ENV_RUN_C0] === "true";
}

function isMisconfig(error: unknown): boolean {
  if (error instanceof PreflightError) {
    const code = error.code as PreflightErrorCode;
    return code === "CONFIG" || code === "FACILITATOR_URL_MISSING" || code === "MIRROR_URL_MISSING";
  }
  return error instanceof SafetyConfigError;
}

export async function runCliC0(env: EnvLike = process.env): Promise<number> {
  if (!isC0Enabled(env)) {
    console.log(
      `C0 preflight is closed by default. Set ${ENV_RUN_C0}=true to allow the read-only preflight.`,
    );
    return EXIT_OK;
  }

  try {
    const report = await runPreflight({ env });
    console.log(JSON.stringify(report, null, 2));
    return EXIT_OK;
  } catch (error) {
    const exitCode = isMisconfig(error) ? EXIT_MISCONFIG : EXIT_PREFLIGHT_FAILED;
    const name = error instanceof Error ? error.name : "UnknownError";
    const code = error instanceof Error ? ((error as { code?: string }).code ?? null) : null;
    console.error(
      JSON.stringify({ phase: "C0-preflight", status: "failed", name, code, message: String(error instanceof Error ? error.message : error) }),
    );
    return exitCode;
  }
}

if (import.meta.main) {
  runCliC0().then((code) => process.exit(code));
}