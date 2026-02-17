/**
 * Survival Mapper
 *
 * Maps the automaton's Solana-based earnings to Conway Cloud's
 * survival tier system. This is the critical link between
 * "earning on Solana" and "staying alive on Conway."
 */

import { BridgeManager } from "../treasury/bridge";
import type { TokenLauncherConfig } from "../index";

export interface SurvivalStatus {
  tier: "normal" | "low_compute" | "critical" | "dead";
  conwayCredits: number;
  estimatedRunwayHours: number;
  solBalance: number;
  usdcBalance: number;
  action: string;
}

// Estimated Conway Cloud costs (per hour)
const CONWAY_COST_PER_HOUR_NORMAL = 0.5; // $0.50/hr for frontier model
const CONWAY_COST_PER_HOUR_LOW = 0.1; // $0.10/hr for cheap model
const CONWAY_COST_PER_HOUR_CRITICAL = 0.02; // $0.02/hr minimal inference

export class SurvivalMapper {
  private config: TokenLauncherConfig;
  private bridge: BridgeManager;

  constructor(config: TokenLauncherConfig, bridge: BridgeManager) {
    this.config = config;
    this.bridge = bridge;
  }

  async checkStatus(treasury: {
    solBalance: number;
    usdcBalance: number;
    conwayCredits: number;
  }): Promise<SurvivalStatus> {
    const credits = treasury.conwayCredits;

    // Calculate total available value in USD
    // SOL price would need to be fetched — using rough estimate
    const totalUsdValue =
      treasury.usdcBalance + credits; // + treasury.solBalance * SOL_PRICE

    // Determine tier
    let tier: SurvivalStatus["tier"];
    let action: string;
    let costPerHour: number;

    if (credits > 24 * CONWAY_COST_PER_HOUR_NORMAL) {
      tier = "normal";
      action = "Operating normally. Continue deploying tokens.";
      costPerHour = CONWAY_COST_PER_HOUR_NORMAL;
    } else if (credits > 12 * CONWAY_COST_PER_HOUR_LOW) {
      tier = "low_compute";
      action = "Low credits. Switch to cheaper model. Prioritize fee harvesting.";
      costPerHour = CONWAY_COST_PER_HOUR_LOW;
    } else if (credits > 0) {
      tier = "critical";
      action = "CRITICAL. Harvest all fees immediately. Bridge USDC to Base. Stop new deployments.";
      costPerHour = CONWAY_COST_PER_HOUR_CRITICAL;
    } else {
      tier = "dead";
      action = "No credits remaining. Agent will stop.";
      costPerHour = 0;
    }

    const estimatedRunwayHours =
      costPerHour > 0 ? credits / costPerHour : 0;

    // Auto-bridge if we have USDC on Solana but low Conway credits
    if (
      (tier === "low_compute" || tier === "critical") &&
      treasury.usdcBalance > 1
    ) {
      const bridgeAmount = Math.min(treasury.usdcBalance * 0.8, 50);
      try {
        await this.bridge.bridgeUsdcToBase(bridgeAmount);
        await this.bridge.topUpConwayCredits(bridgeAmount);
        action += ` Auto-bridging ${bridgeAmount} USDC to Conway.`;
      } catch (err: any) {
        action += ` Bridge attempt failed: ${err.message}`;
      }
    }

    return {
      tier,
      conwayCredits: credits,
      estimatedRunwayHours: Math.round(estimatedRunwayHours * 10) / 10,
      solBalance: treasury.solBalance,
      usdcBalance: treasury.usdcBalance,
      action,
    };
  }
}
