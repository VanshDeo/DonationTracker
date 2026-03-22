# ✅ TASKS.md — Donation Tracking dApp on Stellar Soroban

Complete, dependency-ordered task breakdown for `stellar-donate`. Two strict phases with a hard gate. **Never start Phase B until every Phase A gate condition is verified.**

---

# ⛓ PHASE A — SMART CONTRACT
> Gate condition: `frontend/.env` must exist with valid `VITE_CONTRACT_ID=C...`
> All 4 gate checks must pass before Phase B begins.

---

## A1 — Environment Setup

- [ ] **T-001** Install Rust via `rustup`
  - Verify: `rustc --version` → `≥ 1.74`

- [ ] **T-002** Add WASM compilation target
  - `rustup target add wasm32-unknown-unknown`
  - Verify: `rustup target list --installed | grep wasm32`

- [ ] **T-003** Install Stellar CLI
  - Verify: `stellar --version`

- [ ] **T-004** Install Node.js v20 LTS
  - Verify: `node --version` → `v20.x.x`

- [ ] **T-005** Install Freighter browser extension (Chrome / Brave / Firefox)
  - Open Freighter → Settings → set network to **Testnet**

- [ ] **T-006** Create project root and directory structure
  ```bash
  mkdir -p stellar-donate/contract/src stellar-donate/scripts
  cd stellar-donate && git init
  ```

- [ ] **T-007** Create root `.gitignore`
  - Entries: `target/`, `node_modules/`, `.env`, `*.wasm`, `dist/`

---

## A2 — Contract Scaffolding

- [ ] **T-101** Create `contract/Cargo.toml`
  - `name = "stellar-donate"`, `crate-type = ["cdylib"]`
  - `soroban-sdk = { version = "20.0.0", features = ["alloc"] }`
  - `[dev-dependencies]` with `testutils` feature
  - Full `[profile.release]` with `opt-level="z"`, `lto=true`, `panic="abort"`, `strip="symbols"`, `overflow-checks=true`

- [ ] **T-102** Create empty `contract/src/lib.rs` with `#![no_std]` and imports
  ```rust
  #![no_std]
  use soroban_sdk::{contract, contractimpl, contracttype, contracterror, Address, Env, String, Vec};
  ```

- [ ] **T-103** Verify clean initial compilation before adding any logic
  ```bash
  cd contract && cargo build --target wasm32-unknown-unknown --release
  ```
  Must exit 0 with no errors.

---

## A3 — Constants and Configuration

- [ ] **T-104** Define spam prevention constants
  - `MIN_DONATION_STROOPS: i128 = 10_000_000` (1 XLM)
  - `DONATION_COOLDOWN_SECONDS: u64 = 3_600` (1 hour)
  - `MAX_MESSAGE_LEN: u32 = 140`
  - `MAX_DONORS: u32 = 500`

---

## A4 — Data Model

- [ ] **T-105** Define `Donation` struct with `#[contracttype]` and `#[derive(Clone, Debug)]`
  - Fields: `donor: Address`, `amount: i128`, `message: String`, `donated_at: u64`

- [ ] **T-106** Define `DonorStats` struct with `#[contracttype]` and `#[derive(Clone, Debug)]`
  - Fields: `total_donated: i128`, `donation_count: u32`, `last_donated_at: u64`

- [ ] **T-107** Define `CampaignStats` struct with `#[contracttype]` and `#[derive(Clone, Debug)]`
  - Fields: `total_raised: i128`, `donor_count: u32`, `donation_count: u32`, `goal_amount: i128`

- [ ] **T-108** Define `DataKey` enum with `#[contracttype]`
  - Variants: `DonationLog`, `DonorStats(Address)`, `CampaignStats`, `GoalAmount`

- [ ] **T-109** Define `DonateError` enum with `#[contracterror]` and `#[derive(Copy, Clone, Debug, PartialEq)]`
  - All 5 error codes: `AmountTooLow=1`, `CooldownActive=2`, `MessageTooLong=3`, `InvalidAmount=4`, `CampaignNotFound=5`

- [ ] **T-110** Add `#[contract]` to `DonationContract` struct and `#[contractimpl]` to impl block

---

## A5 — `donate` Function (Core + Most Complex)

