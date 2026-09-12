import { test, expect } from "bun:test";
import {
  SAUCER_BASE_URL,
  SAUCER_TOKENS_PATH,
  SAUCER_POOLS_FULL_PATH,
  readSaucerTokens,
  readSaucerPools,
  parseTokensJson,
  parsePoolsJson,
  SaucerReadError,
} from "../src/saucerswap";

const TOKENS_PAYLOAD = [
  { id: "0.0.456858", symbol: "USDC", name: "USD Coin", decimals: 6, priceUsd: 1.000915558210291 },
  { id: "0.0.1055459", symbol: "HBAR", name: "HBAR", decimals: 8, priceUsd: 0.0234 },
];

const POOLS_PAYLOAD = [
  {
    id: 1,
    contractId: "0.0.3948521",
    tokenA: { id: "0.0.456858", symbol: "USDC", name: "USD Coin", decimals: 6, priceUsd: 1.000915558210291 },
    tokenB: { id: "0.0.1055459", symbol: "HBAR", name: "HBAR", decimals: 8, priceUsd: 0.0234 },
    amountA: "-862285480",
    amountB: "9554510624",
    fee: 10000,
    sqrtRatioX96: "91800944750177256765494939427",
    tickCurrent: 2945,
    liquidity: "101535727",
  },
];

test("tokens parse: reads only genuine wire facts", () => {
  const read = parseTokensJson(TOKENS_PAYLOAD);
  expect(read.tokenCount).toBe(2);
  expect(read.sampleSymbols).toContain("USDC");
  expect(read.sampleSymbols).toContain("HBAR");
});

test("pools parse: fee tier is wire fact, pool Apy is always null — honesty core", () => {
  const read = parsePoolsJson(POOLS_PAYLOAD);
  expect(read.poolCount).toBe(1);
  const pool = read.pools[0]!;
  expect(pool.fee).toBe(10000); // fee tier fact, genuinely read from wire
  expect(pool.poolApy).toBeNull(); // never fabricated — the honesty core
  expect(read.feeTiersSeen).toContain(10000);
});

test("fail-closed: malformed pools payload raises SaucerReadError", () => {
  expect(() => parsePoolsJson({ not: "an array" })).toThrow(SaucerReadError);
});

test("keyless read: non-200 pools response raises SaucerReadError with HTTP code", async () => {
  const fetchFn = async (input: string | URL) => {
    const res = new Response("{}", { status: 502 });
    Object.defineProperty(res, "url", { value: String(input) });
    return res;
  };
  await expect(readSaucerPools(SAUCER_BASE_URL, fetchFn)).rejects.toThrow(SaucerReadError);
});
