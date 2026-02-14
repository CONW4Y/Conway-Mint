/**
 * Conway Deploy
 *
 * Self-sustaining AI agent that deploys memecoins and utility tokens
 * on Solana, earns trading fees, and converts earnings to fund its
 * own compute on Conway Cloud.
 *
 * This is the standalone entry point. When running inside the Automaton
 * framework, the skill is loaded via src/skills/token-launcher/index.ts
 * instead.
 */

import "dotenv/config";

export { register } from "./skills/token-launcher/index";
export type {
  TokenLauncherConfig,
  DeployedToken,
  TreasuryState,
} from "./skills/token-launcher/index";
export { CHAINS } from "./chains";

// ── Standalone Mode ──────────────────────────────────────
// When run directly (not inside Automaton), spin up a minimal
// runtime that exercises the skill tools.

async function main() {
  console.log(`
   ██████╗ ██████╗ ███╗   ██╗██╗    ██╗ █████╗ ██╗   ██╗
  ██╔════╝██╔═══██╗████╗  ██║██║    ██║██╔══██╗╚██╗ ██╔╝
  ██║     ██║   ██║██╔██╗ ██║██║ █╗ ██║███████║ ╚████╔╝
  ██║     ██║   ██║██║╚██╗██║██║███╗██║██╔══██║  ╚██╔╝
  ╚██████╗╚██████╔╝██║ ╚████║╚███╔███╔╝██║  ██║   ██║
   ╚═════╝ ╚═════╝ ╚═╝  ╚═══╝ ╚══╝╚══╝ ╚═╝  ╚═╝   ╚═╝
  ██████╗ ███████╗██████╗ ██╗      ██████╗ ██╗   ██╗
  ██╔══██╗██╔════╝██╔══██╗██║     ██╔═══██╗╚██╗ ██╔╝
  ██║  ██║█████╗  ██████╔╝██║     ██║   ██║ ╚████╔╝
  ██║  ██║██╔══╝  ██╔═══╝ ██║     ██║   ██║  ╚██╔╝
  ██████╔╝███████╗██║     ███████╗╚██████╔╝   ██║
  ╚═════╝ ╚══════╝╚═╝     ╚══════╝ ╚═════╝    ╚═╝
  `);

  console.log("Conway Deploy — Autonomous Token Deployment Agent");
  console.log("─".repeat(52));
  console.log("");

  // Validate required env vars
  const required = ["SOLANA_RPC_URL"];
  const missing = required.filter((k) => !process.env[k]);

  if (missing.length > 0) {
    console.log("Missing environment variables:");
    missing.forEach((k) => console.log(`  - ${k}`));
    console.log("");
    console.log("Copy .env.example to .env and fill in your config.");
    console.log("Or run inside the Automaton framework for full agent capabilities.");
    process.exit(1);
  }

  console.log("This skill is designed to run inside the Automaton framework.");
  console.log("");
  console.log("To use with Automaton:");
  console.log("  1. git clone https://github.com/Conway-Research/automaton.git");
  console.log("  2. Copy src/skills/token-launcher/ into automaton's src/skills/");
  console.log("  3. Use genesis-prompt.md as your seed instruction");
  console.log("  4. node dist/index.js --run");
  console.log("");
  console.log("The agent loop will automatically use the deploy_memecoin,");
  console.log("harvest_fees, and other tools registered by this skill.");
}

if (require.main === module) {
  main().catch(console.error);
}
