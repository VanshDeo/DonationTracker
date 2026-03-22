# Stellar Donate 💸

A fully functional, decentralized Web3 application built on the Stellar Soroban blockchain. This dApp allows users to securely donate native XLM to a campaign, featuring a retro-hacker frontend and an optimized Rust smart contract.

## Deployment Details

*   **Contract ID / Address:** `CAYDWXTEZXZPBFMKLMVX557GANDXUCH7EMYT7GRDBSBLMNRIBAEY2WOI`
*   **Network:** Stellar Testnet
*   **Deployment Link:** <!-- Add your frontend deployment link here, e.g., Vercel / Netlify --> `[Insert Deployment URL Here]`

## Dashboard Preview

<!-- Replace the image link below with an actual screenshot of your DApp dashboard after deployment -->
![Dashboard Screenshot](./dashboard-preview.png)

## 

## Features ✨

*   **Non-Custodial Wallet Integration:** Securely connect and sign transactions using the [Freighter Browser Extension](https://www.freighter.app/).
*   **On-Chain Spam Prevention:** The smart contract enforces a minimum donation amount and a 1-hour cooldown per wallet to mitigate ledger spam.
*   **Real-time Ledger Dashboard:** View the total funds secured, unique operatives (donors), and the real-time public transaction ledger.
*   **Storage Optimized:** Utilizes Soroban's `Persistent` and `Instance` storage efficiently, capping the donation history to a rolling maximum of 100 entries to prevent unbounded rent costs.
*   **Retro Hacker UI:** A beautiful, responsive frontend built with React, Vite, and CSS variables featuring CRT scanlines and glitch animations.

## Project Architecture 🏗️

The project is divided into two main components:

1.  **Smart Contract (`/contract`)**: Written in Rust using the Soroban SDK (v25.3.0). It handles the core logic, enforces the cooldowns, and updates the state.
2.  **Frontend (`/frontend`)**: A React + Vite Web3 application written in TypeScript that interacts with the deployed contract on the Soroban Testnet.

---

## Getting Started 🚀

### Prerequisites

*   [Node.js](https://nodejs.org/) (v18+)
*   [Rust](https://www.rust-lang.org/) (v1.94+)
*   [Stellar CLI](https://developers.stellar.org/docs/build/smart-contracts/getting-started/setup)
*   [Freighter Wallet Extension](https://www.freighter.app/)

### 1. Smart Contract (Phase A)

The contract is already deployed to the Stellar Testnet, but if you wish to deploy it yourself:

1. Navigate to the contract directory:
   ```bash
   cd contract
   ```
2. Build the optimized `.wasm`:
   ```bash
   stellar contract build
   stellar contract optimize --wasm target/wasm32-unknown-unknown/release/stellar_donate.wasm
   ```
3. Run unit tests to verify contract logic:
   ```bash
   cargo test
   ```
4. Deploy the contract using the included script (you must have a funded Stellar testnet account):
   ```bash
   ./scripts/deploy.sh
   ```

### 2. Frontend Application (Phase B)

The frontend uses the `@stellar/stellar-sdk` and `@stellar/freighter-api` to connect to the deployed contract.

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
4. Open your browser to `http://localhost:3000`.

### Connecting your Wallet

1. Install the Freighter extension.
2. Switch the Freighter network to **Testnet**.
3. Fund your Freighter wallet using the [Stellar Laboratory Friendbot](https://laboratory.stellar.org/#account-creator?network=test).
4. Click **CONNECT FREIGHTER** in the top right corner of the dApp.

## Scripts Overview 📜

The root directory contains bash scripts to automate the Soroban deployment and testing workflow:

*   `scripts/fund-account.sh`: Generates a new keypair and funds it via Friendbot.
*   `scripts/deploy.sh`: Builds, optimizes, and deploys the contract, then automatically saves the `CONTRACT_ID` to `frontend/.env`.
*   `scripts/invoke-test.sh`: Runs a comprehensive CLI smoke test suite against the deployed contract, invoking every available function to verify on-chain behavior.
