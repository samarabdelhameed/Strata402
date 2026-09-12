import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config({ path: "../.env" });

import { PrivateKey } from "@hashgraph/sdk";

function parsePrivateKey(): string {
  const raw = (process.env.STRATA402_PAYER_PRIVATE_KEY || process.env.OPERATOR_KEY || "").trim();
  if (!raw) {
    return "0x0000000000000000000000000000000000000000000000000000000000000001";
  }
  try {
    let pk: PrivateKey;
    try {
      pk = PrivateKey.fromStringECDSA(raw);
    } catch {
      pk = PrivateKey.fromString(raw);
    }
    return `0x${pk.toStringRaw()}`;
  } catch {
    const hex = raw.startsWith("0x") || raw.startsWith("0X") ? raw.slice(2) : raw;
    if (hex.length === 64 && /^[0-9a-fA-F]{64}$/.test(hex)) {
      return `0x${hex}`;
    }
    if (hex.length > 64) {
      const rawKey = hex.slice(-64);
      if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
        return `0x${rawKey}`;
      }
    }
    return "0x0000000000000000000000000000000000000000000000000000000000000001";
  }
}

const OPERATOR_PRIVATE_KEY = parsePrivateKey();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "cancun",
    },
  },
  networks: {
    hardhat: {
      chainId: 296,
    },
    hederaTestnet: {
      url: "https://testnet.hashio.io/api",
      chainId: 296,
      accounts: [OPERATOR_PRIVATE_KEY],
      gasPrice: 10000000000,
    },
    hederaMainnet: {
      url: "https://mainnet.hashio.io/api",
      chainId: 295,
      accounts: [OPERATOR_PRIVATE_KEY],
    },
  },
  paths: {
    sources: "./src",
  },
};

export default config;
