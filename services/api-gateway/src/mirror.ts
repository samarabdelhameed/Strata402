/**
 * Gateway Mirror Node read-only client.
 *
 * Reads account existence, balance, token balances, and recent Hbar
 * throughput from the Hedera Mirror Node REST API. All reads are keyless,
 * read-only, and return only facts published by the mirror node. No
 * transaction is ever created or submitted from this module.
 */

export const MIRROR_ACCOUNTS_PATH = "/api/v1/accounts";
export const MIRROR_TRANSACTIONS_PATH = "/api/v1/transactions";
export const DEFAULT_RECENT_WINDOW_SECONDS = 30 * 24 * 60 * 60;

export type MirrorReadErrorCode =
  | "REQUEST_FAILED"
  | "HTTP_STATUS"
  | "ACCOUNT_NOT_FOUND"
  | "MALFORMED_JSON"
  | "UNREADABLE_FIELD";

export class MirrorReadError extends Error {
  readonly code: MirrorReadErrorCode;

  constructor(code: MirrorReadErrorCode, message: string) {
    super(message);
    this.name = "MirrorReadError";
    this.code = code;
  }
}

export type MirrorFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

export interface MirrorAccountState {
  account: string;
  exists: boolean;
  deleted: boolean;
  createdTimestamp: string | null;
  balanceTinybars: bigint;
  balanceTimestamp: string | null;
  tokenBalancesCount: number;
}

export interface MirrorTransferFact {
  account: string;
  amountTinybars: bigint;
}

export interface MirrorTransactionFact {
  consensusTimestamp: string;
  result: string;
  transactionId: string;
  transfers: MirrorTransferFact[];
}

export interface MirrorRecentActivity {
  transactions30d: number;
  hbarInTinybars: bigint;
  hbarOutTinybars: bigint;
  latestConsensusTimestamp: string | null;
}

