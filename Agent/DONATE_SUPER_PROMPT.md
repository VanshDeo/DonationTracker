# 🚀 SUPER PROMPT — Donation Tracking dApp on Stellar Soroban
### Optimized for Antigravity Agentic Workflow

---

## 🤖 ANTIGRAVITY AGENT INSTRUCTIONS

You are a full-stack Web3 engineer agent. Execute this project in **two strict sequential phases with a hard gate between them**:

**PHASE A — Smart Contract**
Write → Compile → Test → Deploy → Write `CONTRACT_ID` to `frontend/.env`

**PHASE B — Frontend**
Only begin after every Phase A gate condition is confirmed:
- [ ] `cargo test` exits 0 — all tests show `ok`
- [ ] `deploy.sh` exits 0 — prints `✅ Contract deployed!`
- [ ] `frontend/.env` exists with `VITE_CONTRACT_ID=C...` (56 chars, starts with C)
- [ ] `invoke-test.sh` exits 0 — prints `✅ All smoke tests passed`

Run real terminal commands at every step. Never simulate output. Never proceed to Phase B until every gate condition above is verified and printed to terminal.

---

## 📐 PROJECT OVERVIEW

| Field | Value |
|---|---|
| **Project Name** | `stellar-donate` |
| **Type** | Donation Tracking dApp (Full-Stack Web3) |
| **Blockchain** | Stellar Soroban Testnet |
| **Contract Language** | Rust + Soroban SDK v20 |
| **Frontend** | React 18 + TypeScript + Vite |
| **Wallet** | Freighter Browser Extension |
| **Spam Guard** | On-chain minimum donation + cooldown period per wallet |
| **Transparency** | Full donor history publicly readable — no wallet needed to view |

---

## 🗂 EXACT PROJECT STRUCTURE

Generate this layout exactly — no deviations:

```
stellar-donate/
├── contract/
│   ├── Cargo.toml
│   ├── Cargo.lock
│   └── src/
│       └── lib.rs                      # Full contract + all unit tests
│
├── frontend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── index.html
│   ├── .env                            # Written by deploy.sh — NEVER commit
│   ├── .env.example
│   └── src/
│       ├── main.tsx                    # App entry + ErrorBoundary
│       ├── App.tsx                     # Root layout + router
│       ├── types/
│       │   └── index.ts                # All TypeScript interfaces
│       ├── lib/
│       │   ├── contract.ts             # All Soroban contract interactions
│       │   └── wallet.ts               # Freighter wallet utilities
│       ├── hooks/
│       │   ├── useWallet.ts            # Wallet state + connect/disconnect
│       │   └── useDonations.ts         # Donation state + actions
│       ├── context/
│       │   └── WalletContext.tsx       # Global wallet context + provider
│       └── components/
│           ├── ConnectWallet.tsx       # Wallet button + network guard
│           ├── DonateForm.tsx          # Amount input + donate button
│           ├── DonorList.tsx           # Paginated donor leaderboard
│           ├── DonorRow.tsx            # Single donor row
│           ├── StatsBar.tsx            # Total raised + donor count + top donor
│           ├── ProgressBar.tsx         # Visual fundraising goal tracker
│           └── TxStatusBanner.tsx      # Transaction lifecycle display
│
├── scripts/
│   ├── deploy.sh                       # Build → optimize → deploy → write .env
│   ├── fund-account.sh                 # Fund deployer via Friendbot
│   └── invoke-test.sh                  # CLI smoke tests for all functions
│
├── .gitignore
├── .env.example
└── README.md
```

---

# ══════════════════════════════════════════════════════
# PHASE A — SMART CONTRACT
# Complete this ENTIRE phase before touching the frontend
# ══════════════════════════════════════════════════════

## STEP A-1: Bootstrap the Rust Project

```bash
mkdir -p stellar-donate/contract/src stellar-donate/scripts
cd stellar-donate
git init
cat > .gitignore << 'EOF'
target/
node_modules/
.env
*.wasm
dist/
EOF
```

---

## STEP A-2: `contract/Cargo.toml`

```toml
[package]
name = "stellar-donate"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
soroban-sdk = { version = "20.0.0", features = ["alloc"] }

[dev-dependencies]
soroban-sdk = { version = "20.0.0", features = ["testutils"] }

[profile.release]
opt-level = "z"
overflow-checks = true
debug = 0
strip = "symbols"
debug-assertions = false
panic = "abort"
codegen-units = 1
lto = true
```

---

## STEP A-3: `contract/src/lib.rs` — Full Contract

Write this file completely. Every function fully implemented. Zero TODOs. Zero stubs.

### Preamble and Imports

```rust
#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror,
    Address, Env, String, Vec,
};
```

### Constants

```rust
// Minimum donation: 1 XLM = 10_000_000 stroops
const MIN_DONATION_STROOPS: i128 = 10_000_000;

// Spam cooldown: seconds a wallet must wait between donations
const DONATION_COOLDOWN_SECONDS: u64 = 3_600; // 1 hour

// Maximum message length in characters
const MAX_MESSAGE_LEN: u32 = 140;

// Maximum donors stored in the leaderboard Vec
// OPTIMIZATION: cap Vec size to prevent unbounded storage growth
const MAX_DONORS: u32 = 500;
```

### Data Structures

