import { readMirrorTransaction, MirrorReadError, type MirrorFetch } from "./mirror";

const EXPECTED_TX_ID = "0.0.9185802-1789101908-717608026";
const EXPECTED_PAYER = "0.0.10329902";
const EXPECTED_PAY_TO = "0.0.10464194";
const EXPECTED_AMOUNT_TINYBARS = 1_000_000n;

export interface PaymentProofVerified {
  status: "verified";
  transactionId: string;
  payer: string;
  payTo: string;
  amountTinybars: string;
  hashscanUrl: string;
}

export interface PaymentProofUnavailable {
  status: "unavailable";
  reason: string;
}

export interface PaymentProofLoading {
  status: "loading";
}

export type PaymentProofState = PaymentProofVerified | PaymentProofUnavailable | PaymentProofLoading;

export interface VerifyPaymentProofOptions {
  mirrorBaseUrl: string;
  fetchFn?: MirrorFetch;
}

export async function verifyPaymentProof(
  options: VerifyPaymentProofOptions,
): Promise<PaymentProofState> {
  try {
    const tx = await readMirrorTransaction(EXPECTED_TX_ID, options.mirrorBaseUrl, options.fetchFn);

    let payerAmount = 0n;
    let payToAmount = 0n;
    for (const transfer of tx.transfers) {
      if (transfer.account === EXPECTED_PAYER) {
        payerAmount = transfer.amountTinybars;
      }
      if (transfer.account === EXPECTED_PAY_TO) {
        payToAmount = transfer.amountTinybars;
      }
    }

    if (tx.result !== "SUCCESS") {
      return { status: "unavailable", reason: `transaction result is ${tx.result}, not SUCCESS` };
    }
    if (payerAmount !== -EXPECTED_AMOUNT_TINYBARS) {
      return { status: "unavailable", reason: "payer amount mismatch on mirror" };
    }
    if (payToAmount !== EXPECTED_AMOUNT_TINYBARS) {
      return { status: "unavailable", reason: "payTo amount mismatch on mirror" };
    }

    return {
      status: "verified",
      transactionId: EXPECTED_TX_ID,
      payer: EXPECTED_PAYER,
      payTo: EXPECTED_PAY_TO,
      amountTinybars: String(EXPECTED_AMOUNT_TINYBARS),
      hashscanUrl: `https://hashscan.io/testnet/transaction/${EXPECTED_TX_ID}`,
    };
  } catch (error) {
    const reason =
      error instanceof MirrorReadError
        ? `mirror read failed (${error.code})`
        : `mirror verification failed (${String(error)})`;
    return { status: "unavailable", reason };
  }
}