- [ ] **T-111** Implement `donate(env, donor, amount, message) -> CampaignStats`
  - `donor.require_auth()`
  - Validate `amount <= 0` → panic `"donation amount must be positive"`
  - Validate `amount < MIN_DONATION_STROOPS` → panic `"donation below minimum of 1 XLM"`
  - Validate `message.len() > MAX_MESSAGE_LEN` → panic `"message exceeds 140 character limit"`
  - Load `DonorStats(donor)` from persistent storage (default zeroed)
  - If `last_donated_at > 0`: compute `elapsed = now - last_donated_at`
    - If `elapsed < DONATION_COOLDOWN_SECONDS` → panic `"cooldown active"`
  - Load `DonationLog` from persistent storage (default empty Vec)
  - If `log.len() >= MAX_DONORS`: rebuild Vec skipping index 0 (trim oldest entry)
  - Append new `Donation { donor, amount, message, donated_at: now }` to log
  - Write entire log back in one write
  - Update `DonorStats`: increment `total_donated`, `donation_count`, set `last_donated_at = now`
  - Write `DonorStats(donor)` back
  - Load `CampaignStats` from instance storage (default zeroed)
  - If `donor_stats.donation_count` was 0 before increment: `stats.donor_count += 1`
  - Always: `stats.total_raised += amount`, `stats.donation_count += 1`
  - Write `CampaignStats` to instance storage
  - Return updated `CampaignStats`

---

## A6 — `set_goal` Function

- [ ] **T-112** Implement `set_goal(env, caller, goal_amount) -> i128`
  - `caller.require_auth()`
  - Write `goal_amount` to `DataKey::GoalAmount` in instance storage
  - Load `CampaignStats`, set `stats.goal_amount = goal_amount`, write back
  - Return `goal_amount`

---

## A7 — Read-Only Functions

- [ ] **T-113** Implement `get_donations(env) -> Vec<Donation>`
  - Read `DonationLog` from persistent storage
  - Return Vec or empty if unset
  - No auth required

- [ ] **T-114** Implement `get_campaign_stats(env) -> CampaignStats`
  - Read `CampaignStats` from instance storage
  - Return or zeroed default
  - No auth required

- [ ] **T-115** Implement `get_donor_stats(env, donor) -> DonorStats`
  - Read `DonorStats(donor)` from persistent storage
  - Return or zeroed default
  - No auth required

- [ ] **T-116** Implement `can_donate(env, donor) -> (bool, u64)`
  - Load `DonorStats(donor)` (default zeroed)
  - If `last_donated_at == 0`: return `(true, 0)`
  - Compute `elapsed = now - last_donated_at`
  - If `elapsed >= DONATION_COOLDOWN_SECONDS`: return `(true, 0)`
  - Else: return `(false, DONATION_COOLDOWN_SECONDS - elapsed)`
  - No auth required

---

## A8 — Unit Tests (18 total)

- [ ] **T-117** Create `#[cfg(test)]` module with `setup()` helper
  - `Env::default()` + `env.mock_all_auths()`
  - `env.ledger().set_timestamp(1_700_000_000)` for deterministic time
  - Register contract, create typed client, generate test user address
  - Helper `make_message(env, text)` for creating on-chain strings

- [ ] **T-118** `test_donate_success`
  - Donate 1 XLM → `get_campaign_stats` shows `total_raised=10_000_000`, `donor_count=1`, `donation_count=1`

- [ ] **T-119** `test_donate_updates_donation_log`
  - Donate → `get_donations` returns 1 entry with correct donor address, amount, timestamp

- [ ] **T-120** `test_donate_below_minimum_fails`
  - Donate 5_000_000 stroops (0.5 XLM) → panics

- [ ] **T-121** `test_donate_zero_fails`
  - Donate 0 stroops → panics

- [ ] **T-122** `test_donate_message_too_long_fails`
  - 141-character message → panics

- [ ] **T-123** `test_donate_message_empty_ok`
  - Empty string message → succeeds, entry stored with empty message

- [ ] **T-124** `test_cooldown_prevents_spam`
  - Donate at timestamp T → immediately donate again at T → second panics

- [ ] **T-125** `test_cooldown_expires`
  - Donate at T → set ledger to `T + 3_601` → donate again → succeeds

- [ ] **T-126** `test_multiple_donors_tracked`
  - Three different `Address::generate` wallets each donate → `donor_count=3`, `donation_count=3`

- [ ] **T-127** `test_same_donor_cumulative`
  - Donor A donates 1 XLM → cooldown passes → donates 2 XLM → `DonorStats.total_donated = 30_000_000`

