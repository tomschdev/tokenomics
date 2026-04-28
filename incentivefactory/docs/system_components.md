# IncentiveFactory — System Components

**Date:** April 2026
**Purpose:** Component reference for system visualisation
**Use Case:** Stellenbosch Municipal E-Scooter Subsidy (extensible to multi-tenant incentive schemes)

---

## 1. Actors (External Entities)

### 1.1 Municipality (Stellenbosch)
- **Role:** Stakeholder / Funder
- **On-chain identity:** Deployer address, holds `DEFAULT_ADMIN_ROLE` + `SCHEME_ADMIN_ROLE`
- **Actions:**
  - Deploys all contracts
  - Creates incentive schemes (sets rules: provider, subsidy rate, vault)
  - Funds the SettlementVault with ZAR stablecoins
  - Pauses/unpauses schemes in emergencies
  - Manages access control (grants/revokes roles)
- **Off-chain responsibility:** Budget approval, policy decisions, regulatory compliance

### 1.2 Service Provider (GoNow)
- **Role:** Settlement recipient
- **On-chain identity:** Designated `provider` address per scheme (hardcoded at scheme creation)
- **Actions:**
  - Receives ERC-1155 Proof-of-Service (PoS) tokens when activity is recorded
  - Redeems PoS tokens to claim ZAR stablecoin payouts from the vault
- **Off-chain responsibility:** Fleet operations, rider pricing, fare display (showing discounted price)

### 1.3 Reporter / Oracle (GoNow API)
- **Role:** Activity verifier
- **On-chain identity:** Address holding `REPORTER_ROLE`
- **Actions:**
  - Calls `recordActivity()` with verified ride data (km driven within Green Zones)
- **Off-chain responsibility:** GPS validation, ride start/end verification, fraud prevention
- **Trust assumption:** Trusted oracle — no on-chain accountability mechanism currently exists

### 1.4 Rider (End User)
- **Role:** Service consumer / subsidy beneficiary
- **On-chain identity:** None (invisible to the protocol)
- **Experience:** Sees a lower fare upfront; never interacts with blockchain
- **Off-chain role:** Generates the activity that triggers the entire economic flow

---

## 2. Smart Contracts (On-Chain Components)

### 2.1 IncentiveFactory
- **Standard:** ERC-1155 + OpenZeppelin AccessControl
- **Purpose:** Multi-tenant incentive scheme manager and Proof-of-Service token issuer
- **Key state:**
  - `schemes[schemeId]` — Registry of all incentive schemes
  - `nextSchemeId` — Auto-incrementing scheme counter (doubles as ERC-1155 token ID)
  - ERC-1155 balances — `balanceOf[provider][schemeId]` = unredeemed activity units
- **Scheme struct fields:**
  - `name` — Human-readable label (e.g., "Stellenbosch E-Scooter Subsidy")
  - `provider` — Address that receives PoS tokens and can redeem
  - `vault` — SettlementVault address holding the stablecoin escrow for this scheme
  - `subsidyRate` — Fixed payout per activity unit in stablecoin cents (e.g., 150 = R1.50/km)
  - `totalRecorded` — Cumulative activity units minted
  - `totalRedeemed` — Cumulative activity units burned via redemption
  - `active` — Pause flag

#### Functions

| Function | Caller | Description |
|---|---|---|
| `createScheme(name, provider, vault, subsidyRate)` | SCHEME_ADMIN | Register a new incentive programme |
| `recordActivity(schemeId, amount)` | REPORTER | Mint PoS tokens to provider for verified activity |
| `redeem(schemeId, amount)` | Provider | Burn PoS tokens, trigger stablecoin release from vault |
| `pauseScheme(schemeId)` | SCHEME_ADMIN | Halt new recordings and redemptions |
| `unpauseScheme(schemeId)` | SCHEME_ADMIN | Resume scheme operations |
| `getScheme(schemeId)` | Anyone | Query scheme metadata |

#### Events
- `SchemeCreated(schemeId, name, provider, vault, subsidyRate)`
- `ActivityRecorded(schemeId, provider, amount)`
- `Redeemed(schemeId, provider, amount, payout)`
- `SchemePaused(schemeId)` / `SchemeUnpaused(schemeId)`

