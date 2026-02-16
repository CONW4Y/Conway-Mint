/**
 * Utility Token Deployer
 *
 * Deploys tokens with configurable parameters for utility use cases:
 * - Custom supply and decimals
 * - Optional freeze authority (for compliance tokens)
 * - Proper metadata for wallets and explorers
 */

import {
  Connection,
  Keypair,
  PublicKey,
} from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  setAuthority,
  AuthorityType,
} from "@solana/spl-token";
import { TokenMetadataManager } from "./metadata";
import type { TokenLauncherConfig } from "../index";

export class DeployUtilityToken {
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

  async deploy(params: {
    name: string;
    symbol: string;
    description: string;
    supply?: number;
    decimals?: number;
    freezeAuthority?: boolean;
    lpSol?: number;
  }): Promise<{
    mint: string;
    supply: number;
    retainedAmount: number;
    lpAddress?: string;
    txSignature: string;
  }> {
    const decimals = params.decimals || 9;
    const totalSupply = params.supply || 1_000_000_000;
    const retentionPercent = 5;
    const retainedAmount = Math.floor(totalSupply * (retentionPercent / 100));

    // Create mint with optional freeze authority
    const mintKeypair = Keypair.generate();
    const freezeAuth = params.freezeAuthority ? this.wallet.publicKey : null;

    const mint = await createMint(
      this.connection,
      this.wallet,
      this.wallet.publicKey, // mint authority
      freezeAuth,
      decimals,
      mintKeypair
    );

    // Create agent's token account
    const agentAta = await getOrCreateAssociatedTokenAccount(
      this.connection,
      this.wallet,
      mint,
      this.wallet.publicKey
    );

    // Mint full supply
    const rawAmount = BigInt(totalSupply) * BigInt(10 ** decimals);
    await mintTo(
      this.connection,
      this.wallet,
      mint,
      agentAta.address,
      this.wallet,
      rawAmount
    );

    // Upload and create metadata
    const metadataUri = await this.metadata.uploadMetadata({
      name: params.name,
      symbol: params.symbol,
      description: params.description,
    });

    await this.metadata.createOnChainMetadata(
      mint,
      params.name,
      params.symbol,
      metadataUri
    );

    // Revoke mint authority — fixed supply
    await setAuthority(
      this.connection,
      this.wallet,
      mint,
      this.wallet,
      AuthorityType.MintTokens,
      null
    );

    return {
      mint: mint.toBase58(),
      supply: totalSupply,
      retainedAmount,
      txSignature: mintKeypair.publicKey.toBase58(),
    };
  }
}