- [ ] **T-128** `test_donor_stats_accurate`
  - After 2 donations: `donation_count=2`, `total_donated` equals sum of both amounts

- [ ] **T-129** `test_can_donate_fresh_address`
  - Fresh address → `can_donate` returns `(true, 0)`

- [ ] **T-130** `test_can_donate_cooldown_active`
  - After donation → `can_donate` returns `(false, n)` where `n > 0`

- [ ] **T-131** `test_can_donate_after_cooldown`
  - After donation → advance ledger past cooldown → `can_donate` returns `(true, 0)`

- [ ] **T-132** `test_set_goal`
  - Set goal to 100 XLM (1_000_000_000 stroops) → `get_campaign_stats.goal_amount == 1_000_000_000`

- [ ] **T-133** `test_log_capped_at_max`
  - Create MAX_DONORS + 1 unique addresses, advance ledger past cooldown between each
  - Donate from each → `get_donations().len() <= MAX_DONORS`

- [ ] **T-134** `test_get_donor_stats_unknown`
  - Fresh address that never donated → `get_donor_stats` returns zeroed `DonorStats`

- [ ] **T-135** `test_get_campaign_stats_empty`
  - Fresh contract with no donations → `get_campaign_stats` returns all zeros

- [ ] **T-136** Run all tests: `cargo test`
  - All 18 must show `ok`
  - Zero compilation warnings

---

## A9 — Deployment Scripts

- [ ] **T-201** Create `scripts/fund-account.sh`
  - Conditionally generate `deployer` key if not exists
  - Call Friendbot API with deployer public key
  - Print `✅ Funded: <address>`
  - `chmod +x scripts/fund-account.sh`

- [ ] **T-202** Create `scripts/deploy.sh`
  - Step 1: `cargo build --target wasm32-unknown-unknown --release`
  - Step 2: `stellar contract optimize --wasm stellar_donate.wasm`
  - Step 3: `CONTRACT_ID=$(stellar contract deploy ...)`
  - Step 4: Write `frontend/.env` with heredoc (4 `VITE_*` variables)
  - Step 5: Print `✅ Contract deployed!` and `CONTRACT_ID`
  - `chmod +x scripts/deploy.sh`

- [ ] **T-203** Create `scripts/invoke-test.sh`
  - Source `frontend/.env` at start
  - Invoke all 7 functions in sequence with sample data
  - Print each result clearly labeled
  - Print `✅ All smoke tests passed` at end
  - `chmod +x scripts/invoke-test.sh`

- [ ] **T-204** Execute `./scripts/fund-account.sh`
  - Confirm output shows `✅ Funded`

- [ ] **T-205** Execute `./scripts/deploy.sh`
  - Confirm output shows `✅ Contract deployed!`

- [ ] **T-206** Verify `frontend/.env` manually
  ```bash
  cat frontend/.env
  ```
  - `VITE_CONTRACT_ID` must be exactly 56 chars starting with `C`

- [ ] **T-207** Execute `./scripts/invoke-test.sh`
  - All 7 invocations succeed
  - Final line shows `✅ All smoke tests passed`

- [ ] **T-208** ✅ **PHASE A GATE — Confirm ALL conditions met:**
  - [ ] `cargo test` → all 18 tests `ok`
  - [ ] `deploy.sh` → exited 0, printed `✅ Contract deployed!`
  - [ ] `frontend/.env` → exists with valid `VITE_CONTRACT_ID`
  - [ ] `invoke-test.sh` → exited 0, printed `✅ All smoke tests passed`

---

# 🖥 PHASE B — FRONTEND
> Only begin after T-208 is fully confirmed. Do not skip.

---

## B1 — Next.js Project Setup

- [ ] **T-301** Initialize Vite React TypeScript project
  ```bash
  npm create vite@latest frontend -- --template react-ts
  ```

- [ ] **T-302** Install Stellar dependencies
  ```bash
  cd frontend && npm install @stellar/stellar-sdk @stellar/freighter-api
  ```

- [ ] **T-303** Install Vite Node.js polyfills
  ```bash
  npm install --save-dev vite-plugin-node-polyfills @types/node
  ```

- [ ] **T-304** Configure `vite.config.ts`
  - Add `@vitejs/plugin-react`
  - Add `nodePolyfills({ include: ['buffer','crypto','stream','util'], globals: { Buffer: true, global: true, process: true } })`
  - Add `resolve.alias: { '@': path.resolve(__dirname, './src') }`

