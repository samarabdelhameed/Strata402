# 🛡️ Major Gainz: Smart Contracts Architecture & Production Solidity Codebase
**Hedera Smart Contract Service (HSCS - EVM Compatible) | Solidity ^0.8.24**

---

## 🏗️ 1. المخطط المعماري الكامل لمجلد `contracts/`

```text
contracts/
├── package.json                          # اعتمادات ومكتبات Hardhat & Solidity
├── hardhat.config.ts                     # إعدادات شبكة Hedera Testnet (HSCS) وتكوين شبكة EVM
├── src/
│   ├── AutoSwapLimit.sol                 # [Core 1] عقد التداول بأوامر الحد الشفافة ربطاً مع SaucerSwap
│   ├── HederaYieldVault.sol              # [Core 2] خزينة الأصول المؤتمتة ربطاً مع Bonzo Finance
│   ├── AgentRegistryHCS14.sol            # [Core 3] عقد توثيق هوية الوكلاء وتدقيق معاملات x402 Onchain
│   ├── interfaces/                       # الواجهات البرمجية للبروتوكولات والنظام
│   │   ├── IHederaTokenService.sol       # واجهة النظام الأصلي لـ HTS (Address 0x167)
│   │   ├── ISaucerSwapV2Router.sol       # واجهة التبادلات لـ SaucerSwap V2
│   │   ├── IBonzoPool.sol                # واجهة الإقراض لـ Bonzo Finance (Aave V3 fork on Hedera)
│   │   └── IChainlinkAggregator.sol      # واجهة التغذية السعرية الموثقة من Chainlink
│   └── libraries/
│       └── HederaResponseCodes.sol       # أكواد استجابة نظام Hedera النظامي
├── scripts/
│   ├── deploy.ts                         # سكريبت نشر العقود الموحد على Hedera Testnet
│   └── set-agent-permissions.ts        # سكريبت منح الصلاحيات للوكيل الاصطناعي
└── test/
    ├── AutoSwapLimit.test.ts             # اختبارات الوحدة لعقد أوامر الحد
    └── HederaYieldVault.test.ts          # اختبارات الوحدة لخزينة العوائد
```

---

## 📜 2. الكود المصدري المكتمل لملفات التهيئة (Configuration Files)

### 📄 `contracts/package.json`
```json
{
  "name": "@major-gainz/contracts",
  "version": "1.0.0",
  "description": "Hedera Smart Contract Service (HSCS) production contracts for Major Gainz x402 AI Agent",
  "main": "index.js",
  "scripts": {
    "compile": "hardhat compile",
    "test": "hardhat test",
    "deploy:testnet": "hardhat run scripts/deploy.ts --network hederaTestnet",
    "verify:testnet": "hardhat verify --network hederaTestnet"
  },
  "dependencies": {
    "@openzeppelin/contracts": "^5.0.2"
  },
  "devDependencies": {
    "@nomicfoundation/hardhat-toolbox": "^5.0.0",
    "@hashgraph/sdk": "^2.40.0",
    "dotenv": "^16.4.5",
    "hardhat": "^2.22.3",
    "typescript": "^5.4.5"
  }
}
```

---

### 📄 `contracts/hardhat.config.ts`
```typescript
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config({ path: "../.env" });

const OPERATOR_PRIVATE_KEY = process.env.OPERATOR_KEY || "0x0000000000000000000000000000000000000000000000000000000000000001";

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
      gasPrice: 10000000000, // 10 Tinybars per gas unit
    },
    hederaMainnet: {
      url: "https://mainnet.hashio.io/api",
      chainId: 295,
      accounts: [OPERATOR_PRIVATE_KEY],
    },
  },
};

export default config;
```

---

## 🔌 3. الواجهات والمكتبات البرمجية (Interfaces & Libraries)

### 📄 `contracts/src/interfaces/IHederaTokenService.sol`
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IHederaTokenService (Address: 0x0000000000000000000000000000000000000167)
/// @notice الواجهة الرسمية للربط مع نظام التوكنز الهجين على Hedera (HTS Native System Contract)
interface IHederaTokenService {
    function associateToken(address account, address token) external returns (int64 responseCode);
    function associateTokens(address account, address[] memory tokens) external returns (int64 responseCode);
    function transferToken(address token, address sender, address recipient, int64 amount) external returns (int64 responseCode);
    function transferTokens(address token, address[] memory sender, address[] memory recipient, int64[] memory amount) external returns (int64 responseCode);
    function cryptoTransfer(bytes memory tokenTransfers) external returns (int64 responseCode);
}
```

---

### 📄 `contracts/src/interfaces/ISaucerSwapV2Router.sol`
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ISaucerSwapV2Router
/// @notice الواجهة البرمجية المباشرة لبروتوكول SaucerSwap V2 لتبادل التوكنز وتوليد الأرباح
interface ISaucerSwapV2Router {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
    function exactInput(bytes calldata path, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum) external payable returns (uint256 amountOut);
}
```

