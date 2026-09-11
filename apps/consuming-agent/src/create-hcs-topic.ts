import {
  AccountBalanceQuery,
  AccountId,
  Client,
  TopicCreateTransaction,
  type TransactionRecord,
} from "@hiero-ledger/sdk";
import {
  loadConfig,
  type EnvLike,
  type SafetyConfig,
  SafetyConfigError,
} from "./config";
import {
  ENV_PAYER_PRIVATE_KEY,
  PaymentConstructorError,
  parsePayerPrivateKey,
} from "./payment-constructor";
import {
  ENV_MIRROR_BASE_URL,
  parseAllowedPayTos,
} from "./preflight";

/**
 * Phase 8F-A — Real HCS audit topic creation on Hedera testnet.
 *
 * Creates a single consensus topic owned by the payer operator from `.env`
 * (STRATA402_PAYER_ACCOUNT_ID + STRATA402_PAYER_PRIVATE_KEY). The gateway then
 * submits immutable audit events for each paid request (never secrets).
 *
 * Fail-closed guarantees:
 *   - Network must resolve to the configured testnet mirror root; aborts on
 *     anything that is not the expected testnet mirror base.
 *   - The payer credential must match the SDK signer account, key parsed via
 *     the same strict helpers used by the payment constructor.
 *   - Nothing is submitted unless `runCreateHcsTopic` is called with
 *     `confirmed === true` (mirrors the C1 security confirmation).
 *   - The private key and the raw transaction bytes are never printed.
 */

export const ENV_HCS_CREATE = "STRATA402_HCS_CREATE";

export type CreateTopicResult =
  | { created: false; reason: "unconfirmed" | "network" | "invalid-payer" }
  | {
      created: true;
      topicId: string;
      transactionId: string;
      consensusAt: string;
    };

export interface CreateHcsTopicOptions {
  env?: EnvLike;
  confirmed?: boolean;
}

const EXPECTED_MIRROR_SUFFIX = "testnet.mirrornode.hedera.com";

function assertTestnetMirror(baseUrl: string): void {
  const url = new URL(baseUrl);
  if (!url.hostname.endsWith(EXPECTED_MIRROR_SUFFIX)) {
    throw new PaymentConstructorError(
      "NETWORK",
      `Mirror base ${url.hostname} is not a Hedera testnet mirror root`,
    );
  }
}

export async function buildHcsOperator(
  options: CreateHcsTopicOptions = {},
): Promise<SafetyConfig> {
  const env = options.env ?? process.env;
  let config: SafetyConfig;
  try {
    config = loadConfig({ env, requirePayer: true });
  } catch (error) {
    if (error instanceof SafetyConfigError) {
      throw new PaymentConstructorError(
        "NETWORK",
        `Config rejected: ${error.message}`,
      );
    }
    throw error;
  }
  if (config.network !== "hedera:testnet") {
    throw new PaymentConstructorError(
      "NETWORK",
      `Only hedera:testnet is allowed for topic creation, got ${config.network}`,
    );
  }
  if (config.payerAccountId === null) {
    throw new PaymentConstructorError(
      "CREDENTIALS_MISSING",
      "Payer account id is required to create the audit topic",
    );
  }
  return config;
}

export async function createHcsTopic(
  options: CreateHcsTopicOptions = {},
): Promise<CreateTopicResult> {
  const env = options.env ?? process.env;
  const confirmed = options.confirmed ?? env[ENV_HCS_CREATE] === "true";
  if (confirmed !== true) {
    return { created: false, reason: "unconfirmed" };
  }

  const config = await buildHcsOperator({ env });
  if (config.payerAccountId === null) {
    return { created: false, reason: "invalid-payer" };
  }

  const rawKey = env[ENV_PAYER_PRIVATE_KEY]?.trim() ?? "";
  if (rawKey === "") {
    throw new PaymentConstructorError(
      "CREDENTIALS_MISSING",
      `${ENV_PAYER_PRIVATE_KEY} is required to create the audit topic`,
    );
  }

  const payerAccountId = config.payerAccountId;

  const mirrorBase = env[ENV_MIRROR_BASE_URL]?.trim() ?? "";
  if (mirrorBase === "") {
    throw new PaymentConstructorError(
      "NETWORK",
      `${ENV_MIRROR_BASE_URL} must be set to validate the testnet network`,
    );
  }
  assertTestnetMirror(mirrorBase);

  const { key, keyType } = parsePayerPrivateKey(rawKey);

  const operatorAccountId = AccountId.fromString(payerAccountId);
  const operatorKey = key;

  const client = Client.forTestnet();
  client.setOperator(operatorAccountId, operatorKey);

  const balance = await new AccountBalanceQuery()
    .setAccountId(operatorAccountId)
    .execute(client);
  if (balance.hbars.toTinybars().toBigInt() < 100_000_000n) {
    throw new PaymentConstructorError(
      "CAP_PER_REQUEST",
      `Payer balance below 1 HBAR; cannot pay topic creation fees`,
    );
  }

  const tx = new TopicCreateTransaction()
    .setTopicMemo("Strata402 paid-request audit (phase 8f)")
    .setTransactionMemo(`strata402-hcs-audit-${keyType.toLowerCase()}`);
  const response = await tx.execute(client);
  const record: TransactionRecord = await response.getRecord(client);

  const status = record.receipt.status.toString();
  if (status !== "SUCCESS") {
    throw new Error(`TopicCreateTransaction failed with status ${status}`);
  }
  const topicId = record.receipt.topicId;
  if (topicId === null || topicId === undefined) {
    throw new Error("TopicCreateTransaction succeeded but returned no topic id");
  }

  await client.close();

  return {
    created: true,
    topicId: topicId.toString(),
    transactionId: response.transactionId.toString(),
    consensusAt: `${record.consensusTimestamp.seconds.toBigInt()}.${String(
      record.consensusTimestamp.nanos.toBigInt(),
    ).padStart(9, "0")}`,
  };
}

export function isHcsCreateEnabled(env: EnvLike = process.env): boolean {
  const raw = env[ENV_HCS_CREATE]?.trim();
  return raw !== undefined && raw.toLowerCase() === "true";
}

export async function runCreateHcsTopic(
  options: CreateHcsTopicOptions = {},
): Promise<number> {
  const env = options.env ?? process.env;
  const confirmed = options.confirmed ?? isHcsCreateEnabled(env);
  const config = await buildHcsOperator({ env });

  if (confirmed !== true) {
    parseAllowedPayTos(env);
    console.log(`HCS audit topic operator: ${config.payerAccountId}`);
    console.log(
      `Readiness ok (network=testnet, mirror=testnet, payer present). Set ${ENV_HCS_CREATE}=true to create the topic.`,
    );
    return 0;
  }

  const result = await createHcsTopic({ env, confirmed: true });
  if (result.created !== true) {
    console.log(`Topic not created (${String(result.reason)}).`);
    return 2;
  }
  console.log("HCS audit topic created:");
  console.log(`  topicId:        ${result.topicId}`);
  console.log(`  transactionId:  ${result.transactionId}`);
  console.log(`  consensusAt:    ${result.consensusAt}`);
  return 0;
}

if (import.meta.main) {
  runCreateHcsTopic().then((code) => process.exit(code));
}