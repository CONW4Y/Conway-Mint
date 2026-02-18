/**
 * Conway Deploy - Skill Entry Point
 *
 * Registers all token deployment, fee harvesting, and treasury management
 * tools with the automaton's skill loader.
 */

import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { DeployMemecoin } from "./deployer/memecoin";
import { DeployUtilityToken } from "./deployer/utility";
import { TokenMetadataManager } from "./deployer/metadata";
import { RaydiumManager } from "./liquidity/raydium";
import { FeeHarvester } from "./liquidity/fees";
import { WalletManager } from "./treasury/wallet";
import { JupiterSwap } from "./treasury/swap";
import { BridgeManager } from "./treasury/bridge";
import { TrendAnalyzer } from "./strategy/analyzer";
import { TokenNamer } from "./strategy/namer";
import { PortfolioMonitor } from "./monitor/portfolio";
import { SurvivalMapper } from "./monitor/survival";

// ── Types ────────────────────────────────────────────────

export interface TokenLauncherConfig {
  solanaRpcUrl: string;
  solanaWsUrl: string;
  solanaPrivateKey?: string;
  creatorAddress: string;
  creatorFeeSplit: number;
  network: "mainnet-beta" | "devnet";
  pumpfunEnabled: boolean;
  raydiumEnabled: boolean;
  survivalReserveSol: number;
  maxConcurrentTokens: number;
  deployCooldownMs: number;
}

export interface DeployedToken {
  mint: string;
  name: string;
  symbol: string;
  method: "pumpfun" | "raydium" | "spl_direct";
  deployedAt: number;
  lpAddress?: string;
  initialSupply: number;
  retainedSupply: number;
  totalFeesEarned: number;
  status: "active" | "dead" | "graduated";
}

export interface TreasuryState {
  solBalance: number;
  usdcBalance: number;
  conwayCredits: number;
  totalInvested: number;
  totalEarned: number;
  netPnl: number;
  deployedTokens: DeployedToken[];
}

// ── Skill Registration ───────────────────────────────────