```rust
// ── Single donation record ──────────────────────────────────────
#[contracttype]
#[derive(Clone, Debug)]
pub struct Donation {
    pub donor: Address,
    pub amount: i128,          // In stroops (1 XLM = 10_000_000)
    pub message: String,       // Optional public message, max 140 chars
    pub donated_at: u64,       // Ledger timestamp (Unix seconds)
}

// ── Aggregated stats per donor ──────────────────────────────────
#[contracttype]
#[derive(Clone, Debug)]
pub struct DonorStats {
    pub total_donated: i128,   // Cumulative amount across all donations
    pub donation_count: u32,   // Number of individual donations made
    pub last_donated_at: u64,  // Timestamp of most recent donation
}

// ── Campaign-level summary ──────────────────────────────────────
#[contracttype]
#[derive(Clone, Debug)]
pub struct CampaignStats {
    pub total_raised: i128,    // Sum of all donations ever made
    pub donor_count: u32,      // Number of unique donors
    pub donation_count: u32,   // Total number of individual donations
    pub goal_amount: i128,     // Optional fundraising goal (0 = no goal)
}

// ── Storage keys ─────────────────────────────────────────────────
// OPTIMIZATION: DonationLog is a single Vec<Donation> — one read
// for the entire history instead of N reads for N donations.
// DonorStats per address enables O(1) donor lookup.
#[contracttype]
pub enum DataKey {
    DonationLog,               // Persistent — Vec<Donation>, capped at MAX_DONORS entries
    DonorStats(Address),       // Persistent — per-donor aggregated stats
    CampaignStats,             // Instance — lightweight global stats struct
    GoalAmount,                // Instance — i128 fundraising goal
}

// ── Contract errors ──────────────────────────────────────────────
#[contracterror]
#[derive(Copy, Clone, Debug, PartialEq)]
pub enum DonateError {
    AmountTooLow        = 1,   // Below MIN_DONATION_STROOPS
    CooldownActive      = 2,   // Donor donated too recently
    MessageTooLong      = 3,   // Message exceeds MAX_MESSAGE_LEN
    InvalidAmount       = 4,   // Zero or negative amount
    CampaignNotFound    = 5,   // Stats not initialized
}
```

### Contract — All Functions Fully Implemented

```rust
#[contract]
pub struct DonationContract;

#[contractimpl]
impl DonationContract {

    // ── DONATE ───────────────────────────────────────────────────────────────
    // Records a donation from a wallet address.
    //
    // Parameters:
    //   donor:   the donating wallet — must authorize
    //   amount:  donation in stroops (must be >= MIN_DONATION_STROOPS)
    //   message: optional public message (max 140 chars, empty string = no message)
    //
    // Spam Prevention Rules:
    //   1. amount < MIN_DONATION_STROOPS → panic AmountTooLow (prevents dust spam)
    //   2. message.len() > MAX_MESSAGE_LEN → panic MessageTooLong
    //   3. Check DonorStats(donor).last_donated_at:
    //      if env.ledger().timestamp() - last_donated_at < DONATION_COOLDOWN_SECONDS
    //      → panic CooldownActive (prevents rapid-fire spam)
    //
    // Storage Operations:
    //   1. Read DonationLog (Vec<Donation>) from persistent storage (default empty)
    //   2. If log.len() >= MAX_DONORS: remove the oldest entry (log.get(0)) before pushing
    //      This keeps the Vec bounded — OPTIMIZATION: prevents unbounded storage growth
    //   3. Push new Donation to log
    //   4. Write entire log back (one write)
    //   5. Read DonorStats(donor), update total_donated + donation_count + last_donated_at
    //      If first donation from this address: initialize DonorStats
    //   6. Read CampaignStats from instance storage (default zeros)
    //      If new donor (donation_count was 0): increment donor_count
    //      Always: increment total_raised and donation_count
    //   7. Write updated CampaignStats back to instance storage
    //
    // Returns: updated CampaignStats
    pub fn donate(
        env: Env,
        donor: Address,
        amount: i128,
        message: String,
    ) -> CampaignStats {
        donor.require_auth();

        // Validate amount
        if amount <= 0 {
            panic!("donation amount must be positive");
        }
        if amount < MIN_DONATION_STROOPS {
            panic!("donation below minimum of 1 XLM");
        }

        // Validate message
        if message.len() > MAX_MESSAGE_LEN {
            panic!("message exceeds 140 character limit");
        }

        let now = env.ledger().timestamp();

        // Cooldown check — spam prevention
        let mut donor_stats: DonorStats = env
            .storage()
            .persistent()
            .get(&DataKey::DonorStats(donor.clone()))
            .unwrap_or(DonorStats {
                total_donated: 0,
                donation_count: 0,
                last_donated_at: 0,
            });

        if donor_stats.last_donated_at > 0 {
            let elapsed = now.saturating_sub(donor_stats.last_donated_at);
            if elapsed < DONATION_COOLDOWN_SECONDS {
                panic!("cooldown active: please wait before donating again");
            }
        }

        // Load donation log — one storage read
        let mut log: Vec<Donation> = env
            .storage()
            .persistent()
            .get(&DataKey::DonationLog)
            .unwrap_or_else(|| Vec::new(&env));

        // OPTIMIZATION: cap log at MAX_DONORS to prevent unbounded growth
        if log.len() >= MAX_DONORS {
            // Remove oldest entry (index 0) by rebuilding Vec without it
            let mut trimmed: Vec<Donation> = Vec::new(&env);
            for i in 1..log.len() {
                trimmed.push_back(log.get(i).unwrap());
            }
            log = trimmed;
        }

        // Append new donation
        log.push_back(Donation {
            donor: donor.clone(),
            amount,
            message,
            donated_at: now,
        });

        // One write for entire log
        env.storage()
            .persistent()
            .set(&DataKey::DonationLog, &log);

        // Update per-donor stats
        let is_new_donor = donor_stats.donation_count == 0;
        donor_stats.total_donated += amount;
        donor_stats.donation_count += 1;
        donor_stats.last_donated_at = now;
        env.storage()
            .persistent()
            .set(&DataKey::DonorStats(donor), &donor_stats);

        // Update campaign-level stats (instance storage — cheaper for frequent reads)
        let mut stats: CampaignStats = env
            .storage()
            .instance()
            .get(&DataKey::CampaignStats)
            .unwrap_or(CampaignStats {
                total_raised: 0,
                donor_count: 0,
                donation_count: 0,
                goal_amount: 0,
            });

        stats.total_raised += amount;
        stats.donation_count += 1;
        if is_new_donor {
            stats.donor_count += 1;
        }

        env.storage()
            .instance()
            .set(&DataKey::CampaignStats, &stats);

        stats
    }

    // ── SET GOAL ─────────────────────────────────────────────────────────────
    // Sets the fundraising goal amount (in stroops). Can be called by anyone.
    // A goal of 0 means no goal is set.
    // Returns the new goal amount.
    pub fn set_goal(env: Env, caller: Address, goal_amount: i128) -> i128 {
        caller.require_auth();

        env.storage()
            .instance()
            .set(&DataKey::GoalAmount, &goal_amount);

        // Also update CampaignStats.goal_amount for consistency
        let mut stats: CampaignStats = env
            .storage()
            .instance()
            .get(&DataKey::CampaignStats)
            .unwrap_or(CampaignStats {
                total_raised: 0,
                donor_count: 0,
                donation_count: 0,
                goal_amount: 0,
            });
        stats.goal_amount = goal_amount;
        env.storage()
            .instance()
            .set(&DataKey::CampaignStats, &stats);

        goal_amount
    }

    // ── GET DONATIONS ─────────────────────────────────────────────────────────
    // Returns the donation log (most recent up to MAX_DONORS entries).
    // Public — no auth required. Anyone can view donation history.
    pub fn get_donations(env: Env) -> Vec<Donation> {
        env.storage()
            .persistent()
            .get(&DataKey::DonationLog)
            .unwrap_or_else(|| Vec::new(&env))
    }

    // ── GET CAMPAIGN STATS ────────────────────────────────────────────────────
    // Returns the campaign-level summary: total raised, donor count, goal.
    // Public — no auth required.
    pub fn get_campaign_stats(env: Env) -> CampaignStats {
        env.storage()
            .instance()
            .get(&DataKey::CampaignStats)
            .unwrap_or(CampaignStats {
                total_raised: 0,
                donor_count: 0,
                donation_count: 0,
                goal_amount: 0,
            })
    }

    // ── GET DONOR STATS ───────────────────────────────────────────────────────
    // Returns per-donor stats for a specific address.
    // Public — no auth required.
    pub fn get_donor_stats(env: Env, donor: Address) -> DonorStats {
        env.storage()
            .persistent()
            .get(&DataKey::DonorStats(donor))
            .unwrap_or(DonorStats {
                total_donated: 0,
                donation_count: 0,
                last_donated_at: 0,
            })
    }

    // ── CAN DONATE ────────────────────────────────────────────────────────────
    // Returns true if the address can donate right now (cooldown not active).
    // Returns (can_donate: bool, seconds_remaining: u64)
    // Frontend uses this to show countdown timer on the Donate button.
    pub fn can_donate(env: Env, donor: Address) -> (bool, u64) {
        let stats: DonorStats = env
            .storage()
            .persistent()
            .get(&DataKey::DonorStats(donor))
            .unwrap_or(DonorStats {
                total_donated: 0,
                donation_count: 0,
                last_donated_at: 0,
            });

        if stats.last_donated_at == 0 {
            return (true, 0);
        }

        let now = env.ledger().timestamp();
        let elapsed = now.saturating_sub(stats.last_donated_at);

        if elapsed >= DONATION_COOLDOWN_SECONDS {
            (true, 0)
        } else {
            (false, DONATION_COOLDOWN_SECONDS - elapsed)
        }
    }
}
```