### 2.2 SettlementVault
- **Standard:** Ownable2Step (OpenZeppelin)
- **Purpose:** Stablecoin escrow — holds municipal funds, releases on factory authorisation
- **Key state:**
  - `settlementToken` (immutable) — The ERC-20 stablecoin contract (e.g., MockZAR)
  - `factory` — Authorised IncentiveFactory address (updatable by owner)
  - `totalDeposited` / `totalReleased` — Cumulative accounting for audit trail

#### Functions

| Function | Caller | Description |
|---|---|---|
| `deposit(amount)` | Anyone (Municipality) | Transfer stablecoins into escrow |
| `release(to, amount)` | Factory only | Transfer stablecoins to provider on redemption |
| `setFactory(newFactory)` | Owner | Update the authorised factory contract |
| `vaultBalance()` | Anyone | Query current stablecoin reserve |

#### Events
- `Deposited(depositor, amount)`
- `Released(to, amount)`
- `FactoryUpdated(oldFactory, newFactory)`

### 2.3 Settlement Token (MockZAR / Production ZAR Stablecoin)
- **Standard:** ERC-20
- **Purpose:** ZAR-pegged digital currency used for subsidy settlement
- **Current implementation:** MockZAR (2 decimals, freely mintable for testing)
- **Production candidates:**
  - **ZARU** — Institutional-grade, Standard Bank backed, audited
  - **yZAR** — Yield-bearing (~5.1% APY), allows idle escrow funds to grow
  - **ZARP** — Community DeFi token, useful for simulation/testing
- **Regulatory framing:** Closed-loop voucher (SARB), not general-purpose currency

---

## 3. Access Control (Roles & Permissions)

```
DEFAULT_ADMIN_ROLE (Municipality deployer)
  |
  +-- Can grant/revoke all roles
  |
  +-- SCHEME_ADMIN_ROLE
  |     +-- createScheme()
  |     +-- pauseScheme()
  |     +-- unpauseScheme()
  |
  +-- REPORTER_ROLE
        +-- recordActivity()

Provider (identity-bound, no role needed)
  +-- redeem() (only callable by scheme's designated provider address)

Vault Owner (Ownable2Step, 2-step transfer)
  +-- setFactory()
  +-- deposit() (open, but practically Municipality)
```

---

## 4. Token Model

### 4.1 Proof-of-Service (PoS) Token — ERC-1155
- **Nature:** Non-transferable activity receipt (not a currency, not tradeable)
- **Minting:** Only via `recordActivity()` by a trusted Reporter
- **Burning:** Only via `redeem()` by the designated Provider
- **Token ID:** Equals `schemeId` — each scheme has its own token class
- **Value:** Has no market value; represents a claim on vault stablecoins at a fixed rate
- **Supply model:** Demand-driven (minted on real activity, burned on redemption)

### 4.2 Settlement Token — ERC-20 (ZAR Stablecoin)
- **Nature:** Fungible currency pegged 1:1 to South African Rand
- **Decimals:** 2 (matching ZAR cents)
- **Flow:** Municipality -> Vault (deposit) -> Provider (release on redemption)
- **Backing:** 1:1 reserve in vault; redemption fails if vault is depleted

---

## 5. Economic Flow (End-to-End Settlement)

### Phase 1: Setup
```
Municipality
  |-- deploys IncentiveFactory, SettlementVault, links them
  |-- creates scheme: "E-Scooter Subsidy", provider=GoNow, rate=R1.50/km
  |-- deposits R100,000 ZAR stablecoin into vault
  |-- grants REPORTER_ROLE to GoNow API oracle
```

### Phase 2: Activity (Recurring)
```
Rider takes e-scooter ride within Green Zone (off-chain)
  |
  v
GoNow API detects completed ride, validates GPS data (off-chain)
  |
  v
Reporter (GoNow API oracle) calls recordActivity(schemeId=0, amount=12)
  |                                                  [12 km ride]
  v
IncentiveFactory mints 12 PoS tokens (ERC-1155, ID=0) to GoNow address
  |
  v
Event: ActivityRecorded(0, GoNow, 12)
```

### Phase 3: Settlement (Periodic or On-Demand)
```
GoNow (Provider) calls redeem(schemeId=0, amount=1550)
  |                                    [accumulated 1,550 km of rides]
  v
IncentiveFactory burns 1,550 PoS tokens from GoNow
  |
  v
Calculates payout: 1,550 km x 150 cents/km = 232,500 cents (R2,325.00)
  |
  v
Calls vault.release(GoNow, 232500)
  |
  v
SettlementVault transfers R2,325.00 ZAR stablecoin to GoNow
  |
  v
Event: Redeemed(0, GoNow, 1550, 232500)
```

