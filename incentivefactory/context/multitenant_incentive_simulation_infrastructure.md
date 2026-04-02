To facilitate your experiments, I have condensed our discussion into a structured "Context Manifest." You can save this as `INCENTIVE_INFRA_CONTEXT.md` in your project directory. This format is designed to be easily parsed by an LLM (or yourself) when you begin implementing or debugging.

---

# Multi-Tenant Incentive Infrastructure Context (v1.0)

**Date:** April 2026  
**Focus:** Stellenbosch Municipal E-Scooter Subsidy & General Incentive Factory  
**Tech Stack:** Solidity, Foundry (Forge/Anvil), ERC-1155, L2-Equivalence (Base/Polygon)

---

## 1. Project Vision

* **Goal:** Build a "Factory" infrastructure for diverse, multi-tenant incentive schemes.
* **Core Logic:** Shift from a "Token Voucher" (Rider-held) to a "Programmatic Settlement" (Gov-to-Provider) model.
* **Scale:** Small-scale pilot (Stellenbosch) designed for global municipal extensibility.

## 2. Technical Architecture

### A. The Token Standard (ERC-1155)

* **Why:** Single contract deployment can manage $N$ independent schemes via unique Token IDs.
* **ID Mapping:** * `ID 0`: Stellenbosch E-Scooter Subsidy.
  * `ID 1`: Paarl Recycling Rewards (Potential).
* **Efficiency:** Batch transactions and shared logic reduce "per-scheme" gas overhead.

### B. The Settlement Layer (ZAR Stablecoins)

* **ZARU (ZAR Universal):** The 2026 institutional standard. Backed by Standard Bank; audited by Moore JHB. Currently the "gold standard" for municipal trust.
* **mZAR / yZAR:** Retail-accessible alternatives from Mesh Trade. **yZAR** is yield-bearing (~5.1% in 2026), allowing municipal pools to grow while locked in escrow.
* **ZARP:** Legacy community-driven ERC-20, useful for local simulation due to high DeFi integration.

## 3. Implementation Workflow (Foundry)

* **Local Node:** `anvil` (Simulates the L2/Mainnet environment on macOS).
* **Testing:** `forge test` (Focus on **Fuzz Testing** for subsidy math).
* **Simulation:** `forge script` (Used to broadcast "mock" town activity).
* **Oracle Pattern:** Use a "Trusted Reporter" (e.g., GoNow API) to trigger `recordSubsidizedActivity`.

## 4. Key Smart Contract Logic (Simplified)

```solidity
// Core Concept: The "Incentive Factory"
function createScheme(string name) // Registers a new tenant
function recordActivity(address provider, uint256 id, uint256 amt) // Mints Proof-of-Service
function redeem(uint256 id, uint256 amount) // Burns PoS tokens; releases ZAR-Stablecoin
```

## 5. Strategic Constraints (South Africa)

* **Regulatory:** SARB (Reserve Bank) treats these as "Closed-Loop Vouchers" if restricted to specific services (transport), simplifying the legal pathway compared to "General Purpose" crypto.
* **Off-Ramping:** Use licensed CASPs (Luno, VALR, Mesh) via API for the final Crypto -> ZAR bank transfer.

---

### **Suggested Directory Structure**

```text
/my-incentive-factory
├── .foundry/
├── lib/ (OpenZeppelin)
├── src/
│   ├── IncentiveFactory.sol (Multi-tenant logic)
│   └── SettlementVault.sol  (Stablecoin escrow)
├── script/
│   └── SimulateStellenbosch.s.sol
├── test/
│   └── Fuzz_Subsidies.t.sol
└── CONTEXT.md (This file)
```

**Would you like me to expand the "SettlementVault.sol" logic in this file to include the specific yZAR yield-handling code?**
