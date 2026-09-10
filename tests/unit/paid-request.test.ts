import { test, expect } from "bun:test";
import { encodePaymentRequiredHeader } from "@x402/core/http";
import { x402Client } from "@x402/fetch";
import { PrivateKey } from "@x402/hedera";
import {
  ENV_PAYER_ACCOUNT_ID,
  ENV_PAYER_PRIVATE_KEY,
  ENV_NETWORK,
  PaidRequest,
  PaidRequestError,
  PaidRequestRunner,
  PaymentConstructorError,
  SpendLedger,
  X402_VERSION,
  createX402PaymentClient,
  defaultPaidRequestRunner,
  submitPaidRequest,
} from "@strata402/consuming-agent";
import type {
  ChallengeFetch,
  PaidRequestErrorCode,
  ValidatedChallenge,
} from "@strata402/consuming-agent";

const gatewayFixture: ValidatedChallenge = {
  x402Version: 2,
  scheme: "exact",
  network: "hedera:testnet",
  asset: "0.0.0",
  amount: "1000000",
  payTo: "0.0.1234",
  maxTimeoutSeconds: 300,
  feePayer: "0.0.9185802",
};

function envWith(accountId: string, privateKey: string): Record<string, string> {
  return {
    [ENV_NETWORK]: "hedera:testnet",
    [ENV_PAYER_ACCOUNT_ID]: accountId,
    [ENV_PAYER_PRIVATE_KEY]: privateKey,
  };
}

function ecdsaKey(): PrivateKey {
  return PrivateKey.generateECDSA();
}

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function paidFetch(
  responses: Array<() => Response>,
): { fetchFn: ChallengeFetch; calls: Array<{ url: string; init: RequestInit }> } {
  const queue = [...responses];
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchFn = (async (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    calls.push({ url: String(input), init: init ?? {} });
    const next = queue.shift();
    if (next === undefined) {
      throw new Error("paidFetch exhausted its response queue");
    }
    return next();
  }) as unknown as ChallengeFetch;
  return { fetchFn, calls };
}

function defaults(ledger?: SpendLedger) {
  const key = ecdsaKey();
  return {
    env: envWith("0.0.10329902", key.toStringRaw()),
    key,
    ledger: ledger ?? new SpendLedger(100_000_000),
  };
}

function expectsPaidError(
  run: () => Promise<unknown>,
  code: PaidRequestErrorCode,
): Promise<void> {
  return run().then(
    () => Promise.reject(new Error(`expected PaidRequestError code=${code}, but no error was thrown`)),
    (err: unknown) => {
      expect(err).toBeInstanceOf(PaidRequestError);
      expect((err as PaidRequestError).code).toBe(code);
    },
  );
}

const PAYMENT_REQUIRED_VALUE = encodePaymentRequiredHeader({
  x402Version: 2,
  accepts: [
    {
      scheme: "exact",
      network: "hedera:testnet",
      asset: "0.0.0",
      amount: "1000000",
      payTo: "0.0.1234",
      maxTimeoutSeconds: 300,
      extra: { feePayer: "0.0.9185802" },
    },
  ],
  resource: { url: "https://x402.test/v1/strategy/yield-risk" },
});

test("createX402PaymentClient builds the official x402 client + HTTP wrapper locally", async () => {
  const { env } = defaults();
  const client = await createX402PaymentClient({ env });

  expect(client.payerAccountId).toBe("0.0.10329902");
  expect(client.keyType).toBe<"ECDSA_SECP256K1">("ECDSA_SECP256K1");
  expect(client.scheme.scheme).toBe("exact");
  expect(typeof client.http.processResponse).toBe("function");
  expect(typeof client.http.encodePaymentSignatureHeader).toBe("function");
  expect(client.client).toBeInstanceOf(x402Client);
});

