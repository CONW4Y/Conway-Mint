/**
 * Chain Configuration
 *
 * Network settings for Solana mainnet and devnet.
 */

export const CHAINS = {
  "mainnet-beta": {
    rpcUrl: "https://api.mainnet-beta.solana.com",
    wsUrl: "wss://api.mainnet-beta.solana.com",
    explorerUrl: "https://solscan.io",
    usdcMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    wsolMint: "So11111111111111111111111111111111111111112",
    jupiterApi: "https://quote-api.jup.ag/v6",
    raydiumAmmV4: "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
    raydiumClmm: "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK",
    pumpFunProgram: "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",
    metaplexMetadata: "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s",
    dexScreenerApi: "https://api.dexscreener.com",
  },
  devnet: {
    rpcUrl: "https://api.devnet.solana.com",
    wsUrl: "wss://api.devnet.solana.com",
    explorerUrl: "https://solscan.io/?cluster=devnet",
    usdcMint: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU", // Devnet USDC
    wsolMint: "So11111111111111111111111111111111111111112",
    jupiterApi: "https://quote-api.jup.ag/v6", // Jupiter works on devnet too
    raydiumAmmV4: "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
    raydiumClmm: "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK",
    pumpFunProgram: "", // pump.fun is mainnet only
    metaplexMetadata: "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s",
    dexScreenerApi: "https://api.dexscreener.com",
  },
} as const;

export type ChainId = keyof typeof CHAINS;
