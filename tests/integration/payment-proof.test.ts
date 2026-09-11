import { test, expect } from "bun:test";
import { verifyPaymentProof, type PaymentProofState } from "@strata402/api-gateway/payment-proof";
import { readMirrorTransaction } from "@strata402/api-gateway/mirror";

const RUN_MIRROR_INTEGRATION = process.env.RUN_MIRROR_INTEGRATION === "true";
const MIRROR_BASE_URL =
  process.env.STRATA402_MIRROR_BASE_URL || "https://testnet.mirrornode.hedera.com";

const run = RUN_MIRROR_INTEGRATION ? test : test.skip;

run("real Mirror transaction read resolves the verified Testnet payment", async () => {
  const tx = await readMirrorTransaction("0.0.9185802-1789101908-717608026", MIRROR_BASE_URL);
  expect(tx.result).toBe("SUCCESS");
  expect(tx.transactionId).toBe("0.0.9185802-1789101908-717608026");
  const amounts = new Map<string, bigint>();
  for (const t of tx.transfers) amounts.set(t.account, t.amountTinybars);
  expect(amounts.get("0.0.10329902")).toBe(-1_000_000n);
  expect(amounts.get("0.0.10464194")).toBe(1_000_000n);
}, 15000);

run("live server-side verification marks the proof VERIFIED only on exact match", async () => {
  const proof = await verifyPaymentProof({ mirrorBaseUrl: MIRROR_BASE_URL });
  expect(proof.status).toBe("verified");
});

test("fail-closed: non-200 mirror becomes unavailable, never verified", async () => {
  const proof = await verifyPaymentProof({
    mirrorBaseUrl: "http://127.0.0.1:1",
    fetchFn: async () => new Response("nope", { status: 404 }),
  });
  expect(proof.status).toBe("unavailable");
  if (proof.status === "unavailable") {
    expect(proof.reason).toContain("mirror");
  }
});

test("fail-closed: wrong payer amount never yields verified", async () => {
  const prove = async (amount: bigint): Promise<PaymentProofState> => {
    const tx = {
      transaction_id: "0.0.9185802-1789101908-717608026",
      result: "SUCCESS",
      name: "CRYPTOTRANSFER",
      consensus_timestamp: "1789101915.212785885",
      transfers: [
        { account: "0.0.10329902", amount: `-${amount}` },
        { account: "0.0.10464194", amount: `${amount}` },
      ],
    };
    const fetchFn = async () =>
      new Response(JSON.stringify({ transactions: [tx] }), { status: 200 });
    return verifyPaymentProof({ mirrorBaseUrl: "http://fake", fetchFn });
  };
  const proof = await prove(2_000_000n);
  expect(proof.status).toBe("unavailable");
  if (proof.status === "unavailable") {
    expect(proof.reason).toContain("mismatch");
  }
});