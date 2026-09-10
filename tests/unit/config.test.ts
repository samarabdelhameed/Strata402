import { test, expect } from "bun:test";
import {
  ALLOWED_ASSET,
  DEFAULT_MAX_PER_REQUEST_TINYBARS,
  DEFAULT_MAX_TOTAL_BUDGET_TINYBARS,
  DEFAULT_NETWORK,
  ENV_MAX_PER_REQUEST,
  ENV_MAX_TOTAL_BUDGET,
  ENV_NETWORK,
  ENV_PAYER_ACCOUNT_ID,
  MAX_SUPPORTED_PER_REQUEST_TINYBARS,
  MAX_SUPPORTED_TOTAL_BUDGET_TINYBARS,
  SafetyConfigError,
  loadConfig,
} from "@strata402/consuming-agent";
import type { SafetyConfigErrorCode, EnvLike } from "@strata402/consuming-agent";

function rejectsWith(
  runner: () => unknown,
  code: SafetyConfigErrorCode,
): void {
  try {
    runner();
  } catch (err) {
    expect(err).toBeInstanceOf(SafetyConfigError);
    expect((err as SafetyConfigError).code).toBe(code);
    return;
  }
  throw new Error(`expected SafetyConfigError code=${code}, but no error was thrown`);
}

test("loadConfig applies safe defaults with an empty environment", () => {
  const config = loadConfig({ env: {} });

  expect(config.network).toBe(DEFAULT_NETWORK);
  expect(config.network).toBe("hedera:testnet");
  expect(config.maxPerRequestTinybars).toBe(DEFAULT_MAX_PER_REQUEST_TINYBARS);
  expect(config.maxTotalBudgetTinybars).toBe(DEFAULT_MAX_TOTAL_BUDGET_TINYBARS);
  expect(config.payerAccountId).toBeNull();
});

test("discovery mode does not require a payer account", () => {
  const config = loadConfig({ env: {} });
  expect(config.payerAccountId).toBeNull();
  expect(config.network).toBe("hedera:testnet");
});

test("payer-readiness mode requires a payer account", () => {
  rejectsWith(() => loadConfig({ env: {}, requirePayer: true }), "PAYER_REQUIRED");
});

test("payer-readiness mode accepts a valid payer account id", () => {
  const env: EnvLike = { [ENV_PAYER_ACCOUNT_ID]: "0.0.9185802" };
  const config = loadConfig({ env, requirePayer: true });

  expect(config.payerAccountId).toBe("0.0.9185802");
});

test("loadConfig rejects mainnet regardless of mode", () => {
  rejectsWith(
    () => loadConfig({ env: { [ENV_NETWORK]: "hedera:mainnet" } }),
    "NETWORK",
  );
});

test("loadConfig rejects an unsupported network", () => {
  rejectsWith(
    () => loadConfig({ env: { [ENV_NETWORK]: "eip155:1" } }),
    "NETWORK",
  );
});

test("empty network string falls back to the testnet default", () => {
  const config = loadConfig({ env: { [ENV_NETWORK]: "" } });
  expect(config.network).toBe("hedera:testnet");
});

test("zero per-request cap fails closed with INVALID_CAP", () => {
  rejectsWith(
    () => loadConfig({ env: { [ENV_MAX_PER_REQUEST]: "0" } }),
    "INVALID_CAP",
  );
});

test("negative total budget fails closed with INVALID_CAP", () => {
  rejectsWith(
    () => loadConfig({ env: { [ENV_MAX_TOTAL_BUDGET]: "-5" } }),
    "INVALID_CAP",
  );
});

test("non-numeric cap fails closed with INVALID_CAP", () => {
  rejectsWith(
    () => loadConfig({ env: { [ENV_MAX_PER_REQUEST]: "many" } }),
    "INVALID_CAP",
  );
});

test("per-request cap above the supported ceiling fails closed with CAP_TOO_LARGE", () => {
  rejectsWith(
    () =>
      loadConfig({
        env: {
          [ENV_MAX_PER_REQUEST]: String(MAX_SUPPORTED_PER_REQUEST_TINYBARS + 1),
        },
      }),
    "CAP_TOO_LARGE",
  );
});

test("total budget above the supported ceiling fails closed with CAP_TOO_LARGE", () => {
  rejectsWith(
    () =>
      loadConfig({
        env: {
          [ENV_MAX_TOTAL_BUDGET]: String(MAX_SUPPORTED_TOTAL_BUDGET_TINYBARS + 1),
        },
      }),
    "CAP_TOO_LARGE",
  );
});

test("per-request cap above the total budget fails closed with CAP_EXCEEDS_BUDGET", () => {
  rejectsWith(
    () =>
      loadConfig({
        env: {
          [ENV_MAX_PER_REQUEST]: "2000000",
          [ENV_MAX_TOTAL_BUDGET]: "1000000",
        },
      }),
    "CAP_EXCEEDS_BUDGET",
  );
});

test("per-request cap equal to the total budget is allowed", () => {
  const config = loadConfig({
    env: {
      [ENV_MAX_PER_REQUEST]: "1000000",
      [ENV_MAX_TOTAL_BUDGET]: "1000000",
    },
  });

  expect(config.maxPerRequestTinybars).toBe(1_000_000);
  expect(config.maxTotalBudgetTinybars).toBe(1_000_000);
});

test("malformed payer account id fails closed with INVALID_ACCOUNT", () => {
  rejectsWith(
    () =>
      loadConfig({
        env: { [ENV_PAYER_ACCOUNT_ID]: "not-an-account" },
      }),
    "INVALID_ACCOUNT",
  );
});

test("payer account id equal to the HBAR asset id fails closed with INVALID_ACCOUNT", () => {
  rejectsWith(
    () =>
      loadConfig({
        env: { [ENV_PAYER_ACCOUNT_ID]: ALLOWED_ASSET },
      }),
    "INVALID_ACCOUNT",
  );
});

test("custom caps are parsed from the environment", () => {
  const config = loadConfig({
    env: {
      [ENV_MAX_PER_REQUEST]: "500000",
      [ENV_MAX_TOTAL_BUDGET]: "50000000",
      [ENV_PAYER_ACCOUNT_ID]: "0.0.555",
    },
  });

  expect(config.maxPerRequestTinybars).toBe(500_000);
  expect(config.maxTotalBudgetTinybars).toBe(50_000_000);
  expect(config.payerAccountId).toBe("0.0.555");
  expect(config.network).toBe("hedera:testnet");
});

test("loadConfig does not read or expose any private key variable", () => {
  const env: EnvLike = {
    STRATA402_PAYER_PRIVATE_KEY: "0xsecret",
    [ENV_PAYER_ACCOUNT_ID]: "0.0.12345",
  };
  const config = loadConfig({ env });

  expect(config).not.toHaveProperty("payerPrivateKey");
  expect(config).not.toHaveProperty("privateKey");
  expect(JSON.stringify(config)).not.toContain("secret");
  expect(JSON.stringify(config)).not.toContain("PAYER_PRIVATE_KEY");
});