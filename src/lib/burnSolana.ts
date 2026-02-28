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

export interface SolanaBurnResult {
  success: boolean;
  txHash?: string;
  explorerUrl?: string;
  error?: string;
}

const SOLANA_RPC = 'https://api.mainnet-beta.solana.com';
// SOL approximate rate for fee conversion
const SOL_RATE_USD = 150;

/**
 * Burn a Solana SPL token.
 * Collects service fee in SOL, burns tokens, closes account to reclaim rent.
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

    // Fee in lamports
    const feeLamports = Math.floor((feeUsd / SOL_RATE_USD) * LAMPORTS_PER_SOL);

    // Service fee transfer to CryptoBurn wallet
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: publicKey,
        toPubkey: feeRecipient,
        lamports: Math.max(feeLamports, 1000), // minimum 1000 lamports
      })
    );

    // Burn instruction
    transaction.add(
      createBurnInstruction(
        tokenAccountPubkey,
        mintPubkey,
        publicKey,
        asset.balanceRaw,
        [],
        TOKEN_PROGRAM_ID
      )
    );

    // Close token account — reclaims rent SOL back to user
    transaction.add(
      createCloseAccountInstruction(
        tokenAccountPubkey,
        publicKey,
        publicKey,
        [],
        TOKEN_PROGRAM_ID
      )
    );

    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = publicKey;

    const signed = await signTransaction(transaction);
    const txHash = await connection.sendRawTransaction(signed.serialize());
    await connection.confirmTransaction(txHash, 'confirmed');

    return {
      success: true,
      txHash,
      explorerUrl: `https://solscan.io/tx/${txHash}`,
    };
  } catch (err: unknown) {
    const error = err as Error;
    return { success: false, error: error.message || 'Solana transaction failed' };
  }
}

/**
 * Burn a Solana NFT (Metaplex standard)
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

    // Burn NFT (amount = 1)
    transaction.add(
      createBurnInstruction(
        tokenAccountPubkey,
        mintPubkey,
        publicKey,
        BigInt(1),
        [],
        TOKEN_PROGRAM_ID
      )
    );

    // Close token account, reclaim rent
    transaction.add(
      createCloseAccountInstruction(
        tokenAccountPubkey,
        publicKey,
        publicKey,
        [],
        TOKEN_PROGRAM_ID
      )
    );

    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = publicKey;

    const signed = await signTransaction(transaction);
    const txHash = await connection.sendRawTransaction(signed.serialize());
    await connection.confirmTransaction(txHash, 'confirmed');

    return {
      success: true,
      txHash,
      explorerUrl: `https://solscan.io/tx/${txHash}`,
    };
  } catch (err: unknown) {
    const error = err as Error;
    return { success: false, error: error.message || 'Solana NFT burn failed' };
  }
}
