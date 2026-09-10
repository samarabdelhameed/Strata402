import { test, expect } from "bun:test";
import {
  APPROVED_ROUTE,
  ChallengeError,
  decodeChallengeHeader,
  requestUnpaidChallenge,
  validateChallenge,
} from "@strata402/consuming-agent";
import type { ChallengeErrorCode } from "@strata402/consuming-agent";

const VALID_PAYMENT_REQUIRED = {
  x402Version: 2,
  resource: { description: "Yield-Risk Strategy", mimeType: "application/json" },
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
};

function makePaymentRequired(patch: Record<string, unknown>): Record<string, unknown> {
  return { ...VALID_PAYMENT_REQUIRED, ...patch };
}

function makeRequirement(patch: Record<string, unknown>): Record<string, unknown> {
  return { ...VALID_PAYMENT_REQUIRED.accepts[0], ...patch };
}

function b64(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64");
}

type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];

function stubFetch(
  opts: { status?: number; paymentRequired?: string | null; paymentSignature?: string | null } = {},
): { fn: typeof fetch; call: () => { url: string; init?: FetchInit } } {
  const headers = new Headers();
  if (opts.paymentRequired !== undefined && opts.paymentRequired !== null) {
    headers.set("payment-required", opts.paymentRequired);
  }
  if (opts.paymentSignature !== undefined && opts.paymentSignature !== null) {
    headers.set("payment-signature", opts.paymentSignature);
  }
  let call: { url: string; init?: FetchInit } | undefined;
  const fn = (async (input: FetchInput, init?: FetchInit) => {
    call = { url: String(input), init };
    return new Response(null, { status: opts.status ?? 402, headers });
  }) as unknown as typeof fetch;
  return { fn, call: () => call! };
}

async function rejectsWith(
  runner: () => Promise<unknown> | unknown,
  code: ChallengeErrorCode,
): Promise<void> {
  try {
    await runner();
  } catch (err) {
    expect(err).toBeInstanceOf(ChallengeError);
    expect((err as ChallengeError).code).toBe(code);
    return;
  }
  throw new Error(`expected ChallengeError code=${code}, but no error was thrown`);
}

test("decodeChallengeHeader decodes a valid PAYMENT-REQUIRED header", () => {
  const raw = decodeChallengeHeader(b64(VALID_PAYMENT_REQUIRED));
  expect(validateChallenge(raw).x402Version).toBe(2);
});

test("validateChallenge accepts the full approved payload", () => {
  const challenge = validateChallenge(VALID_PAYMENT_REQUIRED);
  expect(challenge).toEqual({
    x402Version: 2,
    scheme: "exact",
    network: "hedera:testnet",
    asset: "0.0.0",
    amount: "1000000",
    payTo: "0.0.1234",
    maxTimeoutSeconds: 300,
    feePayer: "0.0.9185802",
  });
});

test("requestUnpaidChallenge POSTs to the approved endpoint and returns the validated challenge", async () => {
  const stub = stubFetch({ paymentRequired: b64(VALID_PAYMENT_REQUIRED) });
  const result = await requestUnpaidChallenge("http://gateway.local", stub.fn);

  const call = stub.call();
  expect(call.url).toBe(`http://gateway.local${APPROVED_ROUTE.endpoint}`);
  expect(call.init?.method).toBe("POST");
  expect(call.init?.body).toBe("{}");
  expect(result.status).toBe(402);
  expect(result.challenge.amount).toBe("1000000");
  expect(result.challenge.payTo).toBe("0.0.1234");
  expect(result.challenge.feePayer).toBe("0.0.9185802");
});

test("requestUnpaidChallenge fails closed when the response is not 402", async () => {
  const stub = stubFetch({ status: 200, paymentRequired: b64(VALID_PAYMENT_REQUIRED) });
  await rejectsWith(
    () => requestUnpaidChallenge("http://gateway.local", stub.fn),
    "HTTP_STATUS",
  );
});

test("requestUnpaidChallenge fails closed when the request throws", async () => {
  const failing = (async () => {
    throw new Error("boom");
  }) as unknown as typeof fetch;
  await rejectsWith(
    () => requestUnpaidChallenge("http://gateway.local", failing),
    "REQUEST_FAILED",
  );
});

test("requestUnpaidChallenge fails closed when PAYMENT-REQUIRED is missing", async () => {
  const stub = stubFetch({ paymentRequired: null });
  await rejectsWith(
    () => requestUnpaidChallenge("http://gateway.local", stub.fn),
    "HEADER_MISSING",
  );
});

