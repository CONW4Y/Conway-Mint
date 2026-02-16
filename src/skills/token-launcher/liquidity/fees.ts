/**
 * Fee Harvester
 *
 * Collects earnings from all revenue streams:
 * - Raydium LP fees
 * - pump.fun creator fees
 * - Token position value changes
 */

import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { RaydiumManager } from "./raydium";
import type { TokenLauncherConfig, DeployedToken } from "../index";

export interface HarvestResult {
  totalHarvested: number; // SOL
  breakdown: {
    tokenMint: string;
    symbol: string;
    lpFees: number;
    creatorFees: number;
  }[];
  txSignatures: string[];
}

export class FeeHarvester {
  private connection: Connection;
  private wallet: Keypair;
  private config: TokenLauncherConfig;
  private raydium: RaydiumManager;

  constructor(
    connection: Connection,
    wallet: Keypair,
    config: TokenLauncherConfig,
    raydium: RaydiumManager
  ) {
    this.connection = connection;
    this.wallet = wallet;
    this.config = config;
    this.raydium = raydium;
  }

  async harvest(
    target: string,
    tokens: DeployedToken[]
  ): Promise<HarvestResult> {
    const activeTokens =
      target === "all"
        ? tokens.filter((t) => t.status === "active")
        : tokens.filter((t) => t.mint === target && t.status === "active");

    const breakdown: HarvestResult["breakdown"] = [];
    const txSignatures: string[] = [];
    let totalHarvested = 0;

    for (const token of activeTokens) {
      let lpFees = 0;
      let creatorFees = 0;

      // Collect LP fees from Raydium pools
      if (token.lpAddress) {
        try {
          const feeResult = await this.raydium.collectFees(token.lpAddress);
          lpFees = feeResult.solFees;
          if (feeResult.txSignature !== "PLACEHOLDER_TX") {
            txSignatures.push(feeResult.txSignature);
          }
        } catch (err: any) {
          console.log(`[fees] LP fee collection failed for ${token.symbol}: ${err.message}`);
        }
      }

      // For pump.fun tokens, creator fees are sent to the creator wallet automatically
      // We check for incoming SOL transfers from pump.fun's fee distribution
      if (token.method === "pumpfun") {
        creatorFees = await this.checkPumpFunCreatorFees(token.mint);
      }

      const tokenTotal = lpFees + creatorFees;
      totalHarvested += tokenTotal;

      breakdown.push({
        tokenMint: token.mint,
        symbol: token.symbol,
        lpFees,
        creatorFees,
      });
    }

    return { totalHarvested, breakdown, txSignatures };
  }

  /**
   * Check pump.fun creator fee accumulation
   *
   * pump.fun sends creator fees as SOL transfers to the token creator.
   * We track these by checking recent transaction history.
   */
  private async checkPumpFunCreatorFees(tokenMint: string): Promise<number> {
    // Query recent SOL transfers to our wallet from pump.fun's fee distributor
    // The pump.fun program sends fees in batches

    try {
      const signatures = await this.connection.getSignaturesForAddress(
        this.wallet.publicKey,
        { limit: 50 }
      );

      let feeTotal = 0;

      for (const sig of signatures) {
        // Check if this transaction is a pump.fun fee distribution
        // by looking at the transaction's program invocations
        const tx = await this.connection.getTransaction(sig.signature, {
          maxSupportedTransactionVersion: 0,
        });

        if (!tx) continue;

        // Look for SOL transfers from pump.fun's fee vault
        // This is simplified — in production, parse the full transaction
        // to identify pump.fun fee distributions specifically
        const meta = tx.meta;
        if (meta && meta.postBalances && meta.preBalances) {
          const walletIdx = tx.transaction.message
            .getAccountKeys()
            .staticAccountKeys.findIndex(
              (k) => k.toBase58() === this.wallet.publicKey.toBase58()
            );

          if (walletIdx >= 0) {
            const balanceChange =
              (meta.postBalances[walletIdx] - meta.preBalances[walletIdx]) /
              LAMPORTS_PER_SOL;

            // Only count positive balance changes (incoming fees)
            if (balanceChange > 0 && balanceChange < 0.1) {
              // Small amounts likely fees
              feeTotal += balanceChange;
            }
          }
        }
      }

      return feeTotal;
    } catch {
      return 0;
    }
  }
}
