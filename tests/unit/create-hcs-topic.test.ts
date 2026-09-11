import { describe, expect, test } from "bun:test";
import {
  buildHcsOperator,
  createHcsTopic,
  isHcsCreateEnabled,
} from "@strata402/consuming-agent";
import {
  PaymentConstructorError,
} from "@strata402/consuming-agent";

const TESTNET_ENV = {
  STRATA402_NETWORK: "hedera:testnet",
  STRATA402_PAYER_ACCOUNT_ID: "0.0.10329902",
  STRATA402_PAYER_PRIVATE_KEY:
    "302e020100300506032b6570042204200000000000000000000000000000000000000000000000000000000000000001",
  STRATA402_MIRROR_BASE_URL: "https://testnet.mirrornode.hedera.com",
} as const;

describe("create-hcs-topic readiness gate", () => {
  test("buildHcsOperator accepts a valid testnet payer", async () => {
    const config = await buildHcsOperator({ env: TESTNET_ENV });
    expect(config.payerAccountId).toBe("0.0.10329902");
    expect(config.network).toBe("hedera:testnet");
  });

  test("network guard rejects mainnet", async () => {
    await expect(
      buildHcsOperator({
        env: { ...TESTNET_ENV, STRATA402_NETWORK: "mainnet" },
      }),
    ).rejects.toThrow(PaymentConstructorError);
  });

  test("isHcsCreateEnabled is true only for explicit true", () => {
    expect(isHcsCreateEnabled({ STRATA402_HCS_CREATE: "true" })).toBe(true);
    expect(isHcsCreateEnabled({ STRATA402_HCS_CREATE: "false" })).toBe(false);
    expect(isHcsCreateEnabled({})).toBe(false);
  });

  test("createHcsTopic does not touch the network without explicit confirm", async () => {
    const result = await createHcsTopic({ env: TESTNET_ENV });
    expect(result.created).toBe(false);
    if (!result.created) {
      expect(result.reason).toBe("unconfirmed");
    }
  });

  test("createHcsTopic early-returns unconfirmed even when env flag set but confirmed=false", async () => {
    const result = await createHcsTopic({
      env: { ...TESTNET_ENV, STRATA402_HCS_CREATE: "true" },
      confirmed: false,
    });
    expect(result.created).toBe(false);
    if (!result.created) {
      expect(result.reason).toBe("unconfirmed");
    }
  });
});