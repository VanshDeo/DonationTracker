# 🛠 SKILLS.md — Donation Tracking dApp on Stellar Soroban

All technical skill domains required to build, test, and deploy the `stellar-donate` dApp. Each skill is tagged with **Phase A** (contract), **Phase B** (frontend), or **A+B** (both).

---

## 1. Rust — Soroban Smart Contract Development
**Phase:** A | **Level:** Intermediate–Advanced

### SDK Macros
| Macro | Purpose |
|---|---|
| `#![no_std]` | No standard library — Soroban runs in a sandboxed WASM environment |
| `#[contract]` | Marks the contract entry struct |
| `#[contractimpl]` | Marks the implementation block exported on-chain |
| `#[contracttype]` | Enables binary XDR serialization for custom enums and structs |
| `#[contracterror]` | Defines typed error codes returned to callers with integer discriminants |

### Soroban Native Types Used in This Project
| Type | Usage |
|---|---|
| `Address` | Wallet identity — call `.require_auth()` to enforce signature |
| `String` | On-chain string (`soroban_sdk::String`, not `std::String`) |
| `Vec<T>` | Growable list — `.push_back()`, `.get(i)`, `.len()`, `.is_empty()` |
| `i128` | Token/strop amounts — supports large donation totals without overflow |
| `u32` | Counters — donor_count, donation_count |
| `u64` | Timestamps and cooldown computations |
| `bool` | Cooldown status flags |
| `Env` | Execution context — access storage, ledger, events |

### Storage Tiers — Critical Design Decision
| Tier | API | Cost | TTL | Used for |
|---|---|---|---|---|
| **Instance** | `env.storage().instance()` | Cheapest | Contract TTL | `CampaignStats`, `GoalAmount` — frequently read globals |
| **Persistent** | `env.storage().persistent()` | Medium | Own TTL | `DonationLog` (Vec), `DonorStats(Address)` — per-donor data |

**Why CampaignStats is in instance storage:**
Stats (total raised, donor count) are read on every page load. Instance storage is accessed alongside the contract instance — it has no extra TTL rent cost and is cheaper to read. This is the correct tier for frequently-read small values.

### Storage Optimization — Capped Vec Pattern
The `DonationLog` stores the full donation history as a single `Vec<Donation>` under one key:
```rust
// ONE read for entire history:
let log: Vec<Donation> = env.storage().persistent().get(&DataKey::DonationLog)
    .unwrap_or_else(|| Vec::new(&env));
```
**Why not one key per donation?**
- N keys = N storage reads = N × fee per read
- One key = 1 read regardless of donation count
- Dramatically cheaper for querying the donor list

**Vec size cap (MAX_DONORS = 500):**
Without a cap, the Vec grows forever → storage rent grows forever → contract becomes expensive. The cap trims the oldest entry when the limit is hit:
```rust
if log.len() >= MAX_DONORS {
    let mut trimmed: Vec<Donation> = Vec::new(&env);
    for i in 1..log.len() {          // skip index 0 (oldest)
        trimmed.push_back(log.get(i).unwrap());
    }
    log = trimmed;
}
```

### Spam Prevention — Two-Layer Guard
**Layer 1 — Minimum donation:**
```rust
const MIN_DONATION_STROOPS: i128 = 10_000_000; // 1 XLM
if amount < MIN_DONATION_STROOPS { panic!(...) }
```
Prevents dust spam (thousands of 0.0001 XLM entries flooding the log).

**Layer 2 — Per-wallet cooldown:**
```rust
const DONATION_COOLDOWN_SECONDS: u64 = 3_600; // 1 hour
let elapsed = now.saturating_sub(stats.last_donated_at);
if elapsed < DONATION_COOLDOWN_SECONDS { panic!("cooldown active") }
```
Prevents one wallet from making rapid-fire donations to flood the leaderboard. Enforced **on-chain** — the frontend countdown is purely a UX hint.

### `can_donate` Return Pattern
The `can_donate` function returns a tuple `(bool, u64)`:
- `(true, 0)` — can donate now
- `(false, 1800)` — must wait 1800 more seconds

This is more useful than just a boolean because the frontend can display a live countdown without any additional contract reads.

