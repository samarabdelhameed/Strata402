// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IBonzoPool.sol";
import "./interfaces/ISaucerSwapV2Router.sol";

/// @title HederaYieldVault — Automated Multi-Protocol Yield Vault (Bonzo + SaucerSwap)
/// @notice Automated yield rebalancing vault on Hedera HSCS
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

    function depositHBAR() external payable nonReentrant {
        require(msg.value > 0, "Deposit must be greater than zero");
        userBalances[msg.sender] += msg.value;
        totalVaultFunds += msg.value;

        emit Deposited(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external nonReentrant {
        require(userBalances[msg.sender] >= amount, "Insufficient vault balance");
        userBalances[msg.sender] -= amount;
        totalVaultFunds -= amount;

        payable(msg.sender).transfer(amount);
        emit Withdrawn(msg.sender, amount);
    }

    function rebalanceToBonzo(address asset, uint256 amount) external onlyAiAgent nonReentrant {
        require(amount <= address(this).balance, "Insufficient liquid balance in vault");

        bonzoPool.supply(asset, amount, address(this), 0);

        emit RebalancedToBonzo(asset, amount);
    }

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
