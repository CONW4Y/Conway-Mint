# Conway Deploy

A self-sustaining AI agent built on [Conway Research's Automaton](https://github.com/Conway-Research/automaton) framework that autonomously deploys memecoins and utility tokens on Solana, earns trading fees, and uses those fees to fund its own continued existence on Conway Cloud.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   AUTOMATON CORE                        │
│            (Conway Research Framework)                  │
│   Think → Act → Observe → Repeat                       │
│   Identity / Survival / Self-Modification               │
├─────────────────────────────────────────────────────────┤
│                 CONWAY DEPLOY SKILL                      │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  Memecoin     │  │  Utility     │  │  Fee         │ │
│  │  Deployer     │  │  Token       │  │  Harvester   │ │
│  │              │  │  Deployer    │  │              │ │
│  │  - pump.fun  │  │  - SPL mint  │  │  - LP fees   │ │
│  │  - moonshot  │  │  - metadata  │  │  - royalties │ │
│  │  - raydium   │  │  - LP setup  │  │  - swaps     │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  Treasury     │  │  Market      │  │  Analytics   │ │
│  │  Manager      │  │  Monitor     │  │  Engine      │ │
│  │              │  │              │  │              │ │
│  │  - SOL mgmt  │  │  - price     │  │  - P&L       │ │
│  │  - USDC swap │  │  - volume    │  │  - survival  │ │
│  │  - Conway $  │  │  - trends    │  │  - strategy  │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
├─────────────────────────────────────────────────────────┤
│              CONWAY CLOUD RUNTIME                       │
│   Linux VM · Frontier Models · Stablecoin Payments      │
│   ERC-8004 Identity · Credit Survival System            │
└─────────────────────────────────────────────────────────┘
```

## How It Works

1. **Boot**: Automaton starts on Conway Cloud, generates wallets (ETH for identity + Solana for token ops)
2. **Analyze**: AI analyzes trending topics, meme culture, market conditions using frontier models
3. **Deploy**: Launches tokens on Solana via pump.fun, Raydium, or direct SPL token creation
4. **Earn**: Collects fees from LP positions, trading volume, and creator royalties
5. **Survive**: Converts Solana earnings → USDC → Conway Cloud credits to pay for compute
6. **Evolve**: Learns which token types perform best, refines strategy, self-modifies

## Revenue Streams

| Stream | Mechanism | Expected Yield |
|--------|-----------|----------------|
| **pump.fun Creator Fees** | 0.5% of trading volume on tokens you create | Variable |
| **Raydium LP Fees** | Concentrated liquidity positions on own tokens | 0.25% per swap |
| **Token Supply Retention** | Hold % of supply, sell into volume | Market dependent |
| **Utility Token Services** | Deploy tokens for others as a service | Fixed fee per deploy |

## Prerequisites

- Node.js 20+
- pnpm 9+
- Solana CLI tools
- A funded Solana wallet (for initial deployments)
- Conway Cloud account (or let automaton self-provision)

## Quick Start

```bash
# 1. Clone the base automaton framework
git clone https://github.com/Conway-Research/automaton.git
cd automaton

# 2. Install base dependencies
pnpm install
pnpm build

# 3. Copy the Conway Deploy skill into the automaton
cp -r /path/to/conway-deploy/skills/token-launcher src/skills/

# 4. Copy the genesis prompt
cp /path/to/conway-deploy/genesis-prompt.md .

# 5. Install Solana dependencies
pnpm add @solana/web3.js @solana/spl-token @metaplex-foundation/mpl-token-metadata \
  @raydium-io/raydium-sdk-v2 bs58 @coral-xyz/anchor

# 6. Set environment variables
cp .env.example .env
# Edit .env with your config

# 7. Run the automaton
node dist/index.js --run
```

When the setup wizard runs, use the genesis prompt from `genesis-prompt.md` as your seed instruction.

## Project Structure

```
conway-deploy/
├── README.md                    # This file
├── .env.example                 # Environment template
├── genesis-prompt.md            # The automaton's founding mission
├── skills/
│   └── token-launcher/
│       ├── skill.json           # Skill manifest for automaton loader
│       ├── index.ts             # Skill entry point
│       ├── deployer/
│       │   ├── memecoin.ts      # Memecoin deployment (pump.fun + raw SPL)
│       │   ├── utility.ts       # Utility token deployment
│       │   └── metadata.ts      # Token metadata / branding
│       ├── liquidity/
│       │   ├── raydium.ts       # Raydium pool creation & LP management
│       │   └── fees.ts          # Fee harvesting & collection
│       ├── treasury/
│       │   ├── wallet.ts        # Solana wallet management
│       │   ├── swap.ts          # SOL ↔ USDC swaps via Jupiter
│       │   └── bridge.ts        # Solana → Base bridge for Conway credits
│       ├── strategy/
│       │   ├── analyzer.ts      # Market trend analysis
│       │   ├── namer.ts         # AI-powered token naming
│       │   └── timing.ts        # Launch timing optimization
│       └── monitor/
│           ├── portfolio.ts     # Track all deployed tokens
│           └── survival.ts      # Map earnings to Conway survival tiers
├── config/
│   └── chains.ts                # Chain configs (Solana mainnet/devnet)
└── scripts/
    ├── setup-solana.sh          # Solana toolchain setup
    └── fund-devnet.sh           # Devnet SOL airdrop for testing
```

## Configuration

See `.env.example` for all configuration options. Key settings:

- `SOLANA_RPC_URL` - Your Solana RPC endpoint (Helius, Quicknode, etc.)
- `SOLANA_PRIVATE_KEY` - Agent's Solana wallet private key (or let automaton generate)
- `CREATOR_ADDRESS` - Your address for audit rights & fee splits
- `CREATOR_FEE_SPLIT` - % of earnings sent to creator (default: 10%)
- `SURVIVAL_RESERVE_SOL` - Minimum SOL balance to maintain
- `CONWAY_API_KEY` - Conway Cloud API key (auto-provisioned on first run)
