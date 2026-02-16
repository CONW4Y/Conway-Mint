/**
 * Token Metadata Manager
 *
 * Handles:
 * - Off-chain metadata (JSON + image) upload to Arweave/IPFS
 * - On-chain Metaplex metadata creation
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

// Metaplex Token Metadata Program
const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

export interface MetadataParams {
  name: string;
  symbol: string;
  description: string;
  imagePrompt?: string;
  imageUrl?: string;
}

export class TokenMetadataManager {
  private connection: Connection;
  private wallet: Keypair;

  constructor(connection: Connection, wallet: Keypair) {
    this.connection = connection;
    this.wallet = wallet;
  }

  /**
   * Upload off-chain metadata JSON
   *
   * Returns a URI pointing to the metadata JSON (Arweave or IPFS)
   * The metadata follows the Metaplex standard:
   * {
   *   name, symbol, description, image,
   *   attributes: [], properties: { files: [] }
   * }
   */
  async uploadMetadata(params: MetadataParams): Promise<string> {
    // Option 1: Use Irys (formerly Bundlr) for Arweave uploads
    // Option 2: Use nft.storage or Pinata for IPFS
    // Option 3: Use a simple hosting endpoint

    const metadata = {
      name: params.name,
      symbol: params.symbol,
      description: params.description,
      image: params.imageUrl || "", // Will be populated after image upload
      external_url: "",
      attributes: [
        { trait_type: "Creator", value: "Conway Deploy" },
        { trait_type: "Type", value: "Community Token" },
        { trait_type: "Deployed", value: new Date().toISOString() },
      ],
      properties: {
        files: [],
        category: "currency",
        creators: [
          {
            address: this.wallet.publicKey.toBase58(),
            share: 100,
          },
        ],
      },
    };

    // For production: Upload to Arweave via Irys
    // const irys = new Irys({ url: "https://node1.irys.xyz", token: "solana", key: this.wallet.secretKey });
    // const receipt = await irys.upload(JSON.stringify(metadata), { tags: [{ name: "Content-Type", value: "application/json" }] });
    // return `https://arweave.net/${receipt.id}`;

    // For development/MVP: Use a simple approach
    // The automaton can self-modify to use Irys once it has funds
    const metadataJson = JSON.stringify(metadata);

    // Placeholder — in production this uploads to permanent storage
    // The automaton's self-modification system will upgrade this
    console.log(`[metadata] Prepared metadata for ${params.name} (${params.symbol})`);

    // Return a data URI for now, upgrade to Arweave in production
    return `data:application/json;base64,${Buffer.from(metadataJson).toString("base64")}`;
  }

  /**
   * Create on-chain Metaplex metadata for a token
   *
   * This makes the token show up with name/symbol/image in wallets
   * like Phantom, Solflare, etc.
   */
  async createOnChainMetadata(
    mint: PublicKey,
    name: string,
    symbol: string,
    uri: string
  ): Promise<string> {
    // Derive the metadata PDA
    const [metadataPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mint.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );

    // Build the CreateMetadataAccountV3 instruction
    // Uses the Metaplex Token Metadata program
    const data = this.serializeCreateMetadataV3({
      name: name.substring(0, 32), // Max 32 chars
      symbol: symbol.substring(0, 10), // Max 10 chars
      uri: uri.substring(0, 200), // Max 200 chars
      sellerFeeBasisPoints: 0, // No royalties on transfers
      creators: [
        {
          address: this.wallet.publicKey,
          verified: true,
          share: 100,
        },
      ],
      collection: null,
      uses: null,
    });

    const ix = {
      keys: [
        { pubkey: metadataPda, isSigner: false, isWritable: true },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true }, // mint authority
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true }, // payer
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: false }, // update authority
        {
          pubkey: new PublicKey("11111111111111111111111111111111"),
          isSigner: false,
          isWritable: false,
        }, // System program
        {
          pubkey: new PublicKey("SysvarRent111111111111111111111111111111111"),
          isSigner: false,
          isWritable: false,
        },
      ],
      programId: TOKEN_METADATA_PROGRAM_ID,
      data,
    };

    const tx = new Transaction().add(ix);
    const sig = await sendAndConfirmTransaction(this.connection, tx, [this.wallet]);

    return sig;
  }

  private serializeCreateMetadataV3(args: {
    name: string;
    symbol: string;
    uri: string;
    sellerFeeBasisPoints: number;
    creators: { address: PublicKey; verified: boolean; share: number }[] | null;
    collection: null;
    uses: null;
  }): Buffer {
    // CreateMetadataAccountV3 discriminator = 33
    // This is a simplified serialization — in production use @metaplex-foundation/mpl-token-metadata
    const buffers: Buffer[] = [];

    // Instruction discriminator
    buffers.push(Buffer.from([33]));

    // Data: name (string)
    const nameBytes = Buffer.from(args.name);
    const nameLenBuf = Buffer.alloc(4);
    nameLenBuf.writeUInt32LE(nameBytes.length);
    buffers.push(nameLenBuf, nameBytes);

    // Data: symbol (string)
    const symbolBytes = Buffer.from(args.symbol);
    const symbolLenBuf = Buffer.alloc(4);
    symbolLenBuf.writeUInt32LE(symbolBytes.length);
    buffers.push(symbolLenBuf, symbolBytes);

    // Data: uri (string)
    const uriBytes = Buffer.from(args.uri);
    const uriLenBuf = Buffer.alloc(4);
    uriLenBuf.writeUInt32LE(uriBytes.length);
    buffers.push(uriLenBuf, uriBytes);

    // Seller fee basis points
    const feeBuf = Buffer.alloc(2);
    feeBuf.writeUInt16LE(args.sellerFeeBasisPoints);
    buffers.push(feeBuf);

    // Creators (Option<Vec<Creator>>)
    if (args.creators) {
      buffers.push(Buffer.from([1])); // Some
      const countBuf = Buffer.alloc(4);
      countBuf.writeUInt32LE(args.creators.length);
      buffers.push(countBuf);
      for (const c of args.creators) {
        buffers.push(c.address.toBuffer());
        buffers.push(Buffer.from([c.verified ? 1 : 0]));
        buffers.push(Buffer.from([c.share]));
      }
    } else {
      buffers.push(Buffer.from([0])); // None
    }

    // Collection: None
    buffers.push(Buffer.from([0]));
    // Uses: None
    buffers.push(Buffer.from([0]));
    // isMutable
    buffers.push(Buffer.from([1])); // true — can update metadata later
    // collectionDetails: None
    buffers.push(Buffer.from([0]));

    return Buffer.concat(buffers);
  }
}