- [ ] **T-305** Configure `tsconfig.json`
  - `"strict": true`, `"moduleResolution": "bundler"`, path alias `@/*`

- [ ] **T-306** Confirm `frontend/.env` exists from Phase A
  - If missing: STOP → re-run `scripts/deploy.sh`

- [ ] **T-307** Create `frontend/.env.example` with placeholder values

- [ ] **T-308** Update `frontend/index.html` — set `<title>Stellar Donate</title>`

- [ ] **T-309** Verify dev server starts without errors: `npm run dev`

---

## B2 — Foundation Layer

- [ ] **T-401** Create `frontend/src/types/index.ts`
  - Interfaces: `Donation`, `DonorStats`, `CampaignStats`
  - Types: `TxStatus` (6 states), `TxState`
  - Constants: `INITIAL_TX_STATE`, `STROOPS_PER_XLM`, `MIN_DONATION_XLM`, `COOLDOWN_SECONDS`

- [ ] **T-501** Create `frontend/src/lib/wallet.ts`
  - `checkExistingConnection(): Promise<string | null>`
  - `connectFreighter(): Promise<WalletInfo>`
  - `truncateAddress(address: string): string`
  - Re-export `signTransaction`

- [ ] **T-502** Create `frontend/src/lib/contract.ts` — base setup
  - Initialize `server` and `contract` from env vars
  - Implement `runTx(source, operation, onStatus)` — full write lifecycle
  - Implement `readTx<T>(operation)` — simulation-only read

- [ ] **T-503** Implement decode helpers in `contract.ts`
  - `decodeDonation(raw: unknown): Donation` — snake_case → camelCase
  - `decodeCampaignStats(raw: unknown): CampaignStats`
  - `decodeDonorStats(raw: unknown): DonorStats`

- [ ] **T-504** Implement `contractDonate(donor, amountXlm, message, onStatus)`
  - Convert XLM to stroops via `BigInt(Math.round(xlm * STROOPS_PER_XLM))`
  - Call `runTx`, re-fetch and return updated `CampaignStats`

- [ ] **T-505** Implement `contractSetGoal(caller, goalXlm, onStatus)`
  - Convert to stroops, call `runTx`, return txHash

- [ ] **T-506** Implement `contractGetDonations()`
  - Call `readTx`, decode array, return in **reverse** order (newest first)

- [ ] **T-507** Implement `contractGetCampaignStats()`
  - Call `readTx`, decode and return `CampaignStats`

- [ ] **T-508** Implement `contractGetDonorStats(donorPublicKey)`
  - Call `readTx`, decode and return `DonorStats`

- [ ] **T-509** Implement `contractCanDonate(donorPublicKey)`
  - Call `readTx`, decode tuple `[boolean, number]`
  - Return `{ canDonate, secondsRemaining }`

---

## B3 — Context and Hooks

- [ ] **T-601** Create `frontend/src/context/WalletContext.tsx`
  - `WalletProvider` managing `publicKey`, `isConnected`, `isCorrectNetwork`
  - Check existing connection silently on mount
  - `connect()` and `disconnect()` actions
  - Export `useWalletContext()` with null guard

- [ ] **T-602** Create `frontend/src/hooks/useWallet.ts`
  - Re-export `useWalletContext` as `useWallet`

- [ ] **T-603** Create `frontend/src/hooks/useDonations.ts`
  - State: `donations`, `stats`, `donorStats`, `cooldown`, `loading`, `txState`
  - Fetch `donations` + `stats` on mount (no wallet needed for public data)
  - Fetch `donorStats` + `cooldown` when `publicKey` changes
  - `donate(amountXlm, message)` — manage txState, call contract, refresh on success
  - `setGoal(goalXlm)` — manage txState, call contract
  - `refresh()` — re-fetch all data
  - Cooldown countdown: `useEffect` with `setInterval` decrementing `secondsRemaining` every 1s
  - Auto-reset `txState` to `INITIAL_TX_STATE` 5s after success

---

## B4 — Components

- [ ] **T-701** Create `ConnectWallet.tsx`
  - Three states: disconnected / connected+correct / connected+wrong-network
  - Amber warning banner for wrong network

