#!/bin/bash
# Setup Solana toolchain for automaton development

set -e

echo "=== Conway Deploy - Solana Setup ==="

# Install Solana CLI
if ! command -v solana &> /dev/null; then
    echo "Installing Solana CLI..."
    sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
    export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
    echo 'export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"' >> ~/.bashrc
fi

echo "Solana CLI version: $(solana --version)"

# Configure for devnet (switch to mainnet-beta for production)
echo ""
echo "Configuring Solana for devnet..."
solana config set --url https://api.devnet.solana.com

# Generate a new keypair if none exists
KEYPAIR_PATH="$HOME/.config/solana/automaton-keypair.json"
if [ ! -f "$KEYPAIR_PATH" ]; then
    echo ""
    echo "Generating new Solana keypair..."
    solana-keygen new --outfile "$KEYPAIR_PATH" --no-bip39-passphrase
    echo ""
    echo "Keypair saved to: $KEYPAIR_PATH"
    echo "Public key: $(solana-keygen pubkey $KEYPAIR_PATH)"
fi

solana config set --keypair "$KEYPAIR_PATH"

echo ""
echo "=== Setup Complete ==="
echo "Wallet: $(solana-keygen pubkey $KEYPAIR_PATH)"
echo "Network: $(solana config get | grep 'RPC URL')"
echo ""
echo "Next steps:"
echo "  1. Run ./scripts/fund-devnet.sh to get devnet SOL"
echo "  2. Copy the private key to .env as SOLANA_PRIVATE_KEY"
echo "  3. Set CREATOR_ADDRESS in .env to your personal wallet"
echo "  4. Run the automaton: node dist/index.js --run"
