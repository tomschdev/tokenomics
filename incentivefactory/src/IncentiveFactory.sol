// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title IncentiveFactory
/// @notice Multi-tenant incentive scheme manager using ERC-1155 Proof-of-Service tokens.
/// Each token ID represents a distinct incentive scheme (e.g., ID 0 = Stellenbosch e-scooter subsidy).
/// Gov deposits stablecoin into a linked SettlementVault; providers redeem PoS tokens for settlement.
contract IncentiveFactory is ERC1155, AccessControl {
    using SafeERC20 for IERC20;

    bytes32 public constant REPORTER_ROLE = keccak256("REPORTER_ROLE");
    bytes32 public constant SCHEME_ADMIN_ROLE = keccak256("SCHEME_ADMIN_ROLE");

    struct Scheme {
        string name;
        address provider; // Service provider who receives settlement
        address vault; // SettlementVault address holding escrowed stablecoins
        uint256 subsidyRate; // Stablecoin units per activity unit (e.g., cents per km)
        uint256 totalRecorded; // Total activity units recorded
        uint256 totalRedeemed; // Total activity units redeemed
        bool active;
    }

    uint256 public nextSchemeId;
    mapping(uint256 => Scheme) public schemes;

    event SchemeCreated(uint256 indexed schemeId, string name, address provider, address vault, uint256 subsidyRate);
    event ActivityRecorded(uint256 indexed schemeId, address indexed provider, uint256 amount);
    event Redeemed(uint256 indexed schemeId, address indexed provider, uint256 amount, uint256 payout);
    event SchemePaused(uint256 indexed schemeId);
    event SchemeUnpaused(uint256 indexed schemeId);

    error SchemeNotActive(uint256 schemeId);
    error SchemeDoesNotExist(uint256 schemeId);
    error InvalidAmount();
    error NotSchemeProvider(uint256 schemeId, address caller);
    error InsufficientBalance(uint256 schemeId, uint256 requested, uint256 available);

    constructor(address admin) ERC1155("") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(SCHEME_ADMIN_ROLE, admin);
    }

    /// @notice Register a new incentive scheme.
    /// @param name Human-readable scheme name
    /// @param provider Address of the service provider (e.g., GoNow)
    /// @param vault SettlementVault holding escrowed stablecoin for this scheme
    /// @param subsidyRate Stablecoin units paid per activity unit
    /// @return schemeId The ID of the newly created scheme (also the ERC-1155 token ID)
    function createScheme(string calldata name, address provider, address vault, uint256 subsidyRate)
        external
        onlyRole(SCHEME_ADMIN_ROLE)
        returns (uint256 schemeId)
    {
        schemeId = nextSchemeId++;
        schemes[schemeId] = Scheme({
            name: name,
            provider: provider,
            vault: vault,
            subsidyRate: subsidyRate,
            totalRecorded: 0,
            totalRedeemed: 0,
            active: true
        });
        emit SchemeCreated(schemeId, name, provider, vault, subsidyRate);
    }

    /// @notice Record subsidized activity — mints Proof-of-Service tokens to the provider.
    /// @dev Called by a trusted reporter (e.g., GoNow API oracle).
    /// @param schemeId The incentive scheme ID
    /// @param amount Activity units to record (e.g., kilometers ridden)
    function recordActivity(uint256 schemeId, uint256 amount) external onlyRole(REPORTER_ROLE) {
        if (amount == 0) revert InvalidAmount();
        Scheme storage scheme = _getActiveScheme(schemeId);
        scheme.totalRecorded += amount;
        _mint(scheme.provider, schemeId, amount, "");
        emit ActivityRecorded(schemeId, scheme.provider, amount);
    }

    /// @notice Redeem Proof-of-Service tokens for stablecoin settlement.
    /// @dev Only the scheme's designated provider can redeem. Burns PoS tokens and
    ///      triggers stablecoin release from the vault.
    /// @param schemeId The incentive scheme ID
    /// @param amount Activity units to redeem
    function redeem(uint256 schemeId, uint256 amount) external {
        if (amount == 0) revert InvalidAmount();
        Scheme storage scheme = _getActiveScheme(schemeId);
        if (msg.sender != scheme.provider) revert NotSchemeProvider(schemeId, msg.sender);

        uint256 balance = balanceOf(scheme.provider, schemeId);
        if (balance < amount) revert InsufficientBalance(schemeId, amount, balance);

        scheme.totalRedeemed += amount;
        _burn(scheme.provider, schemeId, amount);

        uint256 payout = amount * scheme.subsidyRate;
        // Pull payout from vault — vault must have approved this contract
        ISettlementVault(scheme.vault).release(scheme.provider, payout);

        emit Redeemed(schemeId, scheme.provider, amount, payout);
    }

    /// @notice Pause a scheme, preventing new activity recording and redemptions.
    function pauseScheme(uint256 schemeId) external onlyRole(SCHEME_ADMIN_ROLE) {
        Scheme storage scheme = schemes[schemeId];
        if (bytes(scheme.name).length == 0) revert SchemeDoesNotExist(schemeId);
        scheme.active = false;
        emit SchemePaused(schemeId);
    }

    /// @notice Unpause a previously paused scheme.
    function unpauseScheme(uint256 schemeId) external onlyRole(SCHEME_ADMIN_ROLE) {
        Scheme storage scheme = schemes[schemeId];
        if (bytes(scheme.name).length == 0) revert SchemeDoesNotExist(schemeId);
        scheme.active = true;
        emit SchemeUnpaused(schemeId);
    }

    /// @notice Get full scheme details.
    function getScheme(uint256 schemeId) external view returns (Scheme memory) {
        if (bytes(schemes[schemeId].name).length == 0) revert SchemeDoesNotExist(schemeId);
        return schemes[schemeId];
    }

    /// @dev Required override for AccessControl + ERC1155 both implementing supportsInterface.
    function supportsInterface(bytes4 interfaceId) public view override(ERC1155, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function _getActiveScheme(uint256 schemeId) internal view returns (Scheme storage scheme) {
        scheme = schemes[schemeId];
        if (bytes(scheme.name).length == 0) revert SchemeDoesNotExist(schemeId);
        if (!scheme.active) revert SchemeNotActive(schemeId);
    }
}

interface ISettlementVault {
    function release(address to, uint256 amount) external;
}
