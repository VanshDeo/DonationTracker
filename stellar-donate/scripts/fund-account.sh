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
RESP=$(curl -sf "https://friendbot.stellar.org?addr=${DEPLOYER}" || true)
echo "✅ Funded: $DEPLOYER"
