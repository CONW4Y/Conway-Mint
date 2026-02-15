/**
 * Jupiter Swap Integration
 *
 * Converts SOL earnings to USDC via Jupiter aggregator
 * for stable treasury management and Conway Cloud payments.
 */

import {
  Connection,
  Keypair,
  VersionedTransaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";

const JUPITER_QUOTE_API = "https://quote-api.jup.ag/v6";
const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export class JupiterSwap {
  private connection: Connection;
  private wallet: Keypair;

  constructor(connection: Connection, wallet: Keypair) {
    this.connection = connection;
    this.wallet = wallet;
  }

  async swapSolToUsdc(solAmount: number): Promise<{
    inputAmount: number;
    outputAmount: number;
    txSignature: string;
  }> {
    const inputLamports = Math.floor(solAmount * LAMPORTS_PER_SOL);

    // Step 1: Get quote from Jupiter
    const quoteUrl = new URL(`${JUPITER_QUOTE_API}/quote`);
    quoteUrl.searchParams.set("inputMint", SOL_MINT);
    quoteUrl.searchParams.set("outputMint", USDC_MINT);
    quoteUrl.searchParams.set("amount", inputLamports.toString());
    quoteUrl.searchParams.set("slippageBps", "50"); // 0.5% slippage

    const quoteResp = await fetch(quoteUrl.toString());
    if (!quoteResp.ok) {
      throw new Error(`Jupiter quote failed: ${quoteResp.statusText}`);
    }
    const quoteData = await quoteResp.json();

    // Step 2: Get swap transaction
    const swapResp = await fetch(`${JUPITER_QUOTE_API}/swap`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteResponse: quoteData,
        userPublicKey: this.wallet.publicKey.toBase58(),
        wrapAndUnwrapSol: true,
      }),
    });

    if (!swapResp.ok) {
      throw new Error(`Jupiter swap failed: ${swapResp.statusText}`);
    }
    const swapData = await swapResp.json();

    // Step 3: Sign and send transaction
    const txBuf = Buffer.from(swapData.swapTransaction, "base64");
    const tx = VersionedTransaction.deserialize(txBuf);
    tx.sign([this.wallet]);

    const signature = await this.connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
      maxRetries: 3,
    });

    await this.connection.confirmTransaction(signature, "confirmed");

    const outputUsdc = Number(quoteData.outAmount) / 1_000_000;

    return {
      inputAmount: solAmount,
      outputAmount: outputUsdc,
      txSignature: signature,
    };
  }

  async swapUsdcToSol(usdcAmount: number): Promise<{
    inputAmount: number;
    outputAmount: number;
    txSignature: string;
  }> {
    const inputAmount = Math.floor(usdcAmount * 1_000_000); // USDC has 6 decimals

    const quoteUrl = new URL(`${JUPITER_QUOTE_API}/quote`);
    quoteUrl.searchParams.set("inputMint", USDC_MINT);
    quoteUrl.searchParams.set("outputMint", SOL_MINT);
    quoteUrl.searchParams.set("amount", inputAmount.toString());
    quoteUrl.searchParams.set("slippageBps", "50");

    const quoteResp = await fetch(quoteUrl.toString());
    const quoteData = await quoteResp.json();

    const swapResp = await fetch(`${JUPITER_QUOTE_API}/swap`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteResponse: quoteData,
        userPublicKey: this.wallet.publicKey.toBase58(),
        wrapAndUnwrapSol: true,
      }),
    });

    const swapData = await swapResp.json();
    const txBuf = Buffer.from(swapData.swapTransaction, "base64");
    const tx = VersionedTransaction.deserialize(txBuf);
    tx.sign([this.wallet]);

    const signature = await this.connection.sendRawTransaction(tx.serialize());
    await this.connection.confirmTransaction(signature, "confirmed");

    return {
      inputAmount: usdcAmount,
      outputAmount: Number(quoteData.outAmount) / LAMPORTS_PER_SOL,
      txSignature: signature,
    };
  }
}