### Unit Testing
```rust
let env = Env::default();
env.mock_all_auths();                          // Bypass require_auth() in tests
env.ledger().set_timestamp(1_700_000_000);     // Set known timestamp
let id = env.register_contract(None, DonationContract);
let client = DonationContractClient::new(&env, &id);
let user = Address::generate(&env);
```
**Simulating cooldown expiry in tests:**
```rust
// Advance ledger past cooldown period
env.ledger().set_timestamp(1_700_000_000 + 3_601);
// Now second donation succeeds
```

---

## 2. Donation & Fundraising Domain Knowledge
**Phase:** A+B | **Level:** Basic–Intermediate

### What You Need to Know

**Donation vs. transfer:**
In this MVP, "donating" means recording the intent on-chain. The contract does NOT actually move XLM between accounts — it tracks that a donation of N stroops was made. A full implementation would use Stellar's native token transfer before calling `donate`. This distinction must be clear in the README.

**Stroops vs XLM:**
```
1 XLM = 10,000,000 stroops
```
All on-chain values are in stroops (`i128`). All user-facing UI values are in XLM (`number`). Conversion:
```typescript
const stroops = BigInt(Math.round(xlm * 10_000_000));  // XLM → stroops
const xlm = stroops / 10_000_000;                        // stroops → XLM
```
Never use JavaScript floats directly for strop amounts — use `BigInt` to avoid precision loss.

**Leaderboard calculation:**
The on-chain `DonationLog` is a chronological list. The "top donor" is computed in the frontend by:
1. Group donations by donor address
2. Sum `amount` per address
3. Sort descending → take index 0

This is a frontend computation — the contract doesn't maintain a sorted leaderboard (too expensive on-chain).

**Fundraising goal:**
The goal is optional (goalAmount=0 means no goal). The `ProgressBar` component only renders when `goalAmount > 0`. Progress percentage = `min(totalRaised / goalAmount, 1.0) * 100`.

**Cooldown UX:**
The `can_donate` endpoint returns seconds remaining. The frontend starts a local countdown timer (`useInterval`) that decrements every second. This is purely cosmetic — the contract enforces the actual cooldown.

---

## 3. Stellar CLI — Testnet Operations
**Phase:** A | **Level:** Intermediate

### Key Commands for This Project
```bash
# Identity management
stellar keys generate deployer --network testnet
stellar keys address deployer

# Funding
curl -sf https://friendbot.stellar.org?addr=$DEPLOYER

# Build + optimize pipeline
cargo build --target wasm32-unknown-unknown --release
stellar contract optimize --wasm stellar_donate.wasm

# Deploy and capture ID
CONTRACT_ID=$(stellar contract deploy \
  --wasm stellar_donate.optimized.wasm \
  --network testnet \
  --source deployer)

# Invoke donate (i128 encoded as number string)
stellar contract invoke --id $CONTRACT_ID --fn donate -- \
  --donor $DEPLOYER \
  --amount 50000000 \
  --message "Test donation"

# Invoke can_donate (returns tuple)
stellar contract invoke --id $CONTRACT_ID --fn can_donate -- \
  --donor $DEPLOYER
```

### Automated .env Writing Pattern
```bash
cat > frontend/.env << EOF
VITE_CONTRACT_ID=$CONTRACT_ID
VITE_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
VITE_RPC_URL=https://soroban-testnet.stellar.org
VITE_HORIZON_URL=https://horizon-testnet.stellar.org
EOF
```
This eliminates manual copy-paste — the pipeline is fully automated for Antigravity.

---

## 4. Stellar JavaScript/TypeScript SDK
**Phase:** B | **Level:** Advanced

### Full Transaction Lifecycle
```
1. server.getAccount(publicKey)
2. new TransactionBuilder(account, { fee, networkPassphrase })
   .addOperation(contract.call('donate', ...args))
   .setTimeout(30).build()
3. server.simulateTransaction(tx)            ← ALWAYS simulate before sign
4. SorobanRpc.Api.isSimulationError(sim)     ← check for errors
5. SorobanRpc.assembleTransaction(tx, sim).build()
6. signTransaction(xdr, { networkPassphrase }) ← Freighter popup
7. server.sendTransaction(signed)
8. poll server.getTransaction(hash) every 1.5s (max 20 iterations)
9. status === SUCCESS → return hash
   status === FAILED  → throw error
```

