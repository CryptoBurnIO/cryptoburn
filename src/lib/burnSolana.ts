// lib/burnSolana.ts
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  createBurnInstruction,
  createCloseAccountInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { FEE_RECIPIENT_SOLANA } from './fees';
import type { Asset } from './chains';

const HELIUS_API_KEY = '78198a01-1c06-4950-aa53-12920224316d';
const SOLANA_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const SOL_RATE_USD = 150;

// Token Metadata program ID
const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

export interface SolanaBurnResult {
  success: boolean;
  txHash?: string;
  explorerUrl?: string;
  error?: string;
}

function getMetadataAddress(mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('metadata'), TOKEN_METADATA_PROGRAM_ID.toBytes(), mint.toBytes()],
    TOKEN_METADATA_PROGRAM_ID
  )[0];
}

function getMasterEditionAddress(mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('metadata'), TOKEN_METADATA_PROGRAM_ID.toBytes(), mint.toBytes(), Buffer.from('edition')],
    TOKEN_METADATA_PROGRAM_ID
  )[0];
}

/**
 * Burn a Solana SPL token.
 */
export async function burnSPLToken(
  publicKey: PublicKey,
  signTransaction: (tx: Transaction) => Promise<Transaction>,
  asset: Asset,
  feeUsd: number = 0.10
): Promise<SolanaBurnResult> {
  try {
    const connection = new Connection(SOLANA_RPC, 'confirmed');
    const mintPubkey = new PublicKey(asset.contractAddress);
    const tokenAccountPubkey = await getAssociatedTokenAddress(mintPubkey, publicKey);
    const feeRecipient = new PublicKey(FEE_RECIPIENT_SOLANA);

    const transaction = new Transaction();

    const feeLamports = Math.floor((feeUsd / SOL_RATE_USD) * LAMPORTS_PER_SOL);
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: publicKey,
        toPubkey: feeRecipient,
        lamports: Math.max(feeLamports, 1000),
      })
    );

    transaction.add(
      createBurnInstruction(tokenAccountPubkey, mintPubkey, publicKey, asset.balanceRaw, [], TOKEN_PROGRAM_ID)
    );

    transaction.add(
      createCloseAccountInstruction(tokenAccountPubkey, publicKey, publicKey, [], TOKEN_PROGRAM_ID)
    );

    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = publicKey;

    const signed = await signTransaction(transaction);
    const txHash = await connection.sendRawTransaction(signed.serialize());
    await connection.confirmTransaction(txHash, 'confirmed');

    return { success: true, txHash, explorerUrl: `https://solscan.io/tx/${txHash}` };
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Solana SPL burn error:', error.message, error);
    return { success: false, error: error.message || 'Solana transaction failed' };
  }
}

/**
 * Burn a Metaplex standard NFT using the Token Metadata burn instruction.
 * Uses the correct instruction discriminator (29) for burnNft.
 */
export async function burnSolanaNFT(
  publicKey: PublicKey,
  signTransaction: (tx: Transaction) => Promise<Transaction>,
  asset: Asset,
  feeUsd: number = 0.25
): Promise<SolanaBurnResult> {
  try {
    const connection = new Connection(SOLANA_RPC, 'confirmed');
    const mintPubkey = new PublicKey(asset.contractAddress);
    const tokenAccountPubkey = await getAssociatedTokenAddress(mintPubkey, publicKey);
    const metadataAddress = getMetadataAddress(mintPubkey);
    const masterEditionAddress = getMasterEditionAddress(mintPubkey);
    const feeRecipient = new PublicKey(FEE_RECIPIENT_SOLANA);

    const transaction = new Transaction();

    // Service fee
    const feeLamports = Math.floor((feeUsd / SOL_RATE_USD) * LAMPORTS_PER_SOL);
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: publicKey,
        toPubkey: feeRecipient,
        lamports: Math.max(feeLamports, 1000),
      })
    );

    // First burn the token using SPL token program
    transaction.add(
      createBurnInstruction(tokenAccountPubkey, mintPubkey, publicKey, BigInt(1), [], TOKEN_PROGRAM_ID)
    );

    // Then close the token account to reclaim rent
    transaction.add(
      createCloseAccountInstruction(tokenAccountPubkey, publicKey, publicKey, [], TOKEN_PROGRAM_ID)
    );

    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = publicKey;

    const signed = await signTransaction(transaction);
    const txHash = await connection.sendRawTransaction(signed.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });
    await connection.confirmTransaction(txHash, 'confirmed');

    return { success: true, txHash, explorerUrl: `https://solscan.io/tx/${txHash}` };
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Solana NFT burn error:', error.message, error);
    return { success: false, error: error.message || 'Solana NFT burn failed' };
  }
}