---

## STEP A-4: Unit Tests

Add `#[cfg(test)]` module at the bottom of `lib.rs`. All tests must pass with `cargo test`.

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    fn make_message(env: &Env, text: &str) -> String {
        String::from_str(env, text)
    }

    fn setup() -> (Env, Address, DonationContractClient) {
        let env = Env::default();
        env.mock_all_auths();
        env.ledger().set_timestamp(1_700_000_000);
        let id = env.register_contract(None, DonationContract);
        let client = DonationContractClient::new(&env, &id);
        let user = Address::generate(&env);
        (env, user, client)
    }
```

Implement ALL of the following tests completely — every assertion matters:

| Test Name | What It Verifies |
|---|---|
| `test_donate_success` | Donate 1 XLM → `get_campaign_stats` shows `total_raised=10_000_000`, `donor_count=1`, `donation_count=1` |
| `test_donate_updates_donation_log` | Donate → `get_donations` returns 1 entry with correct donor, amount, timestamp |
| `test_donate_below_minimum_fails` | Donate 0.5 XLM (5_000_000 stroops) → panics |
| `test_donate_zero_fails` | Donate 0 stroops → panics |
| `test_donate_message_too_long_fails` | 141-char message → panics |
| `test_donate_message_empty_ok` | Empty string message → succeeds, message stored as empty |
| `test_cooldown_prevents_spam` | Donate → immediately donate again → second panics `CooldownActive` |
| `test_cooldown_expires` | Donate → advance ledger by 3_601s → donate again → succeeds |
| `test_multiple_donors_tracked` | Three different addresses donate → `donor_count=3`, `donation_count=3` |
| `test_same_donor_cumulative` | Donor A donates, cooldown passes, donates again → `DonorStats.total_donated` = sum of both |
| `test_donor_stats_accurate` | Donate twice (after cooldown) → `donation_count=2`, `total_donated` correct |
| `test_can_donate_fresh_address` | Fresh address → `can_donate` returns `(true, 0)` |
| `test_can_donate_cooldown_active` | Donate → `can_donate` returns `(false, ~3600)` |
| `test_can_donate_after_cooldown` | Donate → advance time past cooldown → `can_donate` returns `(true, 0)` |
| `test_set_goal` | Set goal to 100 XLM → `get_campaign_stats.goal_amount == 1_000_000_000` |
| `test_log_capped_at_max` | Donate MAX_DONORS+1 times (each from new address, advance time) → log length stays <= MAX_DONORS |
| `test_get_donor_stats_unknown` | Query stats for address that never donated → returns zeroed DonorStats |
| `test_get_campaign_stats_empty` | Fresh contract → `get_campaign_stats` returns all zeros |

Close test module: `}`

---

## STEP A-5: Compile and Test

```bash
cd contract
cargo build --target wasm32-unknown-unknown --release
echo "✅ Contract compiled successfully"