- [ ] **T-702** Create `TxStatusBanner.tsx`
  - Props: `txState: TxState`, `onDismiss: () => void`
  - All 6 status states with icons
  - Stellar Expert link on success
  - Auto-dismiss 5s after success

- [ ] **T-703** Create `StatsBar.tsx`
  - Props: `stats: CampaignStats | null`, `topDonation: Donation | null`, `loading: boolean`
  - Three cards: Total Raised, Donors, Top Contribution
  - Shimmer skeleton when loading

- [ ] **T-704** Create `ProgressBar.tsx`
  - Props: `totalRaised: number`, `goalAmount: number`
  - Renders nothing when `goalAmount === 0`
  - Color transitions: blue → amber → green → pulsing green (100%+)
  - "🎉 Goal Reached!" label at 100%

- [ ] **T-705** Create `DonorRow.tsx`
  - Props: `donation: Donation`, `rank: number`, `isCurrentUser: boolean`
  - Gold/silver/bronze rank colors for top 3
  - "You" badge for current user's row
  - Relative time via local `formatRelativeTime` utility
  - Message shown in muted secondary style if non-empty

- [ ] **T-706** Create `DonorList.tsx`
  - Props: `donations`, `currentUserAddress`, `loading`
  - "Show more" pagination (10 per page)
  - Empty state: "Be the first to donate! 💫"
  - 5 skeleton rows while loading

- [ ] **T-707** Create `DonateForm.tsx`
  - Amount input (number, min=1, step=0.5)
  - Quick-select buttons: 1 XLM, 5 XLM, 10 XLM, 25 XLM
  - Message textarea (max 140 chars, live counter)
  - All 6 disabled conditions handled
  - Cooldown countdown display: `⏳ hh:mm:ss`
  - "Set Goal" collapsible section
  - `TxStatusBanner` rendered below form

---

## B5 — App Shell

- [ ] **T-801** Create `frontend/src/App.tsx`
  - `WalletProvider` at root
  - Sticky header: "💝 Stellar Donate" logo + `ConnectWallet`
  - `StatsBar` + `ProgressBar` below header
  - Two-column layout: `DonateForm` (left) + `DonorList` (right)
  - Single-column on mobile (<768px)
  - Max width 1100px, centered

- [ ] **T-802** Create `frontend/src/main.tsx`
  - React 18 `createRoot` mounting with `ErrorBoundary`

- [ ] **T-803** Create `frontend/src/index.css`
  - CSS reset, body styles, system font
  - `@keyframes spin`, `@keyframes pulse`, `@keyframes shimmer`
  - `.spin`, `.pulse`, `.skeleton` utility classes

---

## B6 — Integration QA

- [ ] **T-901** `npm run build` — exits 0, zero TypeScript errors

- [ ] **T-902** `npm run dev` — `localhost:5173` loads with no console errors

- [ ] **T-903** Page loads without wallet — `StatsBar` shows "0 XLM", `DonorList` shows empty state
  - Confirms public data accessible without wallet ✓

- [ ] **T-904** Click "Connect Wallet" → Freighter popup → key shown in header

- [ ] **T-905** Click "1 XLM" quick-select button → amount field fills with `1`

- [ ] **T-906** Type a message "Test donation for smoke test" → char counter shows `34/140`

- [ ] **T-907** Click "Donate 1 XLM" → verify all 5 TxStatusBanner stages cycle through
  - building → awaiting_signature → submitting → polling → success

- [ ] **T-908** After confirmation:
  - StatsBar shows `1 XLM` total raised
  - DonorList shows new row with "You" badge
  - TxStatusBanner shows tx hash link

- [ ] **T-909** "Donate" button shows `⏳ Next donation available in 00:59:59` countdown

- [ ] **T-910** Try to donate again immediately → button disabled with cooldown timer visible

- [ ] **T-911** Set goal to 10 XLM → ProgressBar appears showing `10% of goal`

- [ ] **T-912** ProgressBar color is blue at 10%

- [ ] **T-913** Switch Freighter to Mainnet → amber warning banner shown, donate button disabled

- [ ] **T-914** Reconnect on Testnet → normal state restored

- [ ] **T-915** Resize to 375px → single column layout, all elements accessible

- [ ] **T-916** Audit browser DevTools console → zero `console.log` statements

---

## B7 — Documentation

