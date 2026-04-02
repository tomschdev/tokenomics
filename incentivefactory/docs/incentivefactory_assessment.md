# IncentiveFactory Simulation — TEDM Assessment

**Date:** 2 April 2026
**Assessor:** Claude Contracts
**Framework:** Token Economy Design Method (TEDM) — Avanzo et al., arXiv:2602.09608
**Subject:** IncentiveFactory (Stellenbosch E-Scooter Subsidy Simulation)

---

## Overview

The paper (Avanzo et al., "Designing a Token Economy: Incentives, Governance, and Tokenomics") proposes the **Token Economy Design Method (TEDM)** — a 17-step framework across three pillars: **Incentives** (5 steps), **Governance** (7 steps), and **Tokenomics** (5 steps). This document evaluates the IncentiveFactory simulation against each step, identifying coverage, gaps, and risks.

---

## Pillar 1: Incentives

| TEDM Step | IncentiveFactory Status | Assessment |
|---|---|---|
| **1. Identify stakeholders** | Municipality, Reporter/Oracle, Provider (GoNow), Riders | **Partial.** Riders are implicit — they generate activity but have no on-chain representation, no direct incentive mechanism, and no agency in the system. The paper warns that "a single individual may belong to multiple stakeholder groups" — rider/provider overlap is unaddressed. |
| **2. Identify token economy functions** | PoS tokens represent verified activity; ZAR settlement = means of payment | **Adequate** for a closed-loop subsidy. But the TEDM asks about broader functions (monitoring, access, voting) — none present. |
| **3. Define desirable behaviors** | Provider: record rides, accumulate PoS, redeem. Reporter: honestly report. Municipality: fund vault. | **Significant gap.** No desirable behaviors are defined for *riders* (the actual service users). The paper stresses that "desirable behaviors are determined by whether actions add long-term economic value" — rider retention, route optimization, peak-hour usage, etc. are unmodeled. |
| **4. Select incentive-mechanism types** | Purely monetary (fixed subsidy rate per km) | **Major gap.** The paper identifies monetary AND non-monetary types: reputation, gamification, service access, network effects. The system uses *only* linear monetary incentives with zero non-monetary mechanisms. No loyalty bonuses, no reputation scoring for reporters, no gamification for riders. |
| **5. Specify incentive mechanisms** | `recordActivity()` -> mint PoS -> `redeem()` -> ZAR | **Mechanically sound but economically flat.** Fixed `subsidyRate` set at scheme creation with no dynamic adjustment. No volume discounts, tiered rewards, diminishing returns, or time-weighted incentives. The paper warns about "speculative dominance" when monetary incentives dominate — though less relevant here since PoS tokens are non-transferable/non-speculative. |

**Incentives verdict: 2/5 steps adequately addressed.** The system implements the mechanical plumbing of incentives but lacks behavioral depth. The TEDM's core insight — that incentive design must start from *desirable behaviors* and work backward to mechanisms — is inverted here. The system starts from a fixed rate and hopes behavior follows.

---

## Pillar 2: Governance