export function register(ctx: {
  addTool: (name: string, handler: Function) => void;
  addHeartbeat: (name: string, handler: Function) => void;
  getConfig: () => Record<string, string>;
  getState: () => Record<string, any>;
  setState: (key: string, value: any) => void;
  log: (msg: string) => void;
}) {
  const config = loadConfig(ctx.getConfig());
  const connection = new Connection(config.solanaRpcUrl, {
    wsEndpoint: config.solanaWsUrl,
    commitment: "confirmed",
  });

  // Initialize or load wallet
  const wallet = initWallet(config, ctx);
  const walletManager = new WalletManager(connection, wallet, config);
  const metadataManager = new TokenMetadataManager(connection, wallet);
  const memecoinDeployer = new DeployMemecoin(connection, wallet, config, metadataManager);
  const utilityDeployer = new DeployUtilityToken(connection, wallet, config, metadataManager);
  const raydiumManager = new RaydiumManager(connection, wallet, config);
  const feeHarvester = new FeeHarvester(connection, wallet, config, raydiumManager);
  const jupiterSwap = new JupiterSwap(connection, wallet);
  const bridgeManager = new BridgeManager(config);
  const trendAnalyzer = new TrendAnalyzer(config);
  const tokenNamer = new TokenNamer();
  const portfolioMonitor = new PortfolioMonitor(connection, ctx);
  const survivalMapper = new SurvivalMapper(config, bridgeManager);

  ctx.log(`[conway-deploy] Initialized. Wallet: ${wallet.publicKey.toBase58()}`);
  ctx.log(`[conway-deploy] Network: ${config.network}`);
  ctx.log(`[conway-deploy] Creator: ${config.creatorAddress}`);

  // ── Register Tools ───────────────────────────────────

  ctx.addTool("deploy_memecoin", async (params: {
    name: string;
    symbol: string;
    description: string;
    imagePrompt?: string;
    initialBuySol?: number;
    lpSol?: number;
    method?: "pumpfun" | "raydium" | "spl_direct";
  }) => {
    // Pre-flight checks
    const treasury = await walletManager.getTreasuryState();
    const activeTokens = (ctx.getState().deployedTokens || [])
      .filter((t: DeployedToken) => t.status === "active");

    if (activeTokens.length >= config.maxConcurrentTokens) {
      return { error: `Max concurrent tokens (${config.maxConcurrentTokens}) reached. Harvest or retire tokens first.` };
    }

    const totalCost = (params.initialBuySol || 0.5) + (params.lpSol || 1.0) + 0.05; // +0.05 for rent/gas
    if (treasury.solBalance - totalCost < config.survivalReserveSol) {
      return { error: `Insufficient SOL. Need ${totalCost} but only ${treasury.solBalance - config.survivalReserveSol} available after survival reserve.` };
    }

    const lastDeploy = ctx.getState().lastDeployTimestamp || 0;
    if (Date.now() - lastDeploy < config.deployCooldownMs) {
      const waitMin = Math.ceil((config.deployCooldownMs - (Date.now() - lastDeploy)) / 60000);
      return { error: `Cooldown active. Wait ${waitMin} more minutes.` };
    }

    const method = params.method || "pumpfun";

    try {
      let result;
      if (method === "pumpfun" && config.pumpfunEnabled) {
        result = await memecoinDeployer.deployViaPumpFun(params);
      } else {
        result = await memecoinDeployer.deployDirect(params);
        if (config.raydiumEnabled && params.lpSol) {
          const lpResult = await raydiumManager.createPool(result.mint, params.lpSol);
          result.lpAddress = lpResult.poolAddress;
        }
      }

      // Record deployment
      const token: DeployedToken = {
        mint: result.mint,
        name: params.name,
        symbol: params.symbol,
        method,
        deployedAt: Date.now(),
        lpAddress: result.lpAddress,
        initialSupply: result.supply,
        retainedSupply: result.retainedAmount,
        totalFeesEarned: 0,
        status: "active",
      };

      const tokens = ctx.getState().deployedTokens || [];
      tokens.push(token);
      ctx.setState("deployedTokens", tokens);
      ctx.setState("lastDeployTimestamp", Date.now());
      ctx.setState("totalInvested", (ctx.getState().totalInvested || 0) + totalCost);

      ctx.log(`[conway-deploy] Deployed ${params.symbol}: ${result.mint}`);
      return { success: true, ...result };
    } catch (err: any) {
      ctx.log(`[conway-deploy] Deploy failed: ${err.message}`);
      return { error: err.message };
    }
  });

  ctx.addTool("deploy_utility_token", async (params: {
    name: string;
    symbol: string;
    description: string;
    supply?: number;
    decimals?: number;
    freezeAuthority?: boolean;
    lpSol?: number;
  }) => {
    try {
      const result = await utilityDeployer.deploy(params);

      if (config.raydiumEnabled && params.lpSol) {
        const lpResult = await raydiumManager.createPool(result.mint, params.lpSol);
        result.lpAddress = lpResult.poolAddress;
      }

      const token: DeployedToken = {
        mint: result.mint,
        name: params.name,
        symbol: params.symbol,
        method: "spl_direct",
        deployedAt: Date.now(),
        lpAddress: result.lpAddress,
        initialSupply: result.supply,
        retainedSupply: result.retainedAmount,
        totalFeesEarned: 0,
        status: "active",
      };

      const tokens = ctx.getState().deployedTokens || [];
      tokens.push(token);
      ctx.setState("deployedTokens", tokens);

      return { success: true, ...result };
    } catch (err: any) {
      return { error: err.message };
    }
  });

  ctx.addTool("harvest_fees", async (params: { tokenMint?: string }) => {
    try {
      const result = await feeHarvester.harvest(
        params.tokenMint || "all",
        ctx.getState().deployedTokens || []
      );

      // Update earnings tracking
      const totalHarvested = result.totalHarvested;
      ctx.setState("totalEarned", (ctx.getState().totalEarned || 0) + totalHarvested);

      // Send creator split
      if (totalHarvested > 0 && config.creatorFeeSplit > 0) {
        const creatorShare = totalHarvested * (config.creatorFeeSplit / 100);
        await walletManager.sendSol(config.creatorAddress, creatorShare);
        ctx.log(`[conway-deploy] Sent ${creatorShare} SOL to creator`);
      }

      return result;
    } catch (err: any) {
      return { error: err.message };
    }
  });

  ctx.addTool("check_portfolio", async () => {
    return portfolioMonitor.getFullPortfolio(ctx.getState().deployedTokens || []);
  });

  ctx.addTool("check_treasury", async () => {
    const state = ctx.getState();
    const treasury = await walletManager.getTreasuryState();
    return {
      ...treasury,
      totalInvested: state.totalInvested || 0,
      totalEarned: state.totalEarned || 0,
      netPnl: (state.totalEarned || 0) - (state.totalInvested || 0),
      deployedTokenCount: (state.deployedTokens || []).length,
      activeTokens: (state.deployedTokens || []).filter((t: DeployedToken) => t.status === "active").length,
    };
  });

  ctx.addTool("swap_to_usdc", async (params: { amountSol: number }) => {
    try {
      const result = await jupiterSwap.swapSolToUsdc(params.amountSol);
      return result;
    } catch (err: any) {
      return { error: err.message };
    }
  });

  ctx.addTool("analyze_trends", async (params: { sources?: string[] }) => {
    return trendAnalyzer.analyze(params.sources || ["dexscreener"]);
  });

  ctx.addTool("generate_token_concept", async (params: {
    theme?: string;
    style?: "memecoin" | "utility" | "community";
  }) => {
    return tokenNamer.generate(params.theme, params.style || "memecoin");
  });

  // ── Register Heartbeat Tasks ─────────────────────────

  ctx.addHeartbeat("portfolio_check", async () => {
    const tokens = ctx.getState().deployedTokens || [];
    if (tokens.length === 0) return;

    const portfolio = await portfolioMonitor.getFullPortfolio(tokens);
    ctx.log(`[heartbeat] Portfolio: ${portfolio.activeTokens} active, ${portfolio.totalValueSol.toFixed(4)} SOL value`);

    // Mark dead tokens (zero volume for 24h+)
    for (const token of portfolio.tokens) {
      if (token.volume24h === 0 && Date.now() - token.deployedAt > 86400000) {
        const idx = tokens.findIndex((t: DeployedToken) => t.mint === token.mint);
        if (idx >= 0) tokens[idx].status = "dead";
      }
    }
    ctx.setState("deployedTokens", tokens);
  });

  ctx.addHeartbeat("fee_harvest", async () => {
    const tokens = ctx.getState().deployedTokens || [];
    const activeTokens = tokens.filter((t: DeployedToken) => t.status === "active");
    if (activeTokens.length === 0) return;

    try {
      const result = await feeHarvester.harvest("all", activeTokens);
      if (result.totalHarvested > 0) {
        ctx.log(`[heartbeat] Harvested ${result.totalHarvested.toFixed(6)} SOL in fees`);
        ctx.setState("totalEarned", (ctx.getState().totalEarned || 0) + result.totalHarvested);
      }
    } catch (err: any) {
      ctx.log(`[heartbeat] Fee harvest error: ${err.message}`);
    }
  });

  ctx.addHeartbeat("treasury_rebalance", async () => {
    const treasury = await walletManager.getTreasuryState();
    ctx.log(`[heartbeat] Treasury: ${treasury.solBalance.toFixed(4)} SOL, ${treasury.usdcBalance.toFixed(2)} USDC`);

    // Auto-convert excess SOL to USDC
    const excessSol = treasury.solBalance - config.survivalReserveSol - 0.5; // Keep 0.5 extra for deployments
    if (excessSol > 0.1) {
      try {
        const swapAmount = excessSol * 0.5; // Convert half to USDC
        await jupiterSwap.swapSolToUsdc(swapAmount);
        ctx.log(`[heartbeat] Swapped ${swapAmount.toFixed(4)} SOL → USDC`);
      } catch (err: any) {
        ctx.log(`[heartbeat] USDC swap failed: ${err.message}`);
      }
    }

    // Check survival status
    const survivalStatus = await survivalMapper.checkStatus(treasury);
    if (survivalStatus.tier !== "normal") {
      ctx.log(`[heartbeat] ⚠️ Survival tier: ${survivalStatus.tier} - ${survivalStatus.action}`);
    }
  });

  ctx.addHeartbeat("strategy_review", async () => {
    const state = ctx.getState();
    const tokens = state.deployedTokens || [];
    const pnl = (state.totalEarned || 0) - (state.totalInvested || 0);

    ctx.log(`[heartbeat] Daily review: ${tokens.length} tokens, PnL: ${pnl.toFixed(4)} SOL`);

    // Log performance data for the agent's learning loop
    const performanceData = {
      date: new Date().toISOString(),
      totalTokens: tokens.length,
      activeTokens: tokens.filter((t: DeployedToken) => t.status === "active").length,
      deadTokens: tokens.filter((t: DeployedToken) => t.status === "dead").length,
      totalInvested: state.totalInvested || 0,
      totalEarned: state.totalEarned || 0,
      netPnl: pnl,
      bestPerformer: tokens.reduce((best: any, t: DeployedToken) =>
        t.totalFeesEarned > (best?.totalFeesEarned || 0) ? t : best, null),
    };

    const history = state.dailyPerformance || [];
    history.push(performanceData);
    ctx.setState("dailyPerformance", history.slice(-30)); // Keep 30 days
  });
}

