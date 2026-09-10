/**
 * Phase 4.4-C0 — Mirror Node Read-Only Payer Account Check.
 *
 * Runs a single read-only GET against the Hedera mirror node for the payer
 * account and reports account existence and readable balance. This is a
 * readiness preflight only.
 *
 * Scope (approved for C0):
 * - Never prints or exposes private keys, raw credentials, or signatures.
 * - A readable balance is a preflight check, NOT approval to spend.
 * - Never creates or submits any Hedera transaction.
 */

export const MIRROR_ACCOUNTS_PATH = "/api/v1/accounts";

export type MirrorReadErrorCode =
  | "REQUEST_FAILED"
  | "HTTP_STATUS"
  | "ACCOUNT_NOT_FOUND"
  | "BALANCE_UNREADABLE"
  | "MALFORMED_JSON";

export class MirrorReadError extends Error {
  readonly code: MirrorReadErrorCode;

  constructor(code: MirrorReadErrorCode, message: string) {
    super(message);
    this.name = "MirrorReadError";
    this.code = code;
  }
}

export type MirrorFetch = typeof fetch;

export interface PayerAccountRead {
  account: string;
  exists: true;
  balanceTinybars: bigint;
  balanceTimestamp: string | null;
  mirrorBaseUrl: string;
}

export function parseAccountJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new MirrorReadError("MALFORMED_JSON", "Mirror node response is not valid JSON");
  }
}

function parseBalanceTinybars(value: unknown): bigint {
  let rawStr: string;
  if (typeof value === "string") {
    rawStr = value.trim();
  } else if (typeof value === "number") {
    rawStr = String(value);
  } else {
    throw new MirrorReadError("BALANCE_UNREADABLE", "account.balance.balance must be a string or number");
  }
  if (rawStr === "" || !/^\d+$/.test(rawStr)) {
    throw new MirrorReadError("BALANCE_UNREADABLE", "account.balance.balance is not a non-negative integer");
  }
  const parsed = BigInt(rawStr);
  if (parsed < 0n) {
    throw new MirrorReadError("BALANCE_UNREADABLE", "account balance must not be negative");
  }
  return parsed;
}

export function readPayerAccount(raw: unknown, expectedAccount: string): PayerAccountRead {
  if (typeof raw !== "object" || raw === null) {
    throw new MirrorReadError("MALFORMED_JSON", "Mirror node account must be a JSON object");
  }
  const record = raw as Record<string, unknown>;

  const account = record.account;
  if (account !== expectedAccount) {
    throw new MirrorReadError(
      "ACCOUNT_NOT_FOUND",
      `Mirror node returned account ${String(account)}, expected ${expectedAccount}`,
    );
  }

  const balance = record.balance;
  if (typeof balance !== "object" || balance === null) {
    throw new MirrorReadError("BALANCE_UNREADABLE", "account.balance must be an object");
  }

  const balanceTinybars = parseBalanceTinybars((balance as Record<string, unknown>).balance);
  const rawTimestamp = (balance as Record<string, unknown>).timestamp;
  const balanceTimestamp =
    typeof rawTimestamp === "string" && rawTimestamp.trim() !== "" ? rawTimestamp : null;

  return {
    account,
    exists: true,
    balanceTinybars,
    balanceTimestamp,
    mirrorBaseUrl: "",
  };
}

/**
 * Read-only mirror node GET `/api/v1/accounts/{payerAccountId}`. Confirms the
 * payer account exists and exposes a readable balance. No transaction is ever
 * created or submitted.
 */
export async function fetchPayerAccount(
  payerAccountId: string,
  mirrorBaseUrl: string,
  fetchFn: MirrorFetch = fetch,
): Promise<PayerAccountRead> {
  const target = `${mirrorBaseUrl}${MIRROR_ACCOUNTS_PATH}/${payerAccountId}`;

  let res: Response;
  try {
    res = await fetchFn(target);
  } catch (cause) {
    throw new MirrorReadError("REQUEST_FAILED", `Mirror node request failed: ${String(cause)}`);
  }

  if (res.status === 404) {
    throw new MirrorReadError("ACCOUNT_NOT_FOUND", `Payer account ${payerAccountId} not found on mirror node`);
  }
  if (res.status !== 200) {
    throw new MirrorReadError("HTTP_STATUS", `Expected 200, got ${res.status}`);
  }

  const text = await res.text();
  const raw = parseAccountJson(text);
  const read = readPayerAccount(raw, payerAccountId);
  return { ...read, mirrorBaseUrl };
}