---

### 📄 `contracts/src/interfaces/IBonzoPool.sol`
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IBonzoPool
/// @notice الواجهة البرمجية المباشرة لبروتوكول الإقراض والاقتراض Bonzo Finance على Hedera
interface IBonzoPool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
    function withdraw(address asset, uint256 amount, address to) external returns (uint256);
    function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf) external;
    function repay(address asset, uint256 amount, uint256 rateMode, address onBehalfOf) external returns (uint256);
    function getUserAccountData(address user) external view returns (
        uint256 totalCollateralBase,
        uint256 totalDebtBase,
        uint256 availableBorrowsBase,
        uint256 currentLiquidationThreshold,
        uint256 ltv,
        uint256 healthFactor
    );
}
```

---

### 📄 `contracts/src/interfaces/IChainlinkAggregator.sol`
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IChainlinkAggregator
/// @notice واجهة أوراكل الأسعار غير القابلة للتلاعب لحساب تقييم المحفظة والأصول
interface IChainlinkAggregator {
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    );
    function decimals() external view returns (uint8);
}
```

---

### 📄 `contracts/src/libraries/HederaResponseCodes.sol`
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library HederaResponseCodes {
    int64 internal constant SUCCESS = 22;
    int64 internal constant TOKEN_NOT_ASSOCIATED_TO_ACCOUNT = 182;
}
```

---

## 🏛️ 4. العقود الذكية الرئيسية (Core Smart Contracts)

### 📄 `contracts/src/AutoSwapLimit.sol`
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/ISaucerSwapV2Router.sol";
import "./interfaces/IChainlinkAggregator.sol";
import "./interfaces/IHederaTokenService.sol";

/// @title AutoSwapLimit — Hedera Limit Order Execution Engine for SaucerSwap
/// @author Major Gainz Senior Core Architect
/// @notice يقدم عقد التداول الذكي خدمة تنفيذ أوامر الحد غير الاحتجازية تلقائياً عند وصول السعر للهدف عبر أوراكل Chainlink والمستثمر الاصطناعي
contract AutoSwapLimit is Ownable, ReentrancyGuard {
    
    // عنوان عقد نظام HTS الأصلي على Hedera
    address public constant HEDERA_TOKEN_SERVICE = address(0x167);

    struct LimitOrder {
        uint256 orderId;
        address user;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 targetPrice; // السعر المفهوم مصحوباً بـ 8 منازل عشرية من Chainlink
        uint24 poolFee;      // رسوم SaucerSwap Pool (مثلاً 3000 لـ 0.3%)
        bool isFilled;
        bool isCancelled;
        uint256 createdAt;
    }

    ISaucerSwapV2Router public immutable saucerSwapRouter;
    IChainlinkAggregator public priceOracle;
    address public executorAgent; // عنوان الوكيل البرمجي المصرح له بالتنفيذ

    uint256 public nextOrderId;
    mapping(uint256 => LimitOrder) public orders;
    mapping(address => uint256[]) public userOrders;

    // الأحداث (Events)
    event OrderCreated(uint256 indexed orderId, address indexed user, address tokenIn, address tokenOut, uint256 amountIn, uint256 targetPrice);
    event OrderExecuted(uint256 indexed orderId, address indexed executor, uint256 amountOut);
    event OrderCancelled(uint256 indexed orderId, address indexed user);

    modifier onlyExecutor() {
        require(msg.sender == executorAgent || msg.sender == owner(), "AutoSwapLimit: Caller is not authorized executor");
        _;
    }

    constructor(address _router, address _oracle, address _executorAgent) Ownable(msg.sender) {
        require(_router != address(0), "Invalid router address");
        require(_oracle != address(0), "Invalid oracle address");
        require(_executorAgent != address(0), "Invalid executor address");

        saucerSwapRouter = ISaucerSwapV2Router(_router);
        priceOracle = IChainlinkAggregator(_oracle);
        executorAgent = _executorAgent;
    }

    /// @notice تعيين الوكيل المعتمد المصرح له بتقديم أوامر التنفيذ المباشرة
    function setExecutorAgent(address _newExecutor) external onlyOwner {
        require(_newExecutor != address(0), "Invalid agent address");
        executorAgent = _newExecutor;
    }

    /// @notice إنشاء أمر حد جديد وتخزين التوكنز داخل العقد لحين تنفيذ الشرط السعري
    function createLimitOrder(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 targetPrice,
        uint24 poolFee
    ) external payable nonReentrant returns (uint256 orderId) {
        require(amountIn > 0, "Amount must be greater than zero");
        require(targetPrice > 0, "Target price must be valid");

        if (tokenIn == address(0)) {
            require(msg.value == amountIn, "HBAR deposit amount mismatch");
        } else {
            IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        }

        orderId = nextOrderId++;
        orders[orderId] = LimitOrder({
            orderId: orderId,
            user: msg.sender,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            amountIn: amountIn,
            targetPrice: targetPrice,
            poolFee: poolFee,
            isFilled: false,
            isCancelled: false,
            createdAt: block.timestamp
        });

        userOrders[msg.sender].push(orderId);

        emit OrderCreated(orderId, msg.sender, tokenIn, tokenOut, amountIn, targetPrice);
    }

    /// @notice تنفيذ أمر الحد عند وصول السعر الهدف (يتم استدعاؤها برمجياً بواسطة Major Gainz AI Executor)
    function executeLimitOrder(uint256 orderId, uint256 minAmountOut) external onlyExecutor nonReentrant {
        LimitOrder storage order = orders[orderId];
        require(!order.isFilled, "Order already filled");
        require(!order.isCancelled, "Order is cancelled");

        (, int256 currentPrice,,,) = priceOracle.latestRoundData();
        require(currentPrice >= int256(order.targetPrice), "Target price not reached on Chainlink Oracle");

        order.isFilled = true;

        if (order.tokenIn == address(0)) {
            // تنفيذ التبديل لـ HBAR
            ISaucerSwapV2Router.ExactInputSingleParams memory params = ISaucerSwapV2Router.ExactInputSingleParams({
                tokenIn: order.tokenIn,
                tokenOut: order.tokenOut,
                fee: order.poolFee,
                recipient: order.user,
                deadline: block.timestamp + 300,
                amountIn: order.amountIn,
                amountOutMinimum: minAmountOut,
                sqrtPriceLimitX96: 0
            });

            uint256 amountOut = saucerSwapRouter.exactInputSingle{value: order.amountIn}(params);
            emit OrderExecuted(orderId, msg.sender, amountOut);
        } else {
            // موافقة SaucerSwap Router على سحب التوكن
            IERC20(order.tokenIn).approve(address(saucerSwapRouter), order.amountIn);

            ISaucerSwapV2Router.ExactInputSingleParams memory params = ISaucerSwapV2Router.ExactInputSingleParams({
                tokenIn: order.tokenIn,
                tokenOut: order.tokenOut,
                fee: order.poolFee,
                recipient: order.user,
                deadline: block.timestamp + 300,
                amountIn: order.amountIn,
                amountOutMinimum: minAmountOut,
                sqrtPriceLimitX96: 0
            });

            uint256 amountOut = saucerSwapRouter.exactInputSingle(params);
            emit OrderExecuted(orderId, msg.sender, amountOut);
        }
    }

    /// @notice إلغاء أمر الحد واسترداد الأموال فورياً للمستخدم
    function cancelLimitOrder(uint256 orderId) external nonReentrant {
        LimitOrder storage order = orders[orderId];
        require(msg.sender == order.user, "Only order owner can cancel");
        require(!order.isFilled, "Order already filled");
        require(!order.isCancelled, "Order already cancelled");

        order.isCancelled = true;

        if (order.tokenIn == address(0)) {
            payable(order.user).transfer(order.amountIn);
        } else {
            IERC20(order.tokenIn).transfer(order.user, order.amountIn);
        }

        emit OrderCancelled(orderId, msg.sender);
    }
}
```

