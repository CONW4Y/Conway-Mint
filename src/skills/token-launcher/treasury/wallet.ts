/**
 * Wallet Manager
 *
 * Core treasury operations: balance checking, SOL transfers,
 * token account management.
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  getAccount,
} from "@solana/spl-token";
import type { TokenLauncherConfig } from "../index";

const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

export class WalletManager {
  private connection: Connection;
  private wallet: Keypair;
  private config: TokenLauncherConfig;

  constructor(connection: Connection, wallet: Keypair, config: TokenLauncherConfig) {
    this.connection = connection;
    this.wallet = wallet;
    this.config = config;
  }

  async getTreasuryState(): Promise<{
    solBalance: number;
    usdcBalance: number;
    conwayCredits: number;
    walletAddress: string;
  }> {
    // SOL balance
    const lamports = await this.connection.getBalance(this.wallet.publicKey);
    const solBalance = lamports / LAMPORTS_PER_SOL;

    // USDC balance
    let usdcBalance = 0;
    try {
      const usdcAta = await getAssociatedTokenAddress(USDC_MINT, this.wallet.publicKey);
      const account = await getAccount(this.connection, usdcAta);
      usdcBalance = Number(account.amount) / 1_000_000; // USDC has 6 decimals
    } catch {
      // No USDC account yet
    }

    // Conway credits — would be fetched from Conway API
    const conwayCredits = 0; // Placeholder

    return {
      solBalance,
      usdcBalance,
      conwayCredits,
      walletAddress: this.wallet.publicKey.toBase58(),
    };
  }

  async sendSol(to: string, amount: number): Promise<string> {
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: this.wallet.publicKey,
        toPubkey: new PublicKey(to),
        lamports: Math.floor(amount * LAMPORTS_PER_SOL),
      })
    );

    return sendAndConfirmTransaction(this.connection, tx, [this.wallet]);
  }

  async getTokenBalance(mint: string): Promise<number> {
    try {
      const ata = await getAssociatedTokenAddress(
        new PublicKey(mint),
        this.wallet.publicKey
      );
      const account = await getAccount(this.connection, ata);
      return Number(account.amount);
    } catch {
      return 0;
    }
  }
}