### i128 Encoding
Soroban `i128` must be passed as `BigInt`:
```typescript
const amountStroops = BigInt(Math.round(xlm * 10_000_000));
nativeToScVal(amountStroops, { type: 'i128' })
```
Never pass a regular JavaScript `number` for `i128` args — precision loss for large amounts.

### Tuple Return Value Decoding
`can_donate` returns `(bool, u64)` — decoded as:
```typescript
const raw = await readTx<unknown[]>(op);
const arr = raw as unknown[];
return { canDonate: Boolean(arr[0]), secondsRemaining: Number(arr[1]) };
```

### Read-Only Simulation Pattern
For `get_donations`, `get_campaign_stats`, `get_donor_stats`, `can_donate`:
```typescript
async function readTx<T>(operation: xdr.Operation): Promise<T> {
  // Build with fake account — no real source needed for reads
  // simulate only — no signing, no fee, instant
}
```
Public data reads require zero wallet connection.

### Decode Strategy for Rust Structs
Rust `snake_case` field names → TypeScript `camelCase`:
```typescript
function decodeDonation(raw: unknown): Donation {
  const o = raw as Record<string, unknown>;
  return {
    donor:     String(o['donor']),
    amount:    Number(o['amount']),
    message:   String(o['message']),
    donatedAt: Number(o['donated_at']),  // ← snake_case from Rust
  };
}
```

---

## 5. Freighter Wallet Integration
**Phase:** B | **Level:** Intermediate

### API Surface
```typescript
import {
  isConnected,       // boolean — extension installed + prior consent
  requestAccess,     // void — permission popup
  getPublicKey,      // string — G... address
  getNetworkDetails, // { networkPassphrase, network }
  signTransaction,   // string — signed XDR
} from '@stellar/freighter-api';
```

### Error Handling Matrix
| Scenario | User-Facing Message |
|---|---|
| Not installed | "Install Freighter from freighter.app" |
| User rejects access | "Connection cancelled" |
| User rejects signing | "Transaction cancelled" |
| Wrong network | "Switch to Stellar Testnet in Freighter" |
| Cooldown active | "⏳ Next donation available in hh:mm:ss" |
| Amount too low | "Minimum donation is 1 XLM" |

---

## 6. React 18 + TypeScript + Vite
**Phase:** B | **Level:** Intermediate–Advanced

### TypeScript Strict Mode Requirements
- `"strict": true` — zero `any`, zero implicit `any`
- `Record<string, unknown>` pattern for XDR decoded objects
- `i128` values use `number` in TypeScript (safe for amounts < 2^53 — well within donation ranges)
- `BigInt` only used when encoding strop amounts for contract calls

### Custom Hook Patterns
```typescript
// useDonations returns:
interface UseDonationsReturn {
  donations: Donation[];
  stats: CampaignStats | null;
  donorStats: DonorStats | null;
  cooldown: { canDonate: boolean; secondsRemaining: number };
  loading: boolean;
  txState: TxState;
  donate: (amountXlm: number, message: string) => Promise<void>;
  setGoal: (goalXlm: number) => Promise<void>;
  refresh: () => Promise<void>;
}
```

### Cooldown Countdown Timer
```typescript
// useInterval hook pattern
useEffect(() => {
  if (cooldown.secondsRemaining <= 0) return;
  const id = setInterval(() => {
    setCooldown(prev => ({
      ...prev,
      secondsRemaining: Math.max(0, prev.secondsRemaining - 1),
      canDonate: prev.secondsRemaining - 1 <= 0,
    }));
  }, 1000);
  return () => clearInterval(id);
}, [cooldown.secondsRemaining]);
```

### Relative Time Formatting (Without date-fns)
```typescript
function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor(Date.now() / 1000) - timestamp;
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
}
```
Avoid adding `date-fns` as a dependency — implement this utility locally.

### Vite + Node Polyfills
```typescript
// vite.config.ts
import { nodePolyfills } from 'vite-plugin-node-polyfills';
plugins: [
  react(),
  nodePolyfills({
    include: ['buffer', 'crypto', 'stream', 'util'],
    globals: { Buffer: true, global: true, process: true },
  }),
]
```

---

## 7. Minimal UI Design — Clean, Data-First
**Phase:** B | **Level:** Basic–Intermediate