### Phase 4: Off-Ramp (Off-Chain)
```
GoNow converts ZAR stablecoin to fiat ZAR via licensed CASP (Luno/VALR/Mesh)
```

---

## 6. Component Relationships

```
+------------------+         creates/manages          +--------------------+
|   Municipality   | ------------------------------>  | IncentiveFactory   |
|   (Admin/Funder) |                                  | (ERC-1155)         |
+--------+---------+         funds                    +--------+-----------+
         |          -------------------------+                 |
         |                                   |                 | release()
         |                                   v                 v
         |                          +--------+---------+       |
         |                          | SettlementVault  | <-----+
         |                          | (Escrow)         |
         |                          +--------+---------+
         |                                   |
         |                                   | ZAR stablecoin
         |                                   v
         |                          +--------+---------+
         |                          | Service Provider |
         |                          | (GoNow)          |
         |                          +------------------+
         |                                   ^
         |                                   | PoS tokens (mint)
         |                          +--------+---------+
         |                          | Reporter/Oracle  |
         +--- grants role -------->| (GoNow API)      |
                                    +--------+---------+
                                             ^
                                             | ride data (off-chain)
                                    +--------+---------+
                                    | Rider            |
                                    | (invisible to    |
                                    |  protocol)       |
                                    +------------------+
```

---

## 7. Multi-Tenancy Model

The ERC-1155 standard enables multiple independent incentive schemes within a single contract deployment:

```
IncentiveFactory (single deployment)
  |
  +-- Scheme 0: Stellenbosch E-Scooter Subsidy
  |     Token ID: 0
  |     Provider: GoNow
  |     Vault: SettlementVault A
  |     Rate: 150 cents/km
  |
  +-- Scheme 1: (Future) Paarl Recycling Rewards
  |     Token ID: 1
  |     Provider: WasteCo
  |     Vault: SettlementVault B
  |     Rate: TBD
  |
  +-- Scheme N: (Future) Any behaviour incentive
        Token ID: N
        Provider: Any service provider
        Vault: Any vault
        Rate: Any fixed rate
```

Each scheme operates independently: separate provider, separate vault, separate token balances. Schemes share contract logic and gas efficiency but have no cross-scheme dependencies.

---

## 8. Conditional Triggers (Proof of Service)

Activity is only recorded when the Reporter validates that service conditions are met:

| Condition | Validation Layer | Current Status |
|---|---|---|
| Ride starts in Green Zone | Reporter (off-chain GPS) | Assumed trusted |
| Ride ends in Green Zone | Reporter (off-chain GPS) | Assumed trusted |
| Minimum ride distance | Reporter (off-chain telemetry) | Not implemented |
| Time-of-day restrictions | Reporter or on-chain modifier | Not implemented |
| Rider identity verification | Reporter (off-chain KYC) | Not implemented |

The on-chain system trusts the Reporter's attestation. All conditional logic currently lives off-chain in the oracle/API layer.

---

## 9. Regulatory Positioning

| Aspect | Design Choice | Rationale |
|---|---|---|
| Token classification | Closed-loop voucher | Avoids SARB general-purpose crypto regulation |
| PoS token tradability | Non-transferable | Not a financial instrument; pure activity receipt |
| Settlement currency | ZAR-pegged stablecoin | Familiar denomination; no forex risk |
| Off-ramp | Licensed CASP (Luno/VALR/Mesh) | FSCA-compliant fiat conversion |
| Audit trail | On-chain events + vault accounting | Transparent, immutable municipal spend tracking |

---

## 10. Identified Gaps (from TEDM Assessment)

These are known limitations of the current implementation, relevant for future iterations:

1. **No dynamic subsidy rates** — Rate is fixed at scheme creation; cannot adapt to demand, budget, or inflation
2. **No rider-facing incentives** — Riders are invisible to the protocol; no gamification, loyalty, or behavioral nudges
3. **No governance process** — Single admin controls all parameters; no multi-sig, timelock, or proposal mechanism
4. **No reporter accountability** — No stake/slash or reputation system for oracle integrity
5. **No feedback loops** — Success doesn't feed back into the system (e.g., surplus savings don't fund rate increases)
6. **No vault depletion safeguards** — No automatic rate reduction or warnings as funds run low
7. **No yield integration** — Vault holds idle stablecoins; yZAR integration would allow escrow funds to earn yield