test("submitPaidRequest sends one payment-signature and returns redacted settled evidence", async () => {
  const { env, ledger } = defaults();
  const { fetchFn, calls } = paidFetch([() => jsonResponse(200, { ok: true })]);

  const runner = new PaidRequestRunner();
  const result = await runner.submit("http://svc.test", {
    env,
    ledger,
    challenge: gatewayFixture,
    fetchFn,
  });

  expect(calls.length).toBe(1);
  expect(result.body).toEqual({ ok: true });

  const evidence = result.evidence;
  expect(evidence.phase).toBe("settled");
  expect(evidence.paymentStatus).toBe("settled");
  expect(evidence.httpStatus).toBe(200);
  expect(evidence.x402Version).toBe(X402_VERSION);
  expect(evidence.scheme).toBe("exact");
  expect(evidence.payerAccountId).toBe("0.0.10329902");
  expect(evidence.keyType).toBe("ECDSA_SECP256K1");
  expect(evidence.amountTinybars).toBe("1000000");
  expect(evidence.totalSpentTinybars).toBe("1000000");
  expect(evidence.requestId).toMatch(/^[0-9a-f]{16}$/);

  const header = (calls[0]!.init.headers as Record<string, string>)["payment-signature"] ?? "";
  expect(typeof header).toBe("string");
  expect(header.length).toBeGreaterThan(0);

  const serialized = JSON.stringify(evidence);
  expect(serialized).toMatch(/^\{/);
  expect(serialized).not.toContain(header);
  expect(serialized).not.toContain("transaction");
  expect(serialized.length).toBeLessThan(600);
});

test("evidence is fully redacted: no key bytes, no payload, no header value", async () => {
  const d = defaults();
  const { fetchFn, calls } = paidFetch([() => jsonResponse(200, { ok: true })]);

  const runner = new PaidRequestRunner();
  const result = await runner.submit("http://svc-redacted.test", {
    env: d.env,
    ledger: d.ledger,
    challenge: gatewayFixture,
    fetchFn,
  });

  const header = (calls[0]!.init.headers as Record<string, string>)["payment-signature"];
  const serializedEvidence = JSON.stringify(result.evidence);
  expect(serializedEvidence).not.toContain(d.key.toStringRaw().slice(0, 8));
  expect(serializedEvidence).not.toContain(header);
  expect(serializedEvidence).not.toContain(gatewayFixture.payTo);
  expect(JSON.stringify(result)).not.toContain(header);
});

test("a 402 rejection lands in settle_failed and retry is forbidden", async () => {
  const { env, ledger } = defaults();
  const { fetchFn, calls } = paidFetch([
    () => jsonResponse(402, { error: "payment rejected" }, { "payment-required": PAYMENT_REQUIRED_VALUE }),
  ]);

  const request = new PaidRequest("http://svc-rejected.test", {
    env,
    ledger,
    challenge: gatewayFixture,
    fetchFn,
  });
  await request.createPayload();
  const result = await request.executePaidRequest();

  expect(result.evidence.paymentStatus).toBe("settle_failed");
  expect(result.evidence.phase).toBe("settle_failed");
  expect(result.evidence.httpStatus).toBe(402);
  expect(request.evidence.phase).toBe("settle_failed");
  expect(calls.length).toBe(1);

  await expectsPaidError(() => request.executePaidRequest(), "ALREADY_SENT");
});

test("an unexpected 500 marks failed and retry is forbidden", async () => {
  const { env, ledger } = defaults();
  const { fetchFn } = paidFetch([() => jsonResponse(500, { error: "boom" })]);

  const runner = new PaidRequestRunner();
  await runner.submit("http://svc-500.test", {
    env,
    ledger,
    challenge: gatewayFixture,
    fetchFn,
  }).then(
    (result) => {
      expect(result.evidence.paymentStatus).toBe("none");
      expect(result.evidence.phase).toBe("failed");
      expect(result.evidence.httpStatus).toBe(500);
    },
    () => {
      throw new Error("expected a successful, terminal result for a 500 response");
    },
  );

  await expectsPaidError(
    () =>
      runner.submit("http://svc-500.test", {
        env,
        ledger,
        challenge: gatewayFixture,
        fetchFn,
      }),
    "ALREADY_SENT",
  );
});

test("executePaidRequest before createPayload throws NO_PAYLOAD", async () => {
  const { env, ledger } = defaults();
  const { fetchFn } = paidFetch([]);
  const request = new PaidRequest("http://svc-nopayload.test", { env, ledger, fetchFn });

  await expectsPaidError(() => request.executePaidRequest(), "NO_PAYLOAD");
});

test("creating a payload twice throws INVALID_STATE", async () => {
  const { env, ledger } = defaults();
  const { fetchFn } = paidFetch([]);
  const request = new PaidRequest("http://svc-twice.test", {
    env,
    ledger,
    challenge: gatewayFixture,
    fetchFn,
  });

  await request.createPayload();
  await expectsPaidError(() => request.createPayload(), "INVALID_STATE");
});

test("evidence accessor throws before a paid request result", async () => {
  const { env, ledger } = defaults();
  const { fetchFn } = paidFetch([]);
  const request = new PaidRequest("http://svc-noevidence.test", {
    env,
    ledger,
    challenge: gatewayFixture,
    fetchFn,
  });
  await request.createPayload();

  let thrown: PaidRequestError | null = null;
  try {
    void request.evidence.phase;
  } catch (err) {
    thrown = err as PaidRequestError;
  }
  expect(thrown).toBeInstanceOf(PaidRequestError);
  expect(thrown?.code).toBe("INVALID_STATE");
});

test("the runner blocks a second submit for the same service URL", async () => {
  const { env, ledger } = defaults();
  const { fetchFn } = paidFetch([() => jsonResponse(200, { ok: true })]);

  const runner = new PaidRequestRunner();
  await runner.submit("http://svc-oneshot.test", {
    env,
    ledger,
    challenge: gatewayFixture,
    fetchFn,
  });

  expect(runner.has("http://svc-oneshot.test")).toBe(true);
  await expectsPaidError(
    () =>
      runner.submit("http://svc-oneshot.test", {
        env,
        ledger,
        challenge: gatewayFixture,
        fetchFn,
      }),
    "ALREADY_SENT",
  );
});

test("a network failure is terminal with redacted evidence and no retry", async () => {
  const { env, ledger } = defaults();
  const failingFetch = (async () => {
    throw new Error("connection refused");
  }) as unknown as ChallengeFetch;
  const request = new PaidRequest("http://svc-down.test", {
    env,
    ledger,
    challenge: gatewayFixture,
    fetchFn: failingFetch,
  });
  await request.createPayload();

  await expectsPaidError(() => request.executePaidRequest(), "SEND_FAILED");
  expect(request.phase).toBe("failed");
  expect(request.evidence.httpStatus).toBe(0);
  expect(request.evidence.paymentStatus).toBe("none");

  await expectsPaidError(() => request.executePaidRequest(), "ALREADY_SENT");
});

test("total-budget ledger blocks an additional paid request before any network send", async () => {
  const ledger = new SpendLedger(1_000_000);
  const { env } = defaults(ledger);
  const { fetchFn, calls } = paidFetch([() => jsonResponse(200, { ok: true })]);

  const runner = new PaidRequestRunner();
  await runner.submit("http://svc-budget-1.test", {
    env,
    ledger,
    challenge: gatewayFixture,
    fetchFn,
  });
  expect(calls.length).toBe(1);

  await expectsPaidError(
    () =>
      runner.submit("http://svc-budget-2.test", {
        env,
        ledger,
        challenge: gatewayFixture,
        fetchFn,
      }),
    "TOTAL_BUDGET",
  );
  expect(calls.length).toBe(1);
});

test("an over-cap challenge is rejected at payload creation with CAP_PER_REQUEST", async () => {
  const { env, ledger } = defaults();
  const { fetchFn } = paidFetch([]);
  const request = new PaidRequest("http://svc-overcap.test", {
    env,
    ledger,
    challenge: { ...gatewayFixture, amount: "2000000" },
    fetchFn,
  });

  await request.createPayload().then(
    () => {
      throw new Error("expected CAP_PER_REQUEST, but the payload was created");
    },
    (err: unknown) => {
      expect(err).toBeInstanceOf(PaymentConstructorError);
      expect((err as PaymentConstructorError).code).toBe("CAP_PER_REQUEST");
    },
  );
});

test("executePaidRequest without an explicit fetchFn is refused with NETWORK_DISABLED", async () => {
  const { env, ledger } = defaults();
  const request = new PaidRequest("http://svc-netoff.test", {
    env,
    ledger,
    challenge: gatewayFixture,
  });

  await request.createPayload();
  expect(request.phase).toBe("payload_created");

  await expectsPaidError(() => request.executePaidRequest(), "NETWORK_DISABLED");
  expect(request.phase).toBe("failed");
  expect(request.evidence.httpStatus).toBe(0);
  expect(request.evidence.paymentStatus).toBe("none");
});

test("challenge discovery without an explicit fetchFn is refused with NETWORK_DISABLED", async () => {
  const { env, ledger } = defaults();
  const request = new PaidRequest("http://svc-netoff-discovery.test", { env, ledger });

  await expectsPaidError(() => request.createPayload(), "NETWORK_DISABLED");
  expect(request.phase).toBe("unpaid");
});

test("full pipeline: unpaid 402 discovery then a single paid send", async () => {
  const { env, ledger } = defaults();
  const { fetchFn, calls } = paidFetch([
    () => jsonResponse(402, { error: "payment required" }, { "payment-required": PAYMENT_REQUIRED_VALUE }),
    () => jsonResponse(200, { ok: true }),
  ]);

  const runner = new PaidRequestRunner();
  const result = await runner.submit("http://svc-pipeline.test", {
    env,
    ledger,
    fetchFn,
  });

  expect(calls.length).toBe(2);
  expect((calls[0]!.init.headers as Record<string, string>)["payment-signature"]).toBeUndefined();
  expect((calls[1]!.init.headers as Record<string, string>)["payment-signature"]).toBeDefined();
  expect(result.evidence.paymentStatus).toBe("settled");
  expect(result.body).toEqual({ ok: true });
});

test("convenience submitPaidRequest uses the default runner and is one-shot", async () => {
  const { env, ledger } = defaults();
  const { fetchFn } = paidFetch([() => jsonResponse(200, { ok: true })]);

  const first = await submitPaidRequest("http://svc-default-runner.test", {
    env,
    ledger,
    challenge: gatewayFixture,
    fetchFn,
  });
  expect(first.evidence.paymentStatus).toBe("settled");

  await expectsPaidError(
    () =>
      submitPaidRequest("http://svc-default-runner.test", {
        env,
        ledger,
        challenge: gatewayFixture,
        fetchFn,
      }),
    "ALREADY_SENT",
  );
});

test("defaultPaidRequestRunner is the exported singleton used by submitPaidRequest", () => {
  expect(defaultPaidRequestRunner.has("http://svc-default-runner.test")).toBe(true);
});