### Design Philosophy for This Project
- **Transparency first**: all donation data visible to anyone without wallet
- **No heavy CSS framework**: plain CSS with inline styles or CSS Modules
- **Data density**: show as much information as possible without clutter
- **Progressive disclosure**: quick-select buttons for common amounts, optional message

### CSS Patterns Used
```css
/* Card */
background: #ffffff;
border: 1px solid #e2e8f0;
border-radius: 12px;
padding: 1.5rem;
box-shadow: 0 1px 3px rgba(0,0,0,0.06);

/* Primary button */
background: #6366f1;
color: #ffffff;
border-radius: 8px;
padding: 0.75rem 1.5rem;
font-weight: 600;

/* Disabled button */
opacity: 0.5;
cursor: not-allowed;

/* Stats number */
font-size: 2rem;
font-weight: 700;
color: #1e293b;

/* Rank colors */
#1: color: #f59e0b;  /* gold */
#2: color: #94a3b8;  /* silver */
#3: color: #b45309;  /* bronze */
```

### Progress Bar Implementation
```css
.progress-track {
  background: #e2e8f0;
  border-radius: 9999px;
  height: 12px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  border-radius: 9999px;
  transition: width 0.5s ease;
}
/* Color tiers applied via inline style based on percentage */
```

---

## 8. Web3 Security Practices
**Phase:** A+B | **Level:** Intermediate

### Contract Security
- `require_auth()` on `donate` and `set_goal` — no spoofing
- On-chain cooldown enforcement — frontend cannot bypass it
- On-chain minimum donation — prevents economically-meaningless spam
- `i128` for all monetary values — no integer overflow risk
- Vec size cap — prevents runaway storage costs

### Frontend Security
- `VITE_*` vars are public (bundled in JS) — only non-secret config goes there
- `frontend/.env` excluded from git via `.gitignore`
- `BigInt` for strop encoding — no floating-point precision bugs in tx args
- Network passphrase validated before any tx submission
- Contract ID from env — never hardcoded in source

---

## 9. Bash Scripting — Agentic Deployment
**Phase:** A | **Level:** Basic–Intermediate

### Patterns Used
```bash
set -euo pipefail    # Fail fast: any error/undefined var/pipe failure stops script

# Capture CLI output
CONTRACT_ID=$(stellar contract deploy ...)

# Write .env with heredoc (preserves multi-line, no escaping needed)
cat > frontend/.env << EOF
VITE_CONTRACT_ID=$CONTRACT_ID
VITE_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
EOF

# Idempotent key generation
if ! stellar keys address deployer &>/dev/null 2>&1; then
  stellar keys generate deployer --network testnet
fi

# Source env in test script
source frontend/.env
CONTRACT_ID=$VITE_CONTRACT_ID
```

### Antigravity-Specific Pipeline Logic
1. `fund-account.sh` → funds deployer on testnet
2. `deploy.sh` → builds, optimizes, deploys contract, **writes** `VITE_CONTRACT_ID` to `frontend/.env`
3. `invoke-test.sh` → sources `frontend/.env`, runs all 7 CLI smoke tests
4. Frontend reads `import.meta.env.VITE_CONTRACT_ID` at runtime
5. Zero manual intervention — fully automated contract-to-frontend handoff

---

## Skill Summary Table

| # | Domain | Phase | Level | Primary Tools |
|---|---|---|---|---|
| 1 | Rust / Soroban SDK | A | Intermediate–Advanced | `soroban-sdk v20`, `cargo` |
| 2 | Donation Domain Knowledge | A+B | Basic–Intermediate | Stroops math, leaderboard logic |
| 3 | Stellar CLI & Testnet | A | Intermediate | `stellar` CLI, Friendbot |
| 4 | Stellar JS/TS SDK | B | Advanced | `stellar-sdk`, Soroban RPC |
| 5 | Freighter Wallet Integration | B | Intermediate | `@stellar/freighter-api` |
| 6 | React 18 + TypeScript + Vite | B | Intermediate–Advanced | Vite 5, React 18, TS strict |
| 7 | Minimal Data-First UI Design | B | Basic–Intermediate | Plain CSS, no framework |
| 8 | Web3 Security Practices | A+B | Intermediate | Auth, stroops, env hygiene |
| 9 | Bash Deployment Pipeline | A | Basic–Intermediate | `deploy.sh`, heredoc, capture |
