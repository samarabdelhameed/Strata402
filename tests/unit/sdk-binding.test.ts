import { test, expect } from "bun:test";
import { x402Client } from "@x402/core/client";
import {
  createClientHederaSigner,
  HEDERA_TESTNET_CAIP2,
  SUPPORTED_HEDERA_NETWORKS,
  isSupportedHederaNetwork,
} from "@x402/hedera";
import { ExactHederaScheme } from "@x402/hedera/exact/client";
import { PrivateKey } from "@hiero-ledger/sdk";

const TESTNET = "hedera:testnet" as const;

test("createClientHederaSigner binds a testnet payer without committing to a key type", () => {
  const ephemeralKey = PrivateKey.generate();
  const signer = createClientHederaSigner("0.0.12345", ephemeralKey, {
    network: TESTNET,
  });

  expect(signer.accountId).toBe("0.0.12345");
  expect(typeof signer.createPartiallySignedTransferTransaction).toBe("function");
  expect(typeof PrivateKey.fromString).toBe("function");
});

test("ExactHederaScheme from @x402/hedera/exact/client wraps the client signer for the exact scheme", () => {
  const signer = createClientHederaSigner(
    "0.0.12345",
    PrivateKey.generate(),
    { network: TESTNET },
  );
  const scheme = new ExactHederaScheme(signer);

  expect(scheme.scheme).toBe("exact");
  expect(typeof scheme.createPaymentPayload).toBe("function");
});

test("x402Client.register chains the client scheme for hedera:*", () => {
  const signer = createClientHederaSigner(
    "0.0.12345",
    PrivateKey.generate(),
    { network: TESTNET },
  );
  const scheme = new ExactHederaScheme(signer);
  const client = new x402Client().register("hedera:*", scheme);

  expect(client).toBeInstanceOf(x402Client);
});

test("hedera:testnet is a supported x402 compatibility target", () => {
  expect(HEDERA_TESTNET_CAIP2).toBe(TESTNET);
  expect(SUPPORTED_HEDERA_NETWORKS).toContain(TESTNET);
  expect(isSupportedHederaNetwork(TESTNET)).toBe(true);
  expect(isSupportedHederaNetwork("hedera:mainnet")).toBe(true);
  expect(isSupportedHederaNetwork("eip155:1")).toBe(false);
});
