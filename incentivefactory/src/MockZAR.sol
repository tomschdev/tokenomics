// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockZAR
/// @notice Mock ZAR stablecoin for local Anvil simulation. Freely mintable.
contract MockZAR is ERC20 {
    uint8 private constant _DECIMALS = 2; // ZAR uses 2 decimal places (cents)

    constructor() ERC20("Mock ZAR Stablecoin", "mZAR") {}

    function decimals() public pure override returns (uint8) {
        return _DECIMALS;
    }

    /// @notice Mint tokens to any address. Only for testing/simulation.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