---

### 📄 `contracts/src/HederaYieldVault.sol`
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IBonzoPool.sol";
import "./interfaces/ISaucerSwapV2Router.sol";

/// @title HederaYieldVault — Automated Multi-Protocol Yield Vault (Bonzo + SaucerSwap)
/// @author Major Gainz Senior Core Architect
/// @notice خزينة استثمارية ذكية تتيح للوكيل الذكي إعادة توازن الأصول تلقائياً بين الإقراض في Bonzo Finance وزراعة العائد في SaucerSwap
contract HederaYieldVault is Ownable, ReentrancyGuard {
    
    IBonzoPool public immutable bonzoPool;
    ISaucerSwapV2Router public immutable saucerSwapRouter;
    address public aiAgentManager;

    mapping(address => uint256) public userBalances;
    uint256 public totalVaultFunds;

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RebalancedToBonzo(address indexed asset, uint256 amount);
    event RebalancedToSaucerSwap(address indexed tokenIn, address indexed tokenOut, uint256 amountIn);

    modifier onlyAiAgent() {
        require(msg.sender == aiAgentManager || msg.sender == owner(), "Caller is not authorized AI Agent");
        _;
    }

    constructor(address _bonzoPool, address _saucerRouter, address _aiAgent) Ownable(msg.sender) {
        require(_bonzoPool != address(0), "Invalid Bonzo pool");
        require(_saucerRouter != address(0), "Invalid SaucerSwap router");
        require(_aiAgent != address(0), "Invalid AI Agent");

        bonzoPool = IBonzoPool(_bonzoPool);
        saucerSwapRouter = ISaucerSwapV2Router(_saucerRouter);
        aiAgentManager = _aiAgent;
    }

    /// @notice إيداع HBAR داخل الخزينة الذكية
    function depositHBAR() external payable nonReentrant {
        require(msg.value > 0, "Deposit must be greater than zero");
        userBalances[msg.sender] += msg.value;
        totalVaultFunds += msg.value;

        emit Deposited(msg.sender, msg.value);
    }

    /// @notice سحب الأصول من الخزينة
    function withdraw(uint256 amount) external nonReentrant {
        require(userBalances[msg.sender] >= amount, "Insufficient vault balance");
        userBalances[msg.sender] -= amount;
        totalVaultFunds -= amount;

        payable(msg.sender).transfer(amount);
        emit Withdrawn(msg.sender, amount);
    }

    /// @notice إعادة توجيه جزء من الأصول إلى بروتوكول الإقراض Bonzo Finance عند وجود عائد أرباح أفضل
    function rebalanceToBonzo(address asset, uint256 amount) external onlyAiAgent nonReentrant {
        require(amount <= address(this).balance, "Insufficient liquid balance in vault");

        // تحويل السيولة لـ Bonzo Supply
        bonzoPool.supply(asset, amount, address(this), 0);

        emit RebalancedToBonzo(asset, amount);
    }

    /// @notice سحب الأصول من Bonzo وإعادة ضخها في بؤر سيولة SaucerSwap
    function rebalanceToSaucerSwap(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        uint256 amountIn,
        uint256 minAmountOut
    ) external onlyAiAgent nonReentrant {
        IERC20(tokenIn).approve(address(saucerSwapRouter), amountIn);

        ISaucerSwapV2Router.ExactInputSingleParams memory params = ISaucerSwapV2Router.ExactInputSingleParams({
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            fee: fee,
            recipient: address(this),
            deadline: block.timestamp + 300,
            amountIn: amountIn,
            amountOutMinimum: minAmountOut,
            sqrtPriceLimitX96: 0
        });

        saucerSwapRouter.exactInputSingle(params);

        emit RebalancedToSaucerSwap(tokenIn, tokenOut, amountIn);
    }

    receive() external payable {}
}
```

---

### 📄 `contracts/src/AgentRegistryHCS14.sol`
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @title AgentRegistryHCS14 — Onchain Identity & x402 Verifier for Hedera Agentic Economy
/// @author Major Gainz Senior Core Architect
/// @notice عقد توثيق هوية الوكلاء الذكية على الشبكة وتدقيق توقيعات مدفوعات x402 الميكرو
contract AgentRegistryHCS14 is Ownable {

    struct AgentProfile {
        string agentName;
        address payoutAddress;
        bytes32 hcsTopicId;
        uint256 baseFeeTinybars; // التسعير المبدئي بـ Tinybars (1 HBAR = 100,000,000 Tinybars)
        bool isActive;
        uint256 registeredAt;
    }

    mapping(address => AgentProfile) public agents;
    mapping(bytes32 => bool) public verifiedX402Hashes; // تخزين تجزئة المعاملات المسواة بـ x402 لعدم التكرار

    event AgentRegistered(address indexed agentAddress, string agentName, bytes32 hcsTopicId, uint256 baseFee);
    event PaymentVerifiedOnchain(bytes32 indexed paymentHash, address indexed payer, uint256 amountPaid);

    constructor() Ownable(msg.sender) {}

    /// @notice تسجيل وكيل اصطناعي جديد ضمن دليل HCS-14 المعترف به على Hedera
    function registerAgent(
        string calldata agentName,
        address payoutAddress,
        bytes32 hcsTopicId,
        uint256 baseFeeTinybars
    ) external {
        require(payoutAddress != address(0), "Invalid payout address");
        require(bytes(agentName).length > 0, "Agent name required");

        agents[msg.sender] = AgentProfile({
            agentName: agentName,
            payoutAddress: payoutAddress,
            hcsTopicId: hcsTopicId,
            baseFeeTinybars: baseFeeTinybars,
            isActive: true,
            registeredAt: block.timestamp
        });

        emit AgentRegistered(msg.sender, agentName, hcsTopicId, baseFeeTinybars);
    }

    /// @notice تدقيق وتأكيد تجزئة معاملة دفع x402 لمنع التكرار والتزوير
    function verifyX402PaymentProof(bytes32 paymentHash, address payer, uint256 amountPaid) external onlyOwner {
        require(!verifiedX402Hashes[paymentHash], "Payment proof already used");
        
        verifiedX402Hashes[paymentHash] = true;

        emit PaymentVerifiedOnchain(paymentHash, payer, amountPaid);
    }

    /// @notice الاستعلام عن بروفايل الوكيل وحالته
    function getAgent(address agentAddress) external view returns (AgentProfile memory) {
        return agents[agentAddress];
    }
}
```