export interface MirrorAccountRead {
  accountState: MirrorAccountState;
  recentActivity: MirrorRecentActivity;
  mirrorBaseUrl: string;
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    throw new MirrorReadError("MALFORMED_JSON", `${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function nonNegativeBigint(value: unknown, label: string): bigint {
  let rawStr: string;
  if (typeof value === "string") {
    rawStr = value.trim();
  } else if (typeof value === "number") {
    rawStr = String(value);
  } else {
    throw new MirrorReadError("UNREADABLE_FIELD", `${label} must be a string or number`);
  }
  if (rawStr === "" || !/^-?\d+$/.test(rawStr)) {
    throw new MirrorReadError("UNREADABLE_FIELD", `${label} is not an integer`);
  }
  const parsed = BigInt(rawStr);
  if (parsed < 0n) {
    throw new MirrorReadError("UNREADABLE_FIELD", `${label} must not be negative`);
  }
  return parsed;
}

function maybeString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function parseSignedBigint(value: unknown, label: string): bigint {
  let raw: string;
  if (typeof value === "string") {
    raw = value.trim();
  } else if (typeof value === "number") {
    raw = String(value);
  } else {
    throw new MirrorReadError("UNREADABLE_FIELD", `${label} must be a string or number`);
  }
  if (raw === "" || !/^-?\d+$/.test(raw)) {
    throw new MirrorReadError("UNREADABLE_FIELD", `${label} is not an integer`);
  }
  return BigInt(raw);
}

function parseAccount(raw: unknown, expectedAccount: string): MirrorAccountState {
  const record = asRecord(raw, "Mirror node account");
  const account = record.account;
  if (String(account) !== expectedAccount) {
    throw new MirrorReadError("ACCOUNT_NOT_FOUND", `Mirror node returned ${String(account)}, expected ${expectedAccount}`);
  }

  const deleted = Boolean(record.deleted);
  const balance = record.balance;
  let balanceTinybars = 0n;
  let balanceTimestamp: string | null = null;
  if (balance !== null && typeof balance === "object") {
    const balanceRecord = asRecord(balance, "account.balance");
    balanceTinybars = nonNegativeBigint(balanceRecord.balance, "account.balance.balance");
    balanceTimestamp = maybeString(balanceRecord.timestamp);
  }

  let tokenBalancesCount = 0;
  if (Array.isArray(record.tokens)) {
    tokenBalancesCount = record.tokens.length;
  }

  return {
    account: String(account),
    exists: true,
    deleted,
    createdTimestamp: maybeString(record.created_timestamp),
    balanceTinybars,
    balanceTimestamp,
    tokenBalancesCount,
  };
}

export function parseTransactions(
  raw: unknown,
  targetAccount: string,
  windowSeconds: number,
  nowSeconds: number,
): MirrorRecentActivity {
  const record = asRecord(raw, "Mirror node transactions");
  const list = record.transactions;
  if (!Array.isArray(list)) {
    throw new MirrorReadError("UNREADABLE_FIELD", "transactions.transactions must be an array");
  }

  let count = 0;
  let hbarIn = 0n;
  let hbarOut = 0n;
  let latest: string | null = null;

  for (const entry of list) {
    const tx = asRecord(entry, "transaction entry");
    const consensus = maybeString(tx.consensus_timestamp);
    if (consensus === null) {
      continue;
    }
    const [secText] = consensus.split(".");
    const sec = Number(secText);
    if (Number.isNaN(sec) || sec < nowSeconds - windowSeconds) {
      continue;
    }
    count += 1;
    if (latest === null || consensus > latest) {
      latest = consensus;
    }
    const transfers = tx.transfers;
    if (Array.isArray(transfers)) {
      for (const transferEntry of transfers) {
        const transfer = asRecord(transferEntry, "transfer entry");
        if (String(transfer.account) !== targetAccount) {
          continue;
        }
        let amount: bigint;
        try {
          amount = nonNegativeBigint(transfer.amount as string | number, "transfer amount");
        } catch {
          continue;
        }
        const transferRaw = typeof transfer.amount === "string" || typeof transfer.amount === "number" ? transfer.amount : null;
        if (transferRaw === null) {
          continue;
        }
        const negative = String(transferRaw).trim().startsWith("-");
        if (negative) {
          hbarOut += amount;
        } else {
          hbarIn += amount;
        }
      }
    }
  }

  return {
    transactions30d: count,
    hbarInTinybars: hbarIn,
    hbarOutTinybars: hbarOut,
    latestConsensusTimestamp: latest,
  };
}

/** Read-only GET `/api/v1/accounts/{accountId}`. Fails closed with MirrorReadError on any non-200/404. */
export async function readMirrorAccount(
  accountId: string,
  mirrorBaseUrl: string,
  fetchFn: MirrorFetch = fetch,
): Promise<MirrorAccountState> {
  const target = `${mirrorBaseUrl}${MIRROR_ACCOUNTS_PATH}/${accountId}`;

  let res: Response;
  try {
    res = await fetchFn(target);
  } catch (cause) {
    throw new MirrorReadError("REQUEST_FAILED", `Mirror node account request failed: ${String(cause)}`);
  }

  if (res.status === 404) {
    throw new MirrorReadError("ACCOUNT_NOT_FOUND", `Account ${accountId} not found on mirror node`);
  }
  if (res.status !== 200) {
    throw new MirrorReadError("HTTP_STATUS", `Expected 200, got ${res.status}`);
  }

  const text = await res.text();
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new MirrorReadError("MALFORMED_JSON", "Mirror node account response is not valid JSON");
  }
  return parseAccount(raw, accountId);
}

/** Read-only GET `/api/v1/transactions?account.id={id}&limit={limit}&order=desc`. */
export async function readMirrorRecentActivity(
  accountId: string,
  mirrorBaseUrl: string,
  options: { windowSeconds?: number; nowSeconds?: number; limit?: number; fetchFn?: MirrorFetch } = {},
): Promise<MirrorRecentActivity> {
  const windowSeconds = options.windowSeconds ?? DEFAULT_RECENT_WINDOW_SECONDS;
  const nowSeconds = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  const limit = options.limit ?? 25;
  const fetchFn = options.fetchFn ?? fetch;

  const target =
    `${mirrorBaseUrl}${MIRROR_TRANSACTIONS_PATH}` +
    `?account.id=${encodeURIComponent(accountId)}&limit=${limit}&order=desc`;

  let res: Response;
  try {
    res = await fetchFn(target);
  } catch (cause) {
    throw new MirrorReadError("REQUEST_FAILED", `Mirror node transactions request failed: ${String(cause)}`);
  }

  if (res.status !== 200) {
    throw new MirrorReadError("HTTP_STATUS", `Expected 200, got ${res.status}`);
  }

  const text = await res.text();
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new MirrorReadError("MALFORMED_JSON", "Mirror node transactions response is not valid JSON");
  }
  return parseTransactions(raw, accountId, windowSeconds, nowSeconds);
}

/** Combined read-only account snapshot: account state + recent Hbar activity. */
export async function readMirrorAccountSnapshot(
  accountId: string,
  mirrorBaseUrl: string,
  options: { windowSeconds?: number; nowSeconds?: number; limit?: number; fetchFn?: MirrorFetch } = {},
): Promise<MirrorAccountRead> {
  const accountState = await readMirrorAccount(accountId, mirrorBaseUrl, options.fetchFn);
  const recentActivity = await readMirrorRecentActivity(accountId, mirrorBaseUrl, options);
  return { accountState, recentActivity, mirrorBaseUrl };
}

export interface MirrorTransactionDetail {
  transactionId: string;
  result: string;
  name: string;
  consensusTimestamp: string | null;
  transfers: MirrorTransferFact[];
}

function parseTransactionDetail(raw: unknown, expectedTransactionId: string): MirrorTransactionDetail {
  const record = asRecord(raw, "Mirror node transaction");
  const transactions = record.transactions;
  if (!Array.isArray(transactions) || transactions.length === 0) {
    throw new MirrorReadError("UNREADABLE_FIELD", "transactions.transactions must be a non-empty array");
  }
  for (const entry of transactions) {
    const tx = asRecord(entry, "transaction entry");
    const transactionId = maybeString(tx.transaction_id);
    if (transactionId === null || transactionId !== expectedTransactionId) {
      continue;
    }
    const result = maybeString(tx.result) ?? "UNKNOWN";
    const name = maybeString(tx.name) ?? "UNKNOWN";
    const consensusTimestamp = maybeString(tx.consensus_timestamp);
    const transfers: MirrorTransferFact[] = [];
    const transferEntries = tx.transfers;
    if (Array.isArray(transferEntries)) {
      for (const transferEntry of transferEntries) {
        const transfer = asRecord(transferEntry, "transfer entry");
        const account = maybeString(transfer.account);
        if (account === null) {
          continue;
        }
        let amount: bigint;
        try {
          amount = parseSignedBigint(transfer.amount as string | number, "transfer amount");
        } catch {
          continue;
        }
        transfers.push({ account, amountTinybars: amount });
      }
    }
    return { transactionId, result, name, consensusTimestamp, transfers };
  }
  throw new MirrorReadError("ACCOUNT_NOT_FOUND", `Transaction ${expectedTransactionId} not found on mirror node`);
}

/** Read-only GET `/api/v1/transactions/{transactionId}`. Fails closed on any non-200 or missing match. */
export async function readMirrorTransaction(
  transactionId: string,
  mirrorBaseUrl: string,
  fetchFn: MirrorFetch = fetch,
): Promise<MirrorTransactionDetail> {
  const target = `${mirrorBaseUrl}${MIRROR_TRANSACTIONS_PATH}/${encodeURIComponent(transactionId)}`;

  let res: Response;
  try {
    res = await fetchFn(target);
  } catch (cause) {
    throw new MirrorReadError("REQUEST_FAILED", `Mirror node transaction request failed: ${String(cause)}`);
  }

  if (res.status !== 200) {
    throw new MirrorReadError("HTTP_STATUS", `Expected 200, got ${res.status}`);
  }

  const text = await res.text();
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new MirrorReadError("MALFORMED_JSON", "Mirror node transaction response is not valid JSON");
  }
  return parseTransactionDetail(raw, transactionId);
}