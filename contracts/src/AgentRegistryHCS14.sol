// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @title AgentRegistryHCS14 — Onchain Identity & x402 Verifier for Hedera Agentic Economy
/// @notice On-chain agent identity registry and x402 payment proof verifier
contract AgentRegistryHCS14 is Ownable {

    struct AgentProfile {
        string agentName;
        address payoutAddress;
        bytes32 hcsTopicId;
        uint256 baseFeeTinybars;
        bool isActive;
        uint256 registeredAt;
    }

    mapping(address => AgentProfile) public agents;
    mapping(bytes32 => bool) public verifiedX402Hashes;

    event AgentRegistered(address indexed agentAddress, string agentName, bytes32 hcsTopicId, uint256 baseFee);
    event PaymentVerifiedOnchain(bytes32 indexed paymentHash, address indexed payer, uint256 amountPaid);

    constructor() Ownable(msg.sender) {}

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

    function verifyX402PaymentProof(bytes32 paymentHash, address payer, uint256 amountPaid) external onlyOwner {
        require(!verifiedX402Hashes[paymentHash], "Payment proof already used");
        
        verifiedX402Hashes[paymentHash] = true;

        emit PaymentVerifiedOnchain(paymentHash, payer, amountPaid);
    }

    function getAgent(address agentAddress) external view returns (AgentProfile memory) {
        return agents[agentAddress];
    }
}
