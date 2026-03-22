#!/usr/bin/env bash
set -euo pipefail

if [ ! -f frontend/.env ]; then
  echo "❌ frontend/.env missing. Run scripts/deploy.sh first."
  exit 1
fi

CONTRACT_ID=$(grep VITE_CONTRACT_ID frontend/.env | cut -d= -f2)
DEPLOYER=$(stellar keys address deployer)

echo "▶ Contract : $CONTRACT_ID"
echo "▶ Deployer : $DEPLOYER"
echo ""

echo "1️⃣  Getting initial campaign stats..."
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --network testnet \
  --source-account deployer \
  -- get_campaign_stats

echo ""
echo "2️⃣  Making a donation of 5 XLM (50_000_000 stroops)..."
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --network testnet \
  --source-account deployer \
  -- donate \
  --donor "$DEPLOYER" \
  --amount 50000000 \
  --message "First donation to the cause!"

echo ""
echo "3️⃣  Getting updated campaign stats..."
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --network testnet \
  --source-account deployer \
  -- get_campaign_stats

echo ""
echo "4️⃣  Getting donation log..."
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --network testnet \
  --source-account deployer \
  -- get_donations

echo ""
echo "5️⃣  Getting donor stats for deployer..."
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --network testnet \
  --source-account deployer \
  -- get_donor_stats \
  --donor "$DEPLOYER"

echo ""
echo "6️⃣  Checking if deployer can donate again (should be false — cooldown active)..."
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --network testnet \
  --source-account deployer \
  -- can_donate \
  --donor "$DEPLOYER"

echo ""
echo "7️⃣  Setting fundraising goal to 100 XLM..."
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --network testnet \
  --source-account deployer \
  -- set_goal \
  --caller "$DEPLOYER" \
  --goal_amount 1000000000

echo ""
echo "✅ All smoke tests passed"
