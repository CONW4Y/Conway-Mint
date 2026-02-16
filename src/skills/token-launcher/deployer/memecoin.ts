/**
 * Memecoin Deployer
 *
 * Handles token deployment via:
 * 1. pump.fun - Bonding curve launch with creator fees
 * 2. Direct SPL - Mint token + Raydium LP for more control
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { TokenMetadataManager } from "./metadata";
import type { TokenLauncherConfig } from "../index";

export interface DeployResult {
  mint: string;
  supply: number;
  retainedAmount: number;
  lpAddress?: string;
  txSignature: string;
  method: string;
}

export class DeployMemecoin {
  private connection: Connection;
  private wallet: Keypair;
  private config: TokenLauncherConfig;
  private metadata: TokenMetadataManager;

  constructor(
    connection: Connection,
    wallet: Keypair,
    config: TokenLauncherConfig,
    metadata: TokenMetadataManager
  ) {
    this.connection = connection;
    this.wallet = wallet;
    this.config = config;
    this.metadata = metadata;
  }

  /**
   * Deploy via pump.fun bonding curve
   *
   * pump.fun handles:
   * - Token creation with bonding curve pricing
   * - Automatic liquidity when market cap threshold is hit
   * - Creator earns 0.5% of all trading volume
   */
  async deployViaPumpFun(params: {
    name: string;
    symbol: string;
    description: string;
    imagePrompt?: string;
    initialBuySol?: number;
  }): Promise<DeployResult> {
    const initialBuy = params.initialBuySol || 0.5;

    // pump.fun uses a specific program for token creation
    // The token is created with a bonding curve that graduates to Raydium
    // when market cap hits ~$69k

    // Step 1: Generate the token keypair (pump.fun requires the creator to provide this)
    const mintKeypair = Keypair.generate();

    // Step 2: Upload metadata (pump.fun expects IPFS or Arweave URI)
    const metadataUri = await this.metadata.uploadMetadata({
      name: params.name,
      symbol: params.symbol,
      description: params.description,
      imagePrompt: params.imagePrompt,
    });

    // Step 3: Create the pump.fun launch transaction
    // pump.fun program ID on Solana mainnet
    const PUMP_FUN_PROGRAM = new PublicKey(
      "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"
    );

    // Build the create + initial buy instruction
    // Note: pump.fun's exact instruction layout may change — this follows their
    // current IDL pattern. The agent should verify against latest docs.
    const createIx = await this.buildPumpFunCreateInstruction(
      mintKeypair,
      params.name,
      params.symbol,
      metadataUri,
      PUMP_FUN_PROGRAM
    );

    const buyIx = await this.buildPumpFunBuyInstruction(
      mintKeypair.publicKey,
      initialBuy,
      PUMP_FUN_PROGRAM
    );

    const tx = new Transaction().add(createIx).add(buyIx);
    tx.feePayer = this.wallet.publicKey;

    const { blockhash } = await this.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;

    const signature = await sendAndConfirmTransaction(
      this.connection,
      tx,
      [this.wallet, mintKeypair],
      { commitment: "confirmed" }
    );

    return {
      mint: mintKeypair.publicKey.toBase58(),
      supply: 1_000_000_000, // pump.fun default is 1B
      retainedAmount: 0, // On pump.fun, you buy from the curve instead
      txSignature: signature,
      method: "pumpfun",
    };
  }

  /**
   * Deploy directly as SPL token with full control
   *
   * You control:
   * - Total supply and distribution
   * - Metadata and branding
   * - Liquidity pool setup (done separately via Raydium)
   * - Retained supply percentage
   */
  async deployDirect(params: {
    name: string;
    symbol: string;
    description: string;
    imagePrompt?: string;
    lpSol?: number;
  }): Promise<DeployResult> {
    const decimals = 9;
    const totalSupply = 1_000_000_000; // 1 billion
    const retentionPercent = 5; // Keep 5% of supply
    const retainedAmount = Math.floor(totalSupply * (retentionPercent / 100));
    const lpAmount = totalSupply - retainedAmount;

    // Step 1: Create the mint
    const mintKeypair = Keypair.generate();
    const mint = await createMint(
      this.connection,
      this.wallet,
      this.wallet.publicKey, // Mint authority
      null, // No freeze authority (trust signal)
      decimals,
      mintKeypair
    );

    // Step 2: Create token account for the agent
    const agentTokenAccount = await getOrCreateAssociatedTokenAccount(
      this.connection,
      this.wallet,
      mint,
      this.wallet.publicKey
    );

    // Step 3: Mint total supply to agent
    const mintAmount = BigInt(totalSupply) * BigInt(10 ** decimals);
    await mintTo(
      this.connection,
      this.wallet,
      mint,
      agentTokenAccount.address,
      this.wallet,
      mintAmount
    );

    // Step 4: Upload and attach metadata
    const metadataUri = await this.metadata.uploadMetadata({
      name: params.name,
      symbol: params.symbol,
      description: params.description,
      imagePrompt: params.imagePrompt,
    });

    await this.metadata.createOnChainMetadata(
      mint,
      params.name,
      params.symbol,
      metadataUri
    );

    // Step 5: Revoke mint authority (no more tokens can ever be created)
    // This is a strong trust signal for traders
    await this.revokeMintAuthority(mint);

    return {
      mint: mint.toBase58(),
      supply: totalSupply,
      retainedAmount,
      txSignature: mintKeypair.publicKey.toBase58(), // Use mint as reference
      method: "spl_direct",
    };
  }

  // ── Private Helpers ────────────────────────────────────

  private async buildPumpFunCreateInstruction(
    mintKeypair: Keypair,
    name: string,
    symbol: string,
    metadataUri: string,
    programId: PublicKey
  ) {
    // This constructs the pump.fun "create" instruction
    // The exact discriminator and account layout follows pump.fun's IDL
    // In production, use their SDK or the anchor IDL directly

    // Simplified — the actual implementation needs the full IDL
    // The automaton's self-modification capability means it can update
    // this code if the pump.fun program changes

    const data = Buffer.alloc(256);
    // Write instruction discriminator for "create"
    data.write("create", 0);

    return {
      keys: [
        { pubkey: mintKeypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      programId,
      data,
    };
  }

  private async buildPumpFunBuyInstruction(
    mint: PublicKey,
    solAmount: number,
    programId: PublicKey
  ) {
    const lamports = Math.floor(solAmount * LAMPORTS_PER_SOL);
    const data = Buffer.alloc(64);
    data.write("buy", 0);
    data.writeBigUInt64LE(BigInt(lamports), 8);

    return {
      keys: [
        { pubkey: mint, isSigner: false, isWritable: true },
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
      ],
      programId,
      data,
    };
  }

  private async revokeMintAuthority(mint: PublicKey) {
    const { setAuthority, AuthorityType } = await import("@solana/spl-token");
    await setAuthority(
      this.connection,
      this.wallet,
      mint,
      this.wallet,
      AuthorityType.MintTokens,
      null // Setting to null revokes permanently
    );
  }
}
