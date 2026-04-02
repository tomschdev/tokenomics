// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {MockZAR} from "../src/MockZAR.sol";
import {SettlementVault} from "../src/SettlementVault.sol";
import {IncentiveFactory} from "../src/IncentiveFactory.sol";

/// @title SimulateStellenbosch
/// @notice End-to-end simulation of the e-scooter subsidy flow on a local Anvil node.
///
/// Actors:
///   - Municipality (deployer): Funds the subsidy pool
///   - Reporter (oracle): GoNow API equivalent, records ride activity
///   - Provider (GoNow): Receives PoS tokens and redeems for ZAR settlement
///
/// Run: anvil & forge script script/SimulateStellenbosch.s.sol --broadcast --rpc-url http://127.0.0.1:8545
contract SimulateStellenbosch is Script {
    // Anvil default accounts
    address constant MUNICIPALITY = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266; // Account 0
    address constant REPORTER = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8; // Account 1
    address constant PROVIDER_GONOW = 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC; // Account 2

    uint256 constant MUNICIPALITY_PK = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
    uint256 constant REPORTER_PK = 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d;
    uint256 constant PROVIDER_PK = 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a;

    // Subsidy rate: 150 cents (R1.50) per km
    uint256 constant SUBSIDY_RATE = 150;
    // Municipality deposits R100,000 (10_000_000 cents) into the subsidy pool
    uint256 constant INITIAL_DEPOSIT = 10_000_000;

    function run() external {
        // ── Step 1: Municipality deploys all contracts ──
        console.log("=== STELLENBOSCH E-SCOOTER SUBSIDY SIMULATION ===");
        console.log("");

        vm.startBroadcast(MUNICIPALITY_PK);

        MockZAR zar = new MockZAR();
        console.log("MockZAR deployed at:", address(zar));

        SettlementVault vault = new SettlementVault(zar, MUNICIPALITY);
        console.log("SettlementVault deployed at:", address(vault));

        IncentiveFactory factory = new IncentiveFactory(MUNICIPALITY);
        console.log("IncentiveFactory deployed at:", address(factory));

        // Link vault to factory
        vault.setFactory(address(factory));

        // Grant reporter role to the oracle address
        factory.grantRole(factory.REPORTER_ROLE(), REPORTER);

        // Create the e-scooter scheme (ID 0)
        uint256 schemeId = factory.createScheme(
            "Stellenbosch E-Scooter Subsidy",
            PROVIDER_GONOW,
            address(vault),
            SUBSIDY_RATE
        );
        console.log("Scheme created with ID:", schemeId);

        // Fund the vault: mint ZAR to municipality, approve vault, deposit
        zar.mint(MUNICIPALITY, INITIAL_DEPOSIT);
        zar.approve(address(vault), INITIAL_DEPOSIT);
        vault.deposit(INITIAL_DEPOSIT);
        console.log("Vault funded with", INITIAL_DEPOSIT, "cents (R100,000)");

        vm.stopBroadcast();

        // ── Step 2: Reporter records ride activity ──
        console.log("");
        console.log("--- Simulating daily rides ---");

        vm.startBroadcast(REPORTER_PK);

        // Day 1: 500 km total across all riders
        factory.recordActivity(schemeId, 500);
        console.log("Day 1: Recorded 500 km of rides");

        // Day 2: 750 km
        factory.recordActivity(schemeId, 750);
        console.log("Day 2: Recorded 750 km of rides");

        // Day 3: 300 km
        factory.recordActivity(schemeId, 300);
        console.log("Day 3: Recorded 300 km of rides");

        vm.stopBroadcast();

        // ── Step 3: Provider redeems PoS tokens for ZAR ──
        console.log("");
        console.log("--- Provider redemption ---");

        vm.startBroadcast(PROVIDER_PK);

        uint256 posBalance = factory.balanceOf(PROVIDER_GONOW, schemeId);
        console.log("Provider PoS token balance:", posBalance, "km");

        // Redeem all accumulated activity
        factory.redeem(schemeId, posBalance);
        uint256 zarBalance = zar.balanceOf(PROVIDER_GONOW);
        console.log("Provider redeemed for", zarBalance, "cents");
        console.log("  = R", zarBalance / 100);

        vm.stopBroadcast();

        // ── Summary ──
        console.log("");
        console.log("=== SIMULATION SUMMARY ===");
        console.log("Total rides recorded: 1550 km");
        console.log("Subsidy rate: R1.50/km");
        console.log("Expected payout: R2,325");
        console.log("Actual payout: R", zarBalance / 100);
        console.log("Vault remaining:", vault.vaultBalance(), "cents");
    }
}
