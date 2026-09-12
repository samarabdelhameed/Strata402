// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/ISaucerSwapV2Router.sol";
import "./interfaces/IChainlinkAggregator.sol";
import "./interfaces/IHederaTokenService.sol";

/// @title AutoSwapLimit — Hedera Limit Order Execution Engine for SaucerSwap
/// @notice Non-custodial limit order execution engine on Hedera HSCS
contract AutoSwapLimit is Ownable, ReentrancyGuard {
    
    address public constant HEDERA_TOKEN_SERVICE = address(0x167);

    struct LimitOrder {
        uint256 orderId;
        address user;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 targetPrice;
        uint24 poolFee;
        bool isFilled;
        bool isCancelled;
        uint256 createdAt;
    }

    ISaucerSwapV2Router public immutable saucerSwapRouter;
    IChainlinkAggregator public priceOracle;
    address public executorAgent;

    uint256 public nextOrderId;
    mapping(uint256 => LimitOrder) public orders;
    mapping(address => uint256[]) public userOrders;

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

    function setExecutorAgent(address _newExecutor) external onlyOwner {
        require(_newExecutor != address(0), "Invalid agent address");
        executorAgent = _newExecutor;
    }

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

    function executeLimitOrder(uint256 orderId, uint256 minAmountOut) external onlyExecutor nonReentrant {
        LimitOrder storage order = orders[orderId];
        require(!order.isFilled, "Order already filled");
        require(!order.isCancelled, "Order is cancelled");

        (, int256 currentPrice,,,) = priceOracle.latestRoundData();
        require(currentPrice >= int256(order.targetPrice), "Target price not reached on Chainlink Oracle");

        order.isFilled = true;

        if (order.tokenIn == address(0)) {
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
