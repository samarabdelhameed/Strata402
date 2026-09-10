import { test, expect } from "bun:test";
import {
  ALLOWED_ASSET,
  CHALLENGE_SCHEME,
  ENV_PAYER_ACCOUNT_ID,
  ENV_PAYER_PRIVATE_KEY,
  ENV_NETWORK,
  PaymentConstructorError,
  X402_VERSION,
  constructPaymentPayload,
} from "@strata402/consuming-agent";
import type {
  PaymentConstructorErrorCode,
  PayerKeyType,
  ValidatedChallenge,
} from "@strata402/consuming-agent";
import { PrivateKey } from "@x402/hedera";

const realGatewayFixture: ValidatedChallenge = {
  x402Version: 2,
  scheme: "exact",
  network: "hedera:testnet",
  asset: "0.0.0",
  amount: "1000000",
  payTo: "0.0.1234",
  maxTimeoutSeconds: 300,
  feePayer: "0.0.9185802",
};

function envWith(
  accountId: string,
  privateKey: string,
  network = "hedera:testnet",
): Record<string, string> {
  return {
    [ENV_NETWORK]: network,
    [ENV_PAYER_ACCOUNT_ID]: accountId,
    [ENV_PAYER_PRIVATE_KEY]: privateKey,
  };
}

function ed25519Key(): PrivateKey {
  return PrivateKey.generateED25519();
}

function ed25519DerKey(): string {
  return ed25519Key().toStringDer();
}

function ecdsaKey(): PrivateKey {
  return PrivateKey.generateECDSA();
}

function expectsConstructorError(
  run: () => Promise<unknown>,
  code: PaymentConstructorErrorCode,
): Promise<void> {
  return run().then(
    () => Promise.reject(
      new Error(`expected PaymentConstructorError code=${code}, but no error was thrown`),
    ),
    (err: unknown) => {
      expect(err).toBeInstanceOf(PaymentConstructorError);
      expect((err as PaymentConstructorError).code).toBe(code);
    },
  );
}

test("constructPaymentPayload creates a non-empty exact-Hedera payload locally (ED25519, DER)", async () => {
  const info = await constructPaymentPayload(
    realGatewayFixture,
    { env: envWith("0.0.10271523", ed25519DerKey()) },
  );

  expect(info.created).toBe(true);
  expect(info.x402Version).toBe(X402_VERSION);
  expect(info.scheme).toBe(CHALLENGE_SCHEME);
  expect(info.scheme).toBe("exact");
  expect(info.keyType).toBe<"ED25519">("ED25519");
  expect(info.payerAccountId).toBe("0.0.10271523");
  expect(info.payloadKeys.length).toBeGreaterThan(0);
  expect(info.payloadKeys).toContain("transaction");
});

test("constructPaymentPayload accepts ECDSA keys and reports key type", async () => {
  const key = ecdsaKey();
  const info = await constructPaymentPayload(
    realGatewayFixture,
    { env: envWith("0.0.10329902", key.toStringRaw()) },
  );

  expect(info.keyType).toBe<"ECDSA_SECP256K1">("ECDSA_SECP256K1");
  expect(info.payloadKeys.length).toBeGreaterThan(0);
});

test("constructPaymentPayload accepts 0x-prefixed ECDSA hex keys", async () => {
  const key = ecdsaKey();
  const info = await constructPaymentPayload(
    realGatewayFixture,
    { env: envWith("0.0.10329902", "0x" + key.toStringRaw()) },
  );

  expect(info.keyType).toBe<"ECDSA_SECP256K1">("ECDSA_SECP256K1");
});

test("constructPaymentPayload parses DER-encoded keys", async () => {
  const key = ecdsaKey();
  const info = await constructPaymentPayload(
    realGatewayFixture,
    { env: envWith("0.0.10329902", key.toStringDer()) },
  );

  expect(info.keyType).toBe<"ECDSA_SECP256K1">("ECDSA_SECP256K1");
});

test("constructPaymentPayload rejects a missing private key", async () => {
  const accountId = "0.0.10329902";
  await expectsConstructorError(
    () =>
      constructPaymentPayload(realGatewayFixture, {
        env: { [ENV_NETWORK]: "hedera:testnet", [ENV_PAYER_ACCOUNT_ID]: accountId },
      }),
    "CREDENTIALS_MISSING",
  );
});

test("constructPaymentPayload rejects an unparseable key", async () => {
  await expectsConstructorError(
    () =>
      constructPaymentPayload(realGatewayFixture, {
        env: envWith("0.0.10329902", "not-a-key"),
      }),
    "KEY_PARSE",
  );
});

test("constructPaymentPayload rejects a non-testnet network", async () => {
  const key = ed25519Key();
  await expectsConstructorError(
    () =>
      constructPaymentPayload(realGatewayFixture, {
        env: envWith("0.0.10271523", key.toStringRaw(), "hedera:mainnet"),
      }),
    "NETWORK",
  );
});

test("constructPaymentPayload enforces the 1,000,000 per-request cap", async () => {
  const key = ed25519Key();
  const over = "1000001";
  await expectsConstructorError(
    () =>
      constructPaymentPayload(
        { ...realGatewayFixture, amount: over },
        { env: envWith("0.0.10271523", key.toStringRaw()) },
      ),
    "CAP_PER_REQUEST",
  );
});

test("constructPaymentPayload rejects an invalid amount", async () => {
  const key = ed25519Key();
  await expectsConstructorError(
    () =>
      constructPaymentPayload(
        { ...realGatewayFixture, amount: "abc" },
        { env: envWith("0.0.10271523", key.toStringRaw()) },
      ),
    "CAP_PER_REQUEST",
  );
});

test("payment payload does not expose raw payload or serialized bytes", async () => {
  const key = ed25519Key();
  const info = await constructPaymentPayload(
    realGatewayFixture,
    { env: envWith("0.0.10271523", key.toStringRaw()) },
  );

  const serialized = JSON.stringify(info);
  expect(serialized).not.toContain(key.toStringRaw().slice(0, 8));
  expect(serialized.length).toBeLessThan(300);
});