- [ ] **T-1001** Write `README.md`
  - Project description and transparency model
  - Spam prevention explanation (minimum 1 XLM + 1-hour cooldown, both on-chain)
  - Architecture diagram (ASCII):
    ```
    Browser (no wallet) → readTx → Soroban RPC → DonationLog (public)
    Browser (Freighter)  → runTx → sign → Soroban RPC → donate() contract
                                                         ↓
                                             DonationLog Vec<Donation>
                                             DonorStats(Address)
                                             CampaignStats (instance)
    ```
  - Note on MVP limitation: contract records intent, does not transfer XLM
  - Phase A instructions: `fund-account.sh` → `deploy.sh` → `invoke-test.sh`
  - Phase B instructions: `npm install` → verify `.env` → `npm run dev`
  - Unit tests: `cd contract && cargo test`
  - Environment variable reference table
  - Stellar Expert testnet link

- [ ] **T-1002** Add JSDoc comments to all exported functions in `contract.ts`
- [ ] **T-1003** Add JSDoc to `useDonations` hook
- [ ] **T-1004** Remove all `console.log` debug statements from frontend
- [ ] **T-1005** Final commit: `feat: complete stellar-donate donation tracking dApp`

---

## Task Summary Table

| Phase | Section | Task Range | Count | Description |
|---|---|---|---|---|
| **PHASE A** | A1 Setup | T-001 → T-007 | 7 | Tools + repo init |
| | A2 Scaffold | T-101 → T-103 | 3 | Cargo.toml + compile check |
| | A3 Constants | T-104 | 1 | Spam guard constants |
| | A4 Data Model | T-105 → T-110 | 6 | All structs, enums, errors |
| | A5 donate() | T-111 | 1 | Core function (most complex) |
| | A6 set_goal() | T-112 | 1 | Goal setter |
| | A7 Read fns | T-113 → T-116 | 4 | 4 public read functions |
| | A8 Tests | T-117 → T-136 | 20 | 18 unit tests + run |
| | A9 Deploy | T-201 → T-208 | 8 | Scripts + gate check |
| **PHASE B** | B1 Setup | T-301 → T-309 | 9 | Vite + deps + polyfills |
| | B2 Foundation | T-401 → T-509 | 10 | Types + lib layer |
| | B3 Context+Hooks | T-601 → T-603 | 3 | WalletContext + 2 hooks |
| | B4 Components | T-701 → T-707 | 7 | All 7 components |
| | B5 App Shell | T-801 → T-803 | 3 | App + main + CSS |
| | B6 QA | T-901 → T-916 | 16 | End-to-end testing |
| | B7 Docs | T-1001 → T-1005 | 5 | README + polish |
| **TOTAL** | | | **104 tasks** | Full project lifecycle |

---

## ✔️ Definition of Done

A task is complete when ALL of the following are true:
1. Code compiles — Rust (no warnings) or TypeScript (strict, zero errors)
2. All 18 unit tests pass: `cargo test`
3. Contract is live on Stellar Testnet with ID persisted in `frontend/.env`
4. Feature works end-to-end in browser with real Freighter wallet
5. Zero `console.log` debug statements remain in frontend
6. Change committed with a descriptive, meaningful message

---

## 🚦 Phase A Critical Path — Execute in This Exact Order

```
T-001 → T-005     Install tools + Freighter
T-101 → T-103     Scaffold + verify initial compile
T-104             Constants (spam guard values)
T-105 → T-110     Data model (structs, keys, errors)
T-111             donate() — core function with spam guards + Vec cap
T-112             set_goal()
T-113 → T-116     4 read-only functions
T-136             cargo test — all 18 pass
T-201 → T-207     fund → deploy → smoke test
T-208             ✅ GATE — confirm all 4 conditions
```

## 🚦 Phase B Critical Path — Fastest Working Demo

```
T-301 → T-309     Bootstrap + polyfills
T-401             Types (all interfaces + constants)
T-501 → T-509     wallet.ts + contract.ts (all 6 functions)
T-601 → T-603     WalletContext + useWallet + useDonations
T-701             ConnectWallet (must connect before donations work)
T-702             TxStatusBanner (must show during tx)
T-703             StatsBar (always-visible public data)
T-706             DonorList (always-visible public data)
T-707             DonateForm (core user action)
T-801 → T-803     App shell + CSS
T-901 → T-911     Core QA (donate → cooldown → goal → progress)
```

Then return for T-704–T-705 (ProgressBar + DonorRow polish), T-912–T-916 (edge cases), T-1001–T-1005 (docs).