test("requestUnpaidChallenge fails closed when an unexpected payment signature is present", async () => {
  const stub = stubFetch({
    paymentRequired: b64(VALID_PAYMENT_REQUIRED),
    paymentSignature: "c2lnbmVk",
  });
  await rejectsWith(
    () => requestUnpaidChallenge("http://gateway.local", stub.fn),
    "UNEXPECTED_SIGNATURE",
  );
});

test("non-base64 header fails closed with MALFORMED_HEADER", async () => {
  await rejectsWith(
    () => requestUnpaidChallenge("http://gateway.local", stubFetch({ paymentRequired: "not-base64!=" }).fn),
    "MALFORMED_HEADER",
  );
});

test("base64 of non-object JSON fails closed with MALFORMED_HEADER", async () => {
  const stub = stubFetch({ paymentRequired: b64("not-an-object") });
  await rejectsWith(
    () => requestUnpaidChallenge("http://gateway.local", stub.fn),
    "MALFORMED_HEADER",
  );
});

test("unsupported x402Version fails closed with X402_VERSION", async () => {
  const raw = makePaymentRequired({ x402Version: 1 });
  const stub = stubFetch({ paymentRequired: b64(raw) });
  await rejectsWith(
    () => requestUnpaidChallenge("http://gateway.local", stub.fn),
    "X402_VERSION",
  );
});

test("empty accepts fails closed with ACCEPTS_EMPTY", async () => {
  await rejectsWith(() => validateChallenge(makePaymentRequired({ accepts: [] })), "ACCEPTS_EMPTY");
});

test("missing accepts fails closed with ACCEPTS_EMPTY", async () => {
  await rejectsWith(
    () => validateChallenge(makePaymentRequired({ accepts: undefined })),
    "ACCEPTS_EMPTY",
  );
});

test("wrong scheme fails closed with SCHEME", async () => {
  const raw = makePaymentRequired({
    accepts: [makeRequirement({ scheme: "upto" })],
  });
  await rejectsWith(() => validateChallenge(raw), "SCHEME");
});

test("wrong network fails closed with NETWORK", async () => {
  const raw = makePaymentRequired({
    accepts: [makeRequirement({ network: "eip155:1" })],
  });
  await rejectsWith(() => validateChallenge(raw), "NETWORK");
});

test("wrong asset fails closed with ASSET", async () => {
  const raw = makePaymentRequired({
    accepts: [makeRequirement({ asset: "0.0.9185802" })],
  });
  await rejectsWith(() => validateChallenge(raw), "ASSET");
});

test("non-string amount fails closed with AMOUNT", async () => {
  const raw = makePaymentRequired({
    accepts: [makeRequirement({ amount: 1000000 })],
  });
  await rejectsWith(() => validateChallenge(raw), "AMOUNT");
});

test("unexpected amount fails closed with AMOUNT", async () => {
  const raw = makePaymentRequired({
    accepts: [makeRequirement({ amount: "2000000" })],
  });
  await rejectsWith(() => validateChallenge(raw), "AMOUNT");
});

test("missing payTo fails closed with PAYTO", async () => {
  const raw = makePaymentRequired({
    accepts: [makeRequirement({ payTo: undefined })],
  });
  await rejectsWith(() => validateChallenge(raw), "PAYTO");
});

test("payTo equal to the asset id fails closed with PAYTO", async () => {
  const raw = makePaymentRequired({
    accepts: [makeRequirement({ payTo: "0.0.0" })],
  });
  await rejectsWith(() => validateChallenge(raw), "PAYTO");
});

test("non-positive maxTimeoutSeconds fails closed with TIMEOUT", async () => {
  await rejectsWith(
    () =>
      validateChallenge(
        makePaymentRequired({ accepts: [makeRequirement({ maxTimeoutSeconds: 0 })] }),
      ),
    "TIMEOUT",
  );
  await rejectsWith(
    () =>
      validateChallenge(
        makePaymentRequired({ accepts: [makeRequirement({ maxTimeoutSeconds: 1.5 })] }),
      ),
    "TIMEOUT",
  );
});

test("missing feePayer fails closed with FEEPAYER", async () => {
  const raw = makePaymentRequired({
    accepts: [makeRequirement({ extra: {} })],
  });
  await rejectsWith(() => validateChallenge(raw), "FEEPAYER");
});