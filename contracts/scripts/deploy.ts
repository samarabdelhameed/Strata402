import { ethers } from "ethers";
import dotenv from "dotenv";
import { PrivateKey } from "@hashgraph/sdk";
import fs from "fs";
import path from "path";

dotenv.config({ path: "../.env" });

function getSigner(provider: ethers.Provider): ethers.Wallet {
  const raw = (process.env.STRATA402_PAYER_PRIVATE_KEY || process.env.OPERATOR_KEY || "").trim();
  let hexKey = "0x0000000000000000000000000000000000000000000000000000000000000001";
  if (raw) {
    try {
      let pk: PrivateKey;
      try {
        pk = PrivateKey.fromStringECDSA(raw);
      } catch {
        pk = PrivateKey.fromString(raw);
      }
      hexKey = `0x${pk.toStringRaw()}`;
    } catch {
      const clean = raw.replace(/^0x/i, "");
      hexKey = `0x${clean.length === 64 ? clean : clean.slice(-64)}`;
    }
  }
  return new ethers.Wallet(hexKey, provider);
}

function loadArtifact(contractName: string) {
  const artifactPath = path.join(
    __dirname,
    "../artifacts/src",
    `${contractName}.sol`,
    `${contractName}.json`,
  );
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`Artifact not found at ${artifactPath}. Run 'bun run compile' first.`);
  }
  return JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
}

async function main() {
  console.log("🚀 Starting Strata402 HSCS Smart Contracts Deployment on Hedera Testnet...");

  const provider = new ethers.JsonRpcProvider("https://testnet.hashio.io/api", {
    chainId: 296,
    name: "hederaTestnet",
  });
  const deployer = getSigner(provider);
  const balance = await provider.getBalance(deployer.address);

  console.log(`👤 Deploying contract with Operator Account: ${deployer.address}`);
  console.log(`💰 Account Balance: ${ethers.formatEther(balance)} HBAR`);

  const SAUCERSWAP_V2_ROUTER =
    process.env.SAUCERSWAP_ROUTER_ADDRESS || "0x0000000000000000000000000000000000300000";
  const BONZO_POOL = process.env.BONZO_POOL_ADDRESS || "0x0000000000000000000000000000000000400000";
  const CHAINLINK_ORACLE =
    process.env.CHAINLINK_ORACLE_ADDRESS || "0x0000000000000000000000000000000000500000";
  const EXECUTOR_AGENT = deployer.address;

  // 1. Deploy AgentRegistryHCS14
  console.log("\n1️⃣ Deploying AgentRegistryHCS14...");
  const registryArtifact = loadArtifact("AgentRegistryHCS14");
  const AgentRegistryFactory = new ethers.ContractFactory(
    registryArtifact.abi,
    registryArtifact.bytecode,
    deployer,
  );
  const agentRegistry = await AgentRegistryFactory.deploy();
  await agentRegistry.waitForDeployment();
  const registryAddress = await agentRegistry.getAddress();
  console.log(`✅ AgentRegistryHCS14 deployed to: ${registryAddress}`);

  // 2. Deploy AutoSwapLimit
  console.log("\n2️⃣ Deploying AutoSwapLimit Engine...");
  const autoSwapArtifact = loadArtifact("AutoSwapLimit");
  const AutoSwapLimitFactory = new ethers.ContractFactory(
    autoSwapArtifact.abi,
    autoSwapArtifact.bytecode,
    deployer,
  );
  const autoSwapLimit = await AutoSwapLimitFactory.deploy(
    SAUCERSWAP_V2_ROUTER,
    CHAINLINK_ORACLE,
    EXECUTOR_AGENT,
  );
  await autoSwapLimit.waitForDeployment();
  const autoSwapAddress = await autoSwapLimit.getAddress();
  console.log(`✅ AutoSwapLimit Engine deployed to: ${autoSwapAddress}`);

  // 3. Deploy HederaYieldVault
  console.log("\n3️⃣ Deploying HederaYieldVault...");
  const vaultArtifact = loadArtifact("HederaYieldVault");
  const HederaYieldVaultFactory = new ethers.ContractFactory(
    vaultArtifact.abi,
    vaultArtifact.bytecode,
    deployer,
  );
  const yieldVault = await HederaYieldVaultFactory.deploy(
    BONZO_POOL,
    SAUCERSWAP_V2_ROUTER,
    EXECUTOR_AGENT,
  );
  await yieldVault.waitForDeployment();
  const vaultAddress = await yieldVault.getAddress();
  console.log(`✅ HederaYieldVault deployed to: ${vaultAddress}`);

  console.log("\n🎉 All Strata402 Smart Contracts deployed successfully on Hedera HSCS!");
  console.log("----------------------------------------------------------------------");
  console.log(`NEXT_PUBLIC_REGISTRY_CONTRACT=${registryAddress}`);
  console.log(`NEXT_PUBLIC_AUTOSWAP_CONTRACT=${autoSwapAddress}`);
  console.log(`NEXT_PUBLIC_YIELD_VAULT_CONTRACT=${vaultAddress}`);
}

main().catch((error) => {
  console.error("❌ Deployment failed:", error);
  process.exitCode = 1;
});