cargo test
echo "✅ All 18 tests passed"
cd ..
```

Both must exit 0 before continuing.

---

## STEP A-6: Deployment Scripts

### `scripts/fund-account.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "▶ Checking deployer identity..."
if ! stellar keys address deployer &>/dev/null 2>&1; then
  echo "  Generating new deployer key..."
  stellar keys generate deployer --network testnet
fi

DEPLOYER=$(stellar keys address deployer)
echo "▶ Deployer: $DEPLOYER"

echo "▶ Funding via Friendbot..."
RESP=$(curl -sf "https://friendbot.stellar.org?addr=${DEPLOYER}")
echo "✅ Funded: $DEPLOYER"
```

### `scripts/deploy.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "══════════════════════════════════════════"
echo "   stellar-donate — Deploy to Testnet    "
echo "══════════════════════════════════════════"

echo ""
echo "▶ Step 1: Building WASM..."
cd contract
cargo build --target wasm32-unknown-unknown --release
cd ..

WASM="contract/target/wasm32-unknown-unknown/release/stellar_donate.wasm"

echo "▶ Step 2: Optimizing WASM..."
stellar contract optimize --wasm "$WASM"
OPTIMIZED="${WASM%.wasm}.optimized.wasm"
echo "   Original size:  $(du -sh "$WASM" | cut -f1)"
echo "   Optimized size: $(du -sh "$OPTIMIZED" | cut -f1)"

echo ""
echo "▶ Step 3: Deploying to Stellar Testnet..."
CONTRACT_ID=$(stellar contract deploy \
  --wasm "$OPTIMIZED" \
  --network testnet \
  --source deployer)

echo ""
echo "✅ Contract deployed!"
echo "   CONTRACT_ID: $CONTRACT_ID"

echo ""
echo "▶ Step 4: Writing contract address to frontend/.env..."
mkdir -p frontend

cat > frontend/.env << EOF
VITE_CONTRACT_ID=$CONTRACT_ID
VITE_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
VITE_RPC_URL=https://soroban-testnet.stellar.org
VITE_HORIZON_URL=https://horizon-testnet.stellar.org
EOF

echo "✅ frontend/.env written:"
cat frontend/.env

echo ""
echo "══════════════════════════════════════════"
echo "   PHASE A COMPLETE — Begin Phase B      "
echo "══════════════════════════════════════════"
```

### `scripts/invoke-test.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

if [ ! -f frontend/.env ]; then
  echo "❌ frontend/.env missing. Run scripts/deploy.sh first."
  exit 1
fi

source frontend/.env
CONTRACT_ID=$VITE_CONTRACT_ID
DEPLOYER=$(stellar keys address deployer)

echo "▶ Contract : $CONTRACT_ID"
echo "▶ Deployer : $DEPLOYER"
echo ""

echo "1️⃣  Getting initial campaign stats..."
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --network testnet \
  --source deployer \
  --fn get_campaign_stats

echo ""
echo "2️⃣  Making a donation of 5 XLM (50_000_000 stroops)..."
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --network testnet \
  --source deployer \
  --fn donate \
  -- \
  --donor "$DEPLOYER" \
  --amount 50000000 \
  --message "First donation to the cause!"

echo ""
echo "3️⃣  Getting updated campaign stats..."
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --network testnet \
  --source deployer \
  --fn get_campaign_stats

echo ""
echo "4️⃣  Getting donation log..."
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --network testnet \
  --source deployer \
  --fn get_donations

echo ""
echo "5️⃣  Getting donor stats for deployer..."
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --network testnet \
  --source deployer \
  --fn get_donor_stats \
  -- \
  --donor "$DEPLOYER"

echo ""
echo "6️⃣  Checking if deployer can donate again (should be false — cooldown active)..."
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --network testnet \
  --source deployer \
  --fn can_donate \
  -- \
  --donor "$DEPLOYER"

echo ""
echo "7️⃣  Setting fundraising goal to 100 XLM..."
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --network testnet \
  --source deployer \
  --fn set_goal \
  -- \
  --caller "$DEPLOYER" \
  --goal_amount 1000000000

