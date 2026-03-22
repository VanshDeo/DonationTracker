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
