// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {IncentiveFactory} from "../src/IncentiveFactory.sol";
import {SettlementVault} from "../src/SettlementVault.sol";
import {MockZAR} from "../src/MockZAR.sol";

contract IncentiveFactoryTest is Test {
    IncentiveFactory factory;
    SettlementVault vault;
    MockZAR zar;

    address admin = makeAddr("admin");
    address reporter = makeAddr("reporter");
    address provider = makeAddr("provider");
    address nobody = makeAddr("nobody");

    uint256 constant SUBSIDY_RATE = 150; // 150 cents = R1.50 per km
    uint256 constant DEPOSIT = 10_000_000; // R100,000

    uint256 schemeId;

    function setUp() public {
        vm.startPrank(admin);

        zar = new MockZAR();
        vault = new SettlementVault(zar, admin);
        factory = new IncentiveFactory(admin);

        vault.setFactory(address(factory));
        factory.grantRole(factory.REPORTER_ROLE(), reporter);

        schemeId = factory.createScheme("E-Scooter Subsidy", provider, address(vault), SUBSIDY_RATE);

        // Fund vault
        zar.mint(admin, DEPOSIT);
        zar.approve(address(vault), DEPOSIT);
        vault.deposit(DEPOSIT);

        vm.stopPrank();
    }

    // ── Scheme creation ──

    function test_createScheme() public view {
        IncentiveFactory.Scheme memory s = factory.getScheme(schemeId);
        assertEq(s.name, "E-Scooter Subsidy");
        assertEq(s.provider, provider);
        assertEq(s.vault, address(vault));
        assertEq(s.subsidyRate, SUBSIDY_RATE);
        assertTrue(s.active);
    }

    function test_createScheme_incrementsId() public {
        vm.prank(admin);
        uint256 id2 = factory.createScheme("Recycling", provider, address(vault), 100);
        assertEq(id2, 1);
    }

    function test_createScheme_revert_unauthorized() public {
        vm.prank(nobody);
        vm.expectRevert();
        factory.createScheme("Fail", provider, address(vault), 100);
    }

    // ── Activity recording ──

    function test_recordActivity() public {
        vm.prank(reporter);
        factory.recordActivity(schemeId, 500);

        assertEq(factory.balanceOf(provider, schemeId), 500);
        IncentiveFactory.Scheme memory s = factory.getScheme(schemeId);
        assertEq(s.totalRecorded, 500);
    }

    function test_recordActivity_revert_zeroAmount() public {
        vm.prank(reporter);
        vm.expectRevert(IncentiveFactory.InvalidAmount.selector);
        factory.recordActivity(schemeId, 0);
    }

    function test_recordActivity_revert_unauthorized() public {
        vm.prank(nobody);
        vm.expectRevert();
        factory.recordActivity(schemeId, 100);
    }

    function test_recordActivity_revert_pausedScheme() public {
        vm.prank(admin);
        factory.pauseScheme(schemeId);

        vm.prank(reporter);
        vm.expectRevert(abi.encodeWithSelector(IncentiveFactory.SchemeNotActive.selector, schemeId));
        factory.recordActivity(schemeId, 100);
    }

    // ── Redemption ──

    function test_redeem() public {
        vm.prank(reporter);
        factory.recordActivity(schemeId, 1000);

        vm.prank(provider);
        factory.redeem(schemeId, 1000);

        assertEq(factory.balanceOf(provider, schemeId), 0);
        assertEq(zar.balanceOf(provider), 1000 * SUBSIDY_RATE);

        IncentiveFactory.Scheme memory s = factory.getScheme(schemeId);
        assertEq(s.totalRedeemed, 1000);
    }

    function test_redeem_partial() public {
        vm.prank(reporter);
        factory.recordActivity(schemeId, 1000);

        vm.prank(provider);
        factory.redeem(schemeId, 400);

        assertEq(factory.balanceOf(provider, schemeId), 600);
        assertEq(zar.balanceOf(provider), 400 * SUBSIDY_RATE);
    }

    function test_redeem_revert_notProvider() public {
        vm.prank(reporter);
        factory.recordActivity(schemeId, 100);

        vm.prank(nobody);
        vm.expectRevert(abi.encodeWithSelector(IncentiveFactory.NotSchemeProvider.selector, schemeId, nobody));
        factory.redeem(schemeId, 100);
    }

    function test_redeem_revert_insufficientBalance() public {
        vm.prank(reporter);
        factory.recordActivity(schemeId, 100);

        vm.prank(provider);
        vm.expectRevert(abi.encodeWithSelector(IncentiveFactory.InsufficientBalance.selector, schemeId, 200, 100));
        factory.redeem(schemeId, 200);
    }

    // ── Pause / Unpause ──

    function test_pauseAndUnpause() public {
        vm.startPrank(admin);
        factory.pauseScheme(schemeId);
        assertFalse(factory.getScheme(schemeId).active);

        factory.unpauseScheme(schemeId);
        assertTrue(factory.getScheme(schemeId).active);
        vm.stopPrank();
    }

    // ── Fuzz tests ──

    function testFuzz_recordAndRedeem(uint256 amount) public {
        // Bound: at least 1 km, max that vault can pay out
        amount = bound(amount, 1, DEPOSIT / SUBSIDY_RATE);

        vm.prank(reporter);
        factory.recordActivity(schemeId, amount);

        assertEq(factory.balanceOf(provider, schemeId), amount);

        vm.prank(provider);
        factory.redeem(schemeId, amount);

        assertEq(factory.balanceOf(provider, schemeId), 0);
        assertEq(zar.balanceOf(provider), amount * SUBSIDY_RATE);
    }

    function testFuzz_multipleRecordsThenRedeem(uint256 a, uint256 b, uint256 c) public {
        uint256 maxPerRecord = (DEPOSIT / SUBSIDY_RATE) / 3;
        a = bound(a, 1, maxPerRecord);
        b = bound(b, 1, maxPerRecord);
        c = bound(c, 1, maxPerRecord);

        vm.startPrank(reporter);
        factory.recordActivity(schemeId, a);
        factory.recordActivity(schemeId, b);
        factory.recordActivity(schemeId, c);
        vm.stopPrank();

        uint256 total = a + b + c;
        assertEq(factory.balanceOf(provider, schemeId), total);

        vm.prank(provider);
        factory.redeem(schemeId, total);

        assertEq(zar.balanceOf(provider), total * SUBSIDY_RATE);
    }
}