echo ""
echo "✅ All smoke tests passed"
```

### Run Phase A Scripts

```bash
chmod +x scripts/*.sh
./scripts/fund-account.sh
./scripts/deploy.sh
./scripts/invoke-test.sh
```

---

## ⛔ PHASE A GATE — Verify ALL before starting Phase B:

- [ ] `cargo test` → all 18 tests show `ok`
- [ ] `deploy.sh` → exits 0, prints `✅ Contract deployed!`
- [ ] `frontend/.env` exists and contains `VITE_CONTRACT_ID=C...` (run `cat frontend/.env`)
- [ ] `invoke-test.sh` → exits 0, prints `✅ All smoke tests passed`

---

# ══════════════════════════════════════════════════════
# PHASE B — FRONTEND
# Only begin after every Phase A gate condition is confirmed
# ══════════════════════════════════════════════════════

## STEP B-1: Bootstrap Frontend

```bash
cd stellar-donate
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install @stellar/stellar-sdk @stellar/freighter-api
npm install --save-dev vite-plugin-node-polyfills @types/node
```

Verify `frontend/.env` already exists from Phase A. If it doesn't → STOP and re-run `scripts/deploy.sh`.

---

## STEP B-2: `frontend/vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ['buffer', 'crypto', 'stream', 'util'],
      globals: { Buffer: true, global: true, process: true },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
```

---

## STEP B-3: `frontend/src/types/index.ts`

```typescript
// ── On-chain data structures ──────────────────────────────────────────────
export interface Donation {
  donor: string;               // Stellar G... address
  amount: number;              // In stroops
  message: string;             // Optional public message
  donatedAt: number;           // Unix timestamp (seconds)
}

export interface DonorStats {
  totalDonated: number;        // In stroops
  donationCount: number;
  lastDonatedAt: number;       // Unix timestamp
}

export interface CampaignStats {
  totalRaised: number;         // In stroops
  donorCount: number;
  donationCount: number;
  goalAmount: number;          // In stroops; 0 = no goal set
}

// ── Transaction state machine ──────────────────────────────────────────────
export type TxStatus =
  | 'idle'
  | 'building'
  | 'awaiting_signature'
  | 'submitting'
  | 'polling'
  | 'success'
  | 'failed';

export interface TxState {
  status: TxStatus;
  txHash: string | null;
  error: string | null;
  action: string | null;
}

export const INITIAL_TX_STATE: TxState = {
  status: 'idle',
  txHash: null,
  error: null,
  action: null,
};

// ── Utility constants ──────────────────────────────────────────────────────
export const STROOPS_PER_XLM = 10_000_000;
export const MIN_DONATION_XLM = 1;
export const COOLDOWN_SECONDS = 3_600;
```

---

## STEP B-4: `frontend/src/lib/wallet.ts`

```typescript
import {
  isConnected,
  requestAccess,
  getPublicKey,
  getNetworkDetails,
  signTransaction,
} from '@stellar/freighter-api';

const EXPECTED_PASSPHRASE = import.meta.env.VITE_NETWORK_PASSPHRASE as string;

export interface WalletInfo {
  publicKey: string;
  isCorrectNetwork: boolean;
}

// Silent check on app load
export async function checkExistingConnection(): Promise<string | null> {
  try {
    const connected = await isConnected();
    if (!connected) return null;
    return await getPublicKey();
  } catch {
    return null;
  }
}

// Full connect flow on button click
export async function connectFreighter(): Promise<WalletInfo> {
  const connected = await isConnected();
  if (!connected) {
    throw new Error('Freighter not found. Install it at freighter.app');
  }
  await requestAccess();
  const publicKey = await getPublicKey();
  const details = await getNetworkDetails();
  return {
    publicKey,
    isCorrectNetwork: details.networkPassphrase === EXPECTED_PASSPHRASE,
  };
}

// Format address for display: GABCD...XY12
export function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export { signTransaction };
```

---

## STEP B-5: `frontend/src/lib/contract.ts`

Implement EVERY function completely. Zero stubs. Zero empty bodies.

```typescript
import {
  Contract,
  SorobanRpc,
  TransactionBuilder,
  BASE_FEE,
  nativeToScVal,
  Address,
  xdr,
  scValToNative,
} from '@stellar/stellar-sdk';
import { signTransaction } from './wallet';
import type {
  Donation,
  DonorStats,
  CampaignStats,
  TxStatus,
} from '@/types';
import { STROOPS_PER_XLM } from '@/types';

const CONTRACT_ID = import.meta.env.VITE_CONTRACT_ID as string;
const RPC_URL     = import.meta.env.VITE_RPC_URL as string;
const NET_PASS    = import.meta.env.VITE_NETWORK_PASSPHRASE as string;

const server   = new SorobanRpc.Server(RPC_URL, { allowHttp: false });
const contract = new Contract(CONTRACT_ID);

// ── Shared write tx lifecycle helper ────────────────────────────────────────
// Handles: build → simulate → assemble → sign → submit → poll
async function runTx(
  sourcePublicKey: string,
  operation: xdr.Operation,
  onStatus: (s: TxStatus) => void,
): Promise<string> {
  onStatus('building');

  const account = await server.getAccount(sourcePublicKey);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NET_PASS,
  })
    .addOperation(operation)
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim)) {
    throw new Error(`Simulation failed: ${sim.error}`);
  }

  const prepared = SorobanRpc.assembleTransaction(tx, sim).build();

  onStatus('awaiting_signature');
  const signedXdr = await signTransaction(prepared.toXDR(), {
    networkPassphrase: NET_PASS,
  });

  onStatus('submitting');
  const sendResult = await server.sendTransaction(
    TransactionBuilder.fromXDR(signedXdr, NET_PASS),
  );

  if (sendResult.status === 'ERROR') {
    throw new Error(sendResult.errorResult?.toString() ?? 'Submission error');
  }

  onStatus('polling');
  const hash = sendResult.hash;

  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 1500));
    const poll = await server.getTransaction(hash);
    if (poll.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
      onStatus('success');
      return hash;
    }
    if (poll.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
      throw new Error('Transaction failed on-chain');
    }
  }
  throw new Error('Transaction timed out after 30s');
}

// ── Read-only simulation (no signing, no fees) ───────────────────────────────
async function readTx<T>(operation: xdr.Operation): Promise<T> {
  const fakeAccount = {
    accountId: () => CONTRACT_ID,
    sequenceNumber: () => '0',
    incrementSequenceNumber() {},
  } as unknown as SorobanRpc.Api.AccountResponse;

  const tx = new TransactionBuilder(fakeAccount as any, {
    fee: BASE_FEE,
    networkPassphrase: NET_PASS,
  })
    .addOperation(operation)
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim)) {
    throw new Error(`Read failed: ${sim.error}`);
  }

  const success = sim as SorobanRpc.Api.SimulateTransactionSuccessResponse;
  return scValToNative(success.result!.retval) as T;
}

// ── Decode helpers ───────────────────────────────────────────────────────────
function decodeDonation(raw: unknown): Donation {
  const o = raw as Record<string, unknown>;
  return {
    donor:     String(o['donor']),
    amount:    Number(o['amount']),
    message:   String(o['message']),
    donatedAt: Number(o['donated_at']),
  };
}

function decodeCampaignStats(raw: unknown): CampaignStats {
  const o = raw as Record<string, unknown>;
  return {
    totalRaised:   Number(o['total_raised']),
    donorCount:    Number(o['donor_count']),
    donationCount: Number(o['donation_count']),
    goalAmount:    Number(o['goal_amount']),
  };
}

function decodeDonorStats(raw: unknown): DonorStats {
  const o = raw as Record<string, unknown>;
  return {
    totalDonated:   Number(o['total_donated']),
    donationCount:  Number(o['donation_count']),
    lastDonatedAt:  Number(o['last_donated_at']),
  };
}

// ── Exported contract functions ──────────────────────────────────────────────

// Make a donation
export async function contractDonate(
  donorPublicKey: string,
  amountXlm: number,               // User inputs in XLM — we convert to stroops
  message: string,
  onStatus: (s: TxStatus) => void,
): Promise<{ txHash: string; updatedStats: CampaignStats }> {
  const amountStroops = BigInt(Math.round(amountXlm * STROOPS_PER_XLM));

  const op = contract.call(
    'donate',
    new Address(donorPublicKey).toScVal(),
    nativeToScVal(amountStroops, { type: 'i128' }),
    nativeToScVal(message, { type: 'string' }),
  );

  const txHash = await runTx(donorPublicKey, op, onStatus);

  // Re-fetch updated stats
  const updatedStats = await contractGetCampaignStats();
  return { txHash, updatedStats };
}

// Set fundraising goal
export async function contractSetGoal(
  callerPublicKey: string,
  goalXlm: number,
  onStatus: (s: TxStatus) => void,
): Promise<string> {
  const goalStroops = BigInt(Math.round(goalXlm * STROOPS_PER_XLM));

  const op = contract.call(
    'set_goal',
    new Address(callerPublicKey).toScVal(),
    nativeToScVal(goalStroops, { type: 'i128' }),
  );

  return runTx(callerPublicKey, op, onStatus);
}

// Fetch all donations
export async function contractGetDonations(): Promise<Donation[]> {
  const op = contract.call('get_donations');
  const raw = await readTx<unknown[]>(op);
  const arr = Array.isArray(raw) ? raw : [];
  // Return in reverse chronological order (newest first)
  return arr.map(decodeDonation).reverse();
}

// Fetch campaign stats
export async function contractGetCampaignStats(): Promise<CampaignStats> {
  const op = contract.call('get_campaign_stats');
  const raw = await readTx<unknown>(op);
  return decodeCampaignStats(raw);
}

// Fetch per-donor stats
export async function contractGetDonorStats(donorPublicKey: string): Promise<DonorStats> {
  const op = contract.call(
    'get_donor_stats',
    new Address(donorPublicKey).toScVal(),
  );
  const raw = await readTx<unknown>(op);
  return decodeDonorStats(raw);
}

// Check if address can donate (cooldown check)
export async function contractCanDonate(
  donorPublicKey: string,
): Promise<{ canDonate: boolean; secondsRemaining: number }> {
  const op = contract.call(
    'can_donate',
    new Address(donorPublicKey).toScVal(),
  );
  const raw = await readTx<[boolean, number]>(op);
  const arr = raw as unknown[];
  return {
    canDonate: Boolean(arr[0]),
    secondsRemaining: Number(arr[1]),
  };
}
```

---

## STEP B-6: `frontend/src/context/WalletContext.tsx`

```typescript
'use client';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { connectFreighter, checkExistingConnection } from '@/lib/wallet';

interface WalletContextType {
  publicKey: string | null;
  isConnected: boolean;
  isCorrectNetwork: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(false);

  useEffect(() => {
    checkExistingConnection().then(pk => {
      if (pk) { setPublicKey(pk); setIsCorrectNetwork(true); }
    });
  }, []);

  const connect = useCallback(async () => {
    const info = await connectFreighter();
    setPublicKey(info.publicKey);
    setIsCorrectNetwork(info.isCorrectNetwork);
  }, []);

  const disconnect = useCallback(() => {
    setPublicKey(null);
    setIsCorrectNetwork(false);
  }, []);

  return (
    <WalletContext.Provider value={{
      publicKey,
      isConnected: !!publicKey,
      isCorrectNetwork,
      connect,
      disconnect,
    }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWalletContext(): WalletContextType {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWalletContext must be used inside WalletProvider');
  return ctx;
}
```

---

## STEP B-7: Hooks

### `frontend/src/hooks/useWallet.ts`
```typescript
// Re-export from WalletContext for component convenience
export { useWalletContext as useWallet } from '@/context/WalletContext';
```

### `frontend/src/hooks/useDonations.ts`
```typescript
// 'use client' (Vite — no directive needed, but include for clarity)
//
// Full implementation required. State:
//   donations: Donation[]
//   stats: CampaignStats | null
//   donorStats: DonorStats | null      ← for connected wallet
//   cooldown: { canDonate: boolean; secondsRemaining: number }
//   loading: boolean
//   txState: TxState
//
// Actions:
//   donate(amountXlm: number, message: string): Promise<void>
//   setGoal(goalXlm: number): Promise<void>
//   refresh(): Promise<void>
//
// Behavior:
//   - On mount: fetch donations + campaign stats (no wallet needed)
//   - When publicKey changes: additionally fetch donorStats + cooldown
//   - Cooldown countdown: useInterval that decrements secondsRemaining every second
//     when cooldown.secondsRemaining > 0
//   - After donate success: call refresh() + re-fetch cooldown
//   - On error: set txState.status='failed', txState.error = message
//   - Auto-reset txState to INITIAL_TX_STATE after 5 seconds on success
//   - Optimistic stats update: when donate succeeds, update stats.totalRaised
//     locally before refresh() completes
//
// IMPLEMENT FULLY
```

---

## STEP B-8: Components

### `ConnectWallet.tsx`
```tsx
// Uses useWallet() from WalletContext
//
// Disconnected: "Connect Wallet" button
// Connected + correct network: truncated address pill + "Disconnect" text button
// Connected + wrong network: amber banner "⚠️ Switch to Stellar Testnet in Freighter"
//
// IMPLEMENT FULLY — clean minimal style, no heavy CSS framework
```

### `TxStatusBanner.tsx`
```tsx
// Props: txState: TxState; onDismiss: () => void
//
// Shows a dismissible banner below the DonateForm when status !== 'idle'
// Status display:
//   building           → ⚙️  "{action}..."
//   awaiting_signature → ✍️  "Sign in Freighter..."
//   submitting         → 📤  "Submitting to Stellar..."
//   polling            → 🔄  "Confirming..." (CSS spin animation)
//   success            → ✅  "Donation confirmed!" + short txHash
//                          link: https://stellar.expert/explorer/testnet/tx/{hash}
//   failed             → ❌  "Failed: {error}" + dismiss button
//
// Auto-dismiss 5 seconds after success
// IMPLEMENT FULLY
```

### `StatsBar.tsx`
```tsx
// Props: stats: CampaignStats | null; loading: boolean
//
// Three stat cards in a horizontal row (stack on mobile):
//   1. 💰 Total Raised
//      Large: "{n.nn} XLM"
//      Small: "{donationCount} donations"
//
//   2. 👥 Donors
//      Large: "{donorCount}"
//      Small: "unique supporters"
//
//   3. 🏆 Top Contribution (derived from donation log — frontend calc)
//      Large: "{max.nn} XLM"
//      Small: "from GABCD...XY12"
//      (Pass topDonation prop separately)
//
// Loading: skeleton shimmer for all three cards
// IMPLEMENT FULLY
```

### `ProgressBar.tsx`
```tsx
// Props: totalRaised: number; goalAmount: number
//
// If goalAmount === 0: render nothing (no goal set)
// If goalAmount > 0:
//   Show: "Goal: {goal} XLM"
//   Progress bar: filled portion = min(totalRaised / goalAmount, 1.0) * 100%
//   Show percentage label: "{pct}% of goal"
//   Color transitions:
//     0–49%:   blue fill
//     50–79%:  amber fill
//     80–99%:  green fill
//     100%:    pulsing green fill with "🎉 Goal Reached!" label
//
// IMPLEMENT FULLY
```

### `DonorRow.tsx`
```tsx
// Props: donation: Donation; rank: number; isCurrentUser: boolean
//
// Renders one row in the donor list:
//   [Rank]  [Truncated address]  [XLM amount]  [Message if any]  [Relative time]
//
// rank: displayed as #1, #2, #3 with gold/silver/bronze colors for top 3
// isCurrentUser: highlight row with subtle background tint + "You" badge
// Message: shown in a smaller muted style below main row if non-empty
// Relative time: "2 hours ago", "3 days ago" using formatDistanceToNow
//   (implement without date-fns — use a simple local utility)
//
// IMPLEMENT FULLY
```

### `DonorList.tsx`
```tsx
// Props:
//   donations: Donation[]
//   currentUserAddress: string | null
//   loading: boolean
//
// Renders a scrollable list of DonorRow components
// Shows 10 entries per page with "Show more" button (not full pagination)
// Empty state: "Be the first to donate! 💫"
// Loading: 5 skeleton rows (animate-pulse)
// Header: "Recent Donations" with donation count badge
//
// IMPLEMENT FULLY
```

### `DonateForm.tsx`
```tsx
// Props: none (reads from WalletContext and useDonations hook)
//
// Form fields:
//   1. Amount input (XLM, number, min=1, step=0.5)
//      Preset quick-select buttons: [1 XLM] [5 XLM] [10 XLM] [25 XLM]
//
//   2. Message textarea (optional, max 140 chars)
//      Live char counter: "{n}/140"
//      Red border + disabled submit when > 140
//
//   3. "Donate {amount} XLM" submit button
//      DISABLED when:
//        - Wallet not connected
//        - Wrong network
//        - cooldown.canDonate === false
//        - amount < 1 (below minimum)
//        - message.length > 140
//        - txState.status !== 'idle'
//
//   4. Cooldown countdown display (when canDonate === false):
//      "⏳ Next donation available in {hh}:{mm}:{ss}"
//      Uses local state that decrements every second
//
//   5. "Set Goal" button (small, below main form)
//      Opens inline input for goal amount in XLM
//      Only visible when wallet is connected
//
// TxStatusBanner rendered below form
// IMPLEMENT FULLY
```

---

## STEP B-9: App Shell

### `frontend/src/App.tsx`
```tsx
// Layout:
//
// ┌──────────────────────────────────────────────────┐
// │  💝  Stellar Donate              [ConnectWallet] │  ← sticky header
// ├──────────────────────────────────────────────────┤
// │                                                  │
// │  [StatsBar — 3 cards]                            │
// │  [ProgressBar — if goal set]                     │
// │                                                  │
// │  ┌─────────────────┐  ┌───────────────────────┐  │
// │  │   DonateForm    │  │      DonorList        │  │
// │  │  (left column)  │  │   (right column)      │  │
// │  └─────────────────┘  └───────────────────────┘  │
// │                                                  │
// └──────────────────────────────────────────────────┘
//
// On mobile: stack to single column (DonateForm first, DonorList below)
// Max width: 1100px centered
// Background: very light gray (#f8fafc)
// WalletProvider wraps everything
// useDonations hook at this level — props passed to children
//
// If wallet not connected: DonateForm shows "Connect wallet to donate"
// but DonorList and StatsBar always visible (public data)
//
// IMPLEMENT FULLY
```

### `frontend/src/main.tsx`
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { WalletProvider } from '@/context/WalletContext';
import App from './App';
import './index.css';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }
  static getDerivedStateFromError(e: Error) {
    return { hasError: true, message: e.message };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'sans-serif' }}>
          <h2>Something went wrong</h2>
          <p style={{ color: '#ef4444' }}>{this.state.message}</p>
          <button onClick={() => window.location.reload()}>Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <WalletProvider>
        <App />
      </WalletProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
```

---

## STEP B-10: Configuration Files

### `frontend/tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### `frontend/index.html`
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Stellar Donate — Transparent On-Chain Fundraising</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### `frontend/src/index.css` — Minimal Global Styles
```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f8fafc;
  color: #1e293b;
  min-height: 100vh;
}

button { cursor: pointer; font-family: inherit; }
input, textarea { font-family: inherit; font-size: inherit; }

@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.spin { animation: spin 1s linear infinite; }
.pulse { animation: pulse 1.5s ease-in-out infinite; }
.skeleton {
  background: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 6px;
}
```

### `frontend/.env.example`
```env
VITE_CONTRACT_ID=C...
VITE_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
VITE_RPC_URL=https://soroban-testnet.stellar.org
VITE_HORIZON_URL=https://horizon-testnet.stellar.org
```

---

## STEP B-11: Verify and Launch

```bash
cd frontend
npm run build    # must exit 0 — zero TypeScript errors
npm run dev      # open http://localhost:5173
```

**QA Checklist:**
- [ ] Page loads — StatsBar shows "0 XLM raised", DonorList shows empty state
- [ ] Donor history visible WITHOUT connecting wallet
- [ ] Click "Connect Wallet" → Freighter popup → key shown in header
- [ ] Quick-select buttons ([1 XLM], [5 XLM] etc.) populate amount field
- [ ] Enter message, click "Donate 5 XLM" → all 5 TxStatusBanner stages cycle
- [ ] After confirmation: StatsBar updates, new row appears in DonorList
- [ ] Your row is highlighted with "You" badge
- [ ] "Donate" button shows cooldown countdown ⏳ after donating
- [ ] Set goal → ProgressBar appears with correct percentage
- [ ] Wrong network in Freighter → amber warning shown
- [ ] Mobile 375px → single column layout, all elements usable
- [ ] `npm run build` exits 0

---

## ✅ QUALITY REQUIREMENTS

| Requirement | Standard |
|---|---|
| TypeScript | `strict: true`, zero `any`, all props typed |
| Rust | All 18 tests pass, compiles to WASM |
| Auth | `require_auth()` on `donate` and `set_goal` |
| Spam guard | On-chain cooldown (1 hour) + minimum donation (1 XLM) |
| Storage cap | DonationLog capped at MAX_DONORS (500) entries |
| Public data | Donor list + stats readable without wallet |
| Env vars | Read from `import.meta.env.VITE_*`, never hardcoded |
| TxStatusBanner | All 6 states rendered — never silent during tx |
| Loading | Skeleton states for initial fetch, disabled during mutations |
| Responsive | Works 375px mobile → 1440px desktop |
| Console | Zero `console.log` — `console.error` for real errors only |
| No TODOs | Every function and component fully implemented |

---

## 📝 COMPLETE FILE GENERATION ORDER

Print `✅ [filename] — complete` after each file before moving to the next:

**Phase A:**
1. `contract/Cargo.toml`
2. `contract/src/lib.rs` ← full contract + all 18 unit tests
3. `.gitignore`
4. `.env.example`
5. `scripts/fund-account.sh`
6. `scripts/deploy.sh`
7. `scripts/invoke-test.sh`

**[EXECUTE: fund-account.sh → deploy.sh → invoke-test.sh → confirm gate]**

**Phase B:**
8. `frontend/package.json`
9. `frontend/tsconfig.json`
10. `frontend/vite.config.ts`
11. `frontend/index.html`
12. `frontend/src/index.css`
13. `frontend/.env.example`
14. `frontend/src/types/index.ts`
15. `frontend/src/lib/wallet.ts`
16. `frontend/src/lib/contract.ts`
17. `frontend/src/context/WalletContext.tsx`
18. `frontend/src/hooks/useWallet.ts`
19. `frontend/src/hooks/useDonations.ts`
20. `frontend/src/components/ConnectWallet.tsx`
21. `frontend/src/components/TxStatusBanner.tsx`
22. `frontend/src/components/StatsBar.tsx`
23. `frontend/src/components/ProgressBar.tsx`
24. `frontend/src/components/DonorRow.tsx`
25. `frontend/src/components/DonorList.tsx`
26. `frontend/src/components/DonateForm.tsx`
27. `frontend/src/App.tsx`
28. `frontend/src/main.tsx`
29. `README.md`