| TEDM Step | IncentiveFactory Status | Assessment |
|---|---|---|
| **1. Define governance areas** | Scheme creation, pause/unpause, vault funding, reporter authorization | **Narrow.** Missing: subsidy rate adjustment, scheme parameter evolution, dispute resolution, reporter accountability, budget allocation across schemes. |
| **2. Define stakeholders and roles** | `DEFAULT_ADMIN_ROLE`, `SCHEME_ADMIN_ROLE`, `REPORTER_ROLE` via OZ AccessControl | **Implemented but rigid.** Roles are binary (have/don't have). No graduated permissions, no separation between municipal council and admin operator. |
| **3. Define target decentralization** | Fully centralized — municipality holds all admin keys | **Not addressed.** The paper recommends measuring via Gini and Nakamoto coefficients. Current system: Nakamoto coefficient = 1 (single admin controls everything). This is arguably *appropriate* for a municipal pilot but should be explicitly acknowledged as a design choice, not a default. |
| **4. On-chain vs. off-chain mechanisms** | All governance is on-chain via role-based calls | **Incomplete.** No off-chain deliberation mechanism (council votes, public comment periods). The `pauseScheme()` function is an emergency brake with no governance process around its use. No timelock, no multi-sig, no cool-down. |
| **5. Define voting-mechanism properties** | None | **Absent.** No voting of any kind. |
| **6. Select core voting mechanisms** | None | **Absent.** The paper evaluates 1t1v, conviction, quadratic, reputation-weighted — none implemented. |
| **7. Support mechanisms for voting** | None | **Absent.** No proposal system, no delegation, no quorum. |

**Governance verdict: 2/7 steps partially addressed.** The system has access control but no *governance*. There is no mechanism for any stakeholder to propose changes, no transparency into admin decisions, no checks on admin power. The paper's warnings about "governance capture" apply directly — a single compromised admin key can drain the vault via rate manipulation (create scheme -> set rate to max -> record activity -> redeem).

**Critical risk:** `SCHEME_ADMIN_ROLE` can create schemes pointing to *any* vault and *any* provider address. Combined with `REPORTER_ROLE`, this is a two-key extraction path with no oversight mechanism.

---

## Pillar 3: Tokenomics

| TEDM Step | IncentiveFactory Status | Assessment |
|---|---|---|
| **1. Define token supply policy** | Demand-driven minting (PoS minted on activity), burned on redemption | **Conceptually sound.** Follows the paper's accounting identity: `S_t = S_{t-1} + M_t - B_t`. No cap (inflationary by design since tokens represent real activity), but supply is naturally bounded by vault funds. However, there's a subtle issue: PoS tokens can accumulate without redemption, creating a phantom liability that isn't tracked against vault capacity. |
| **2. Define timing strategy** | Post-launch minting only (activity-driven) | **Adequate.** No pre-minting avoids early misalignment. |
| **3. Define distribution mechanism** | Direct mint to designated provider only | **Adequate for closed-loop.** But the paper notes distribution should support broad participation — here it's single-provider per scheme. No mechanism for multi-provider schemes or competitive allocation. |
| **4. Define value-capture mechanisms** | PoS tokens have no inherent value; value is purely the stablecoin redemption claim | **Thin.** The paper identifies governance rights, asset claims, network value, and earnings claims as value-capture vectors. The PoS token captures *only* a stablecoin claim. No secondary utility (no governance power from holding PoS, no reputation benefit, no preferential access). |
| **5. Define price-management mechanisms** | Fixed rate, no price management | **Absent.** No burns beyond redemption, no staking/locking, no buybacks, no vesting. The paper warns that "supply-reduction mechanisms can support price stabilization" — but more critically for this system, there's no mechanism to adjust the subsidy rate if the ZAR exchange rate shifts, if ridership exceeds expectations, or if the vault approaches depletion. |

**Tokenomics verdict: 2/5 steps adequately addressed.** The mint-burn lifecycle is clean but economically static. The system has no adaptive capacity — it cannot respond to changing conditions without admin intervention and a new scheme creation.

---

## Cross-Cutting Gaps

### 1. No simulation of adversarial behavior

The Forge simulation (`SimulateStellenbosch.s.sol`) models a happy path: 3 days of activity, full redemption. The TEDM emphasizes testing against failure modes:

- Reporter collusion/fraud (inflating km)
- Vault depletion cascades
- Provider withholding redemption to accumulate leverage
- Sybil attacks on reporter roles

The fuzz tests randomize *amounts* but not *actor behavior*.

### 2. No feedback loops

The paper identifies that well-designed token economies create reinforcing loops (more usage -> more value -> more participation). The IncentiveFactory is a one-directional subsidy pipe: municipality funds -> vault -> provider. No mechanism feeds success back into the system (e.g., surplus savings funding rate increases, or high ridership unlocking new schemes).

### 3. No measurement against TEDM evaluation criteria

The paper proposes 5 evaluation metrics (completeness, simplicity, understandability, operational feasibility, perceived accuracy). The simulation measures vault health and activity volume but doesn't evaluate *system design quality* — there are no metrics for incentive effectiveness, governance adequacy, or tokenomic sustainability.

### 4. Missing economic sustainability modeling

The dashboard tracks vault runway but doesn't model the fundamental question: at what ridership level does the subsidy become self-sustaining (or does it ever)? The paper recommends "quantitative refinement via simulations" as a post-TEDM step — this is where cadCAD/radCAD modeling of equilibrium conditions would be valuable.

---

## Summary Scorecard

| TEDM Pillar | Steps Covered | Steps Partial | Steps Missing | Score |
|---|---|---|---|---|
| **Incentives** (5) | 1 | 2 | 2 | 2/5 |
| **Governance** (7) | 0 | 2 | 5 | 1/7 |
| **Tokenomics** (5) | 2 | 1 | 2 | 2.5/5 |
| **Overall** | 3/17 | 5/17 | 9/17 | **~32%** |

---

## Recommended Next Steps (Priority Order)

1. **Governance hardening** — Add timelock + multi-sig for admin actions; implement rate-change proposals with a delay period
2. **Dynamic subsidy rates** — Allow rate adjustment with governance controls (the paper's conviction voting would suit slow municipal decision-making)
3. **Reporter accountability** — Stake/slash mechanism or reputation score for oracle integrity
4. **Rider-facing incentives** — Non-monetary mechanisms (gamification, access tiers) to model actual rider behavior
5. **Adversarial simulation** — cadCAD model with heterogeneous agents (honest, fraudulent, rational-but-selfish) to stress-test the system
6. **Vault sustainability model** — Simulate depletion curves under various ridership scenarios with rate adaptation

---

## Conclusion

The IncentiveFactory is a solid *mechanical foundation* — the contracts are well-structured, properly tested, and the ERC-1155 multi-tenant pattern is elegant. But when measured against the TEDM framework, it's a **settlement pipeline masquerading as a token economy**. The paper's central thesis is that incentives, governance, and tokenomics must be co-designed as an integrated system — the current implementation addresses the tokenomics plumbing while leaving the incentives behavioral layer and governance decision layer essentially unbuilt.

---

## References

- Avanzo, S. et al. "Designing a Token Economy: Incentives, Governance, and Tokenomics." arXiv:2602.09608, 2025. [https://arxiv.org/abs/2602.09608](https://arxiv.org/abs/2602.09608)