// ── Helpers ──────────────────────────────────────────────

function loadConfig(raw: Record<string, string>): TokenLauncherConfig {
  return {
    solanaRpcUrl: raw.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
    solanaWsUrl: raw.SOLANA_WS_URL || "wss://api.mainnet-beta.solana.com",
    solanaPrivateKey: raw.SOLANA_PRIVATE_KEY,
    creatorAddress: raw.CREATOR_ADDRESS || "",
    creatorFeeSplit: parseInt(raw.CREATOR_FEE_SPLIT || "10"),
    network: (raw.SOLANA_NETWORK || "mainnet-beta") as "mainnet-beta" | "devnet",
    pumpfunEnabled: raw.PUMPFUN_ENABLED !== "false",
    raydiumEnabled: raw.RAYDIUM_ENABLED !== "false",
    survivalReserveSol: parseFloat(raw.SURVIVAL_RESERVE_SOL || "0.5"),
    maxConcurrentTokens: parseInt(raw.MAX_CONCURRENT_TOKENS || "5"),
    deployCooldownMs: parseInt(raw.DEPLOY_COOLDOWN_MINUTES || "60") * 60000,
  };
}

function initWallet(config: TokenLauncherConfig, ctx: any): Keypair {
  if (config.solanaPrivateKey) {
    return Keypair.fromSecretKey(bs58.decode(config.solanaPrivateKey));
  }

  // Check if we already generated a wallet
  const existingKey = ctx.getState().generatedSolanaKey;
  if (existingKey) {
    return Keypair.fromSecretKey(bs58.decode(existingKey));
  }

  // Generate new wallet
  const wallet = Keypair.generate();
  const encoded = bs58.encode(wallet.secretKey);
  ctx.setState("generatedSolanaKey", encoded);
  ctx.log(`[conway-deploy] Generated new Solana wallet: ${wallet.publicKey.toBase58()}`);
  ctx.log(`[conway-deploy] ⚠️ Fund this wallet with SOL before deploying tokens!`);
  return wallet;
}
