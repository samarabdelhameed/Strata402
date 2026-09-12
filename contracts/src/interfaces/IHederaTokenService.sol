// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IHederaTokenService (Address: 0x0000000000000000000000000000000000000167)
/// @notice IHederaTokenService system contract interface on Hedera
interface IHederaTokenService {
    function associateToken(address account, address token) external returns (int64 responseCode);
    function associateTokens(address account, address[] memory tokens) external returns (int64 responseCode);
    function transferToken(address token, address sender, address recipient, int64 amount) external returns (int64 responseCode);
    function transferTokens(address token, address[] memory sender, address[] memory recipient, int64[] memory amount) external returns (int64 responseCode);
    function cryptoTransfer(bytes memory tokenTransfers) external returns (int64 responseCode);
}