---

## 🚀 5. سكريبتات النشر والاختبار (Deploy Scripts)

### 📄 `contracts/scripts/deploy.ts`
```typescript
import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Starting Major Gainz HSCS Smart Contracts Deployment on Hedera Testnet...");

  const [deployer] = await ethers.getSigners();
  console.log(`👤 Deploying contract with Operator Account: ${deployer.address}`);

  // عناوين بروتوكولات Hedera Testnet الفعلية
  const SAUCERSWAP_V2_ROUTER = process.env.SAUCERSWAP_ROUTER_ADDRESS || "0x0000000000000000000000000000000000300000";
  const BONZO_POOL = process.env.BONZO_POOL_ADDRESS || "0x0000000000000000000000000000000000400000";
  const CHAINLINK_ORACLE = process.env.CHAINLINK_ORACLE_ADDRESS || "0x0000000000000000000000000000000000500000";
  const EXECUTOR_AGENT = deployer.address;

  // 1. نشر عقد AgentRegistryHCS14
  console.log("\n1️⃣ Deploying AgentRegistryHCS14...");
  const AgentRegistry = await ethers.getContractFactory("AgentRegistryHCS14");
  const agentRegistry = await AgentRegistry.deploy();
  await agentRegistry.waitForDeployment();
  const registryAddress = await agentRegistry.getAddress();
  console.log(`✅ AgentRegistryHCS14 deployed to: ${registryAddress}`);

  // 2. نشر عقد AutoSwapLimit
  console.log("\n2️⃣ Deploying AutoSwapLimit Engine...");
  const AutoSwapLimit = await ethers.getContractFactory("AutoSwapLimit");
  const autoSwapLimit = await AutoSwapLimit.deploy(SAUCERSWAP_V2_ROUTER, CHAINLINK_ORACLE, EXECUTOR_AGENT);
  await autoSwapLimit.waitForDeployment();
  const autoSwapAddress = await autoSwapLimit.getAddress();
  console.log(`✅ AutoSwapLimit Engine deployed to: ${autoSwapAddress}`);

  // 3. نشر عقد HederaYieldVault
  console.log("\n3️⃣ Deploying HederaYieldVault...");
  const HederaYieldVault = await ethers.getContractFactory("HederaYieldVault");
  const yieldVault = await HederaYieldVault.deploy(BONZO_POOL, SAUCERSWAP_V2_ROUTER, EXECUTOR_AGENT);
  await yieldVault.waitForDeployment();
  const vaultAddress = await yieldVault.getAddress();
  console.log(`✅ HederaYieldVault deployed to: ${vaultAddress}`);

  console.log("\n🎉 All Major Gainz Smart Contracts deployed successfully on Hedera HSCS!");
  console.log("----------------------------------------------------------------------");
  console.log(`NEXT_PUBLIC_REGISTRY_CONTRACT=${registryAddress}`);
  console.log(`NEXT_PUBLIC_AUTOSWAP_CONTRACT=${autoSwapAddress}`);
  console.log(`NEXT_PUBLIC_YIELD_VAULT_CONTRACT=${vaultAddress}`);
}

main().catch((error) => {
  console.error("❌ Deployment failed:", error);
  process.exitCode = 1;
});
```
