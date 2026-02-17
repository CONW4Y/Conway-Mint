/**
 * Portfolio Monitor
 *
 * Tracks all deployed tokens and their performance metrics.
 */

import { Connection, PublicKey } from "@solana/web3.js";
import type { DeployedToken } from "../index";

export interface PortfolioSummary {
  totalTokens: number;
  activeTokens: number;
  deadTokens: number;
  totalValueSol: number;
  totalFeesEarned: number;
  tokens: TokenPerformance[];
}

export interface TokenPerformance {
  mint: string;
  symbol: string;
  name: string;
  status: string;
  deployedAt: number;
  ageHours: number;
  price: number;
  volume24h: number;
  holders: number;
  feesEarned: number;
  retainedValue: number;
}

export class PortfolioMonitor {
  private connection: Connection;
  private ctx: any;

  constructor(connection: Connection, ctx: any) {
    this.connection = connection;
    this.ctx = ctx;
  }

  async getFullPortfolio(tokens: DeployedToken[]): Promise<PortfolioSummary> {
    const performances: TokenPerformance[] = [];
    let totalValueSol = 0;
    let totalFees = 0;

    for (const token of tokens) {
      const perf = await this.getTokenPerformance(token);
      performances.push(perf);
      totalValueSol += perf.retainedValue;
      totalFees += perf.feesEarned;
    }

    return {
      totalTokens: tokens.length,
      activeTokens: tokens.filter((t) => t.status === "active").length,
      deadTokens: tokens.filter((t) => t.status === "dead").length,
      totalValueSol,
      totalFeesEarned: totalFees,
      tokens: performances,
    };
  }

  private async getTokenPerformance(
    token: DeployedToken
  ): Promise<TokenPerformance> {
    const ageHours = (Date.now() - token.deployedAt) / (1000 * 60 * 60);

    // Get on-chain data
    let price = 0;
    let holders = 0;

    try {
      // Get token supply and largest accounts to estimate holders
      const mint = new PublicKey(token.mint);
      const supply = await this.connection.getTokenSupply(mint);
      const largestAccounts = await this.connection.getTokenLargestAccounts(mint);
      holders = largestAccounts.value.length;

      // Price estimation from DexScreener
      try {
        const resp = await fetch(
          `https://api.dexscreener.com/latest/dex/tokens/${token.mint}`
        );
        const data = await resp.json();
        const pair = data?.pairs?.[0];
        if (pair) {
          price = parseFloat(pair.priceUsd) || 0;
        }
      } catch {
        // DexScreener rate limit or token not found
      }
    } catch {
      // Token might not exist yet on-chain
    }

    return {
      mint: token.mint,
      symbol: token.symbol,
      name: token.name,
      status: token.status,
      deployedAt: token.deployedAt,
      ageHours: Math.round(ageHours * 10) / 10,
      price,
      volume24h: 0, // Would come from DexScreener
      holders,
      feesEarned: token.totalFeesEarned,
      retainedValue: 0, // retained tokens * price
    };
  }
}
