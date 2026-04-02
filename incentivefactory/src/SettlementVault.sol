// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @title SettlementVault
/// @notice Escrow for stablecoin subsidies. The municipality deposits stablecoins;
/// the IncentiveFactory calls `release()` to pay providers upon PoS token redemption.
contract SettlementVault is Ownable2Step {
    using SafeERC20 for IERC20;

    IERC20 public immutable settlementToken;
    address public factory;

    uint256 public totalDeposited;
    uint256 public totalReleased;

    event Deposited(address indexed depositor, uint256 amount);
    event Released(address indexed to, uint256 amount);
    event FactoryUpdated(address indexed oldFactory, address indexed newFactory);

    error OnlyFactory();
    error InsufficientVaultBalance(uint256 requested, uint256 available);
    error ZeroAmount();

    modifier onlyFactory() {
        if (msg.sender != factory) revert OnlyFactory();
        _;
    }

    /// @param token The ERC-20 stablecoin used for settlement (e.g., MockZAR)
    /// @param owner_ The municipality or admin who can deposit and configure
    constructor(IERC20 token, address owner_) Ownable(owner_) {
        settlementToken = token;
    }

    /// @notice Set the IncentiveFactory address authorized to release funds.
    /// @param factory_ The IncentiveFactory contract address
    function setFactory(address factory_) external onlyOwner {
        emit FactoryUpdated(factory, factory_);
        factory = factory_;
    }

    /// @notice Deposit stablecoins into the vault (municipality funds the subsidy pool).
    /// @param amount Amount of stablecoin to deposit
    function deposit(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        totalDeposited += amount;
        settlementToken.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(msg.sender, amount);
    }

    /// @notice Release stablecoins to a provider. Only callable by the IncentiveFactory.
    /// @param to Provider address receiving settlement
    /// @param amount Amount of stablecoin to release
    function release(address to, uint256 amount) external onlyFactory {
        if (amount == 0) revert ZeroAmount();
        uint256 bal = settlementToken.balanceOf(address(this));
        if (bal < amount) revert InsufficientVaultBalance(amount, bal);
        totalReleased += amount;
        settlementToken.safeTransfer(to, amount);
        emit Released(to, amount);
    }

    /// @notice View the current vault balance.
    function vaultBalance() external view returns (uint256) {
        return settlementToken.balanceOf(address(this));
    }
}
