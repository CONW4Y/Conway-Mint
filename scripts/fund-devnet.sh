#!/bin/bash
# Airdrop devnet SOL for testing

set -e

echo "=== Requesting Devnet SOL Airdrop ==="

KEYPAIR_PATH="$HOME/.config/solana/automaton-keypair.json"
PUBKEY=$(solana-keygen pubkey "$KEYPAIR_PATH" 2>/dev/null || echo "")

if [ -z "$PUBKEY" ]; then
    echo "Error: No keypair found. Run setup-solana.sh first."
    exit 1
fi

echo "Wallet: $PUBKEY"

# Request 2 SOL (max per airdrop on devnet)
for i in 1 2 3; do
    echo "Airdrop request $i/3..."
    solana airdrop 2 "$PUBKEY" --url https://api.devnet.solana.com 2>/dev/null && echo "  ✓ 2 SOL received" || echo "  ✗ Airdrop failed (rate limited?)"
    sleep 2
done

echo ""
echo "Balance: $(solana balance "$PUBKEY" --url https://api.devnet.solana.com)"
echo ""
echo "Ready for testing! Switch to mainnet-beta in .env for production."
