// lib/burnCNFT.ts
// Burns compressed NFTs using Bubblegum program with correct Helius DAS proof handling

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  AccountMeta,
} from '@solana/web3.js';
import bs58 from 'bs58';
import { FEE_RECIPIENT_SOLANA } from './fees';

const HELIUS_API_KEY = '78198a01-1c06-4950-aa53-12920224316d';
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const SOL_RATE_USD = 150;

const BUBBLEGUM_PROGRAM_ID = new PublicKey('BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY');
const SPL_ACCOUNT_COMPRESSION_PROGRAM_ID = new PublicKey('cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK');
const SPL_NOOP_PROGRAM_ID = new PublicKey('noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV');

// Bubblegum burn instruction discriminator (anchor 8-byte prefix for "burn")
const BURN_DISCRIMINATOR = Buffer.from([116, 110, 29, 56, 107, 219, 42, 93]);

export interface CNFTBurnResult {
  success: boolean;
  txHash?: string;
  explorerUrl?: string;
  error?: string;
}

function bufferToArray(buffer: Buffer): number[] {
  const nums: number[] = [];
  for (let i = 0; i < buffer.length; i++) {
    nums.push(buffer[i]);
  }
  return nums;
}

async function getBubblegumAuthorityPDA(treeAddress: PublicKey): Promise<PublicKey> {
  const [authority] = PublicKey.findProgramAddressSync(
    [treeAddress.toBytes()],
    BUBBLEGUM_PROGRAM_ID
  );
  return authority;
}

export async function burnCompressedNFT(
  publicKey: PublicKey,
  signTransaction: (tx: Transaction) => Promise<Transaction>,
  mintAddress: string,
  feeUsd: number = 0.25
): Promise<CNFTBurnResult> {
  try {
    const connection = new Connection(HELIUS_RPC, 'confirmed');

    // Step 1: Collect service fee
    if (feeUsd > 0) {
      const feeLamports = Math.floor((feeUsd / SOL_RATE_USD) * LAMPORTS_PER_SOL);
      const feeTx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(FEE_RECIPIENT_SOLANA),
          lamports: Math.max(feeLamports, 1000),
        })
      );
      const { blockhash: feeBlockhash } = await connection.getLatestBlockhash();
      feeTx.recentBlockhash = feeBlockhash;
      feeTx.feePayer = publicKey;
      const signedFeeTx = await signTransaction(feeTx);
      await connection.sendRawTransaction(signedFeeTx.serialize());
    }

    // Step 2: Get asset proof from Helius DAS
    const proofResponse = await fetch(HELIUS_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'get-asset-proof',
        method: 'getAssetProof',
        params: { id: mintAddress },
      }),
    });
    const proofData = await proofResponse.json();
    const assetProof = proofData?.result;
    if (!assetProof) return { success: false, error: 'Could not fetch asset proof' };

    // Step 3: Get asset details from Helius DAS
    const assetResponse = await fetch(HELIUS_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'get-asset',
        method: 'getAsset',
        params: { id: mintAddress },
      }),
    });
    const assetData = await assetResponse.json();
    const asset = assetData?.result;
    if (!asset) return { success: false, error: 'Could not fetch asset details' };

    // Step 4: Build proof path (remaining accounts)
    const proofPath: AccountMeta[] = (assetProof.proof || []).map((node: string) => ({
      pubkey: new PublicKey(node),
      isSigner: false,
      isWritable: false,
    }));

    // Step 5: Decode hashes using bs58 (same as Helius examples)
    const rootArray = bufferToArray(Buffer.from(bs58.decode(assetProof.root)));
    const dataHashArray = bufferToArray(Buffer.from(bs58.decode(asset.compression.data_hash.trim())));
    const creatorHashArray = bufferToArray(Buffer.from(bs58.decode(asset.compression.creator_hash.trim())));
    const leafNonce = asset.compression.leaf_id;

    // Step 6: Get tree authority PDA
    const treeAuthority = await getBubblegumAuthorityPDA(new PublicKey(assetProof.tree_id));

    // Step 7: Get leaf delegate (owner if no delegate)
    const leafDelegate = asset.ownership.delegate
      ? new PublicKey(asset.ownership.delegate)
      : new PublicKey(asset.ownership.owner);

    // Step 8: Build burn instruction data
    // Layout: discriminator(8) + root(32) + dataHash(32) + creatorHash(32) + nonce(8) + index(4)
    const data = Buffer.alloc(8 + 32 + 32 + 32 + 8 + 4);
    let offset = 0;
    BURN_DISCRIMINATOR.copy(data, offset); offset += 8;
    Buffer.from(rootArray).copy(data, offset); offset += 32;
    Buffer.from(dataHashArray).copy(data, offset); offset += 32;
    Buffer.from(creatorHashArray).copy(data, offset); offset += 32;
    data.writeBigUInt64LE(BigInt(leafNonce), offset); offset += 8;
    data.writeUInt32LE(leafNonce, offset);

    // Step 9: Build burn instruction
    // leafDelegate is a signer when it equals the owner (most common case)
    const isDelegated = asset.ownership.delegate && 
      asset.ownership.delegate !== asset.ownership.owner;
    
    const burnIx = new TransactionInstruction({
      programId: BUBBLEGUM_PROGRAM_ID,
      keys: [
        { pubkey: treeAuthority, isSigner: false, isWritable: false },
        { pubkey: new PublicKey(asset.ownership.owner), isSigner: true, isWritable: false },
        { pubkey: leafDelegate, isSigner: !isDelegated, isWritable: false },
        { pubkey: new PublicKey(assetProof.tree_id), isSigner: false, isWritable: true },
        { pubkey: SPL_NOOP_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID, isSigner: false, isWritable: false },
        ...proofPath,
      ],
      data,
    });

    // Step 10: Send burn transaction
    const { blockhash } = await connection.getLatestBlockhash();
    const tx = new Transaction();
    tx.add(burnIx);
    tx.recentBlockhash = blockhash;
    tx.feePayer = publicKey;

    const signed = await signTransaction(tx);
    const txHash = await connection.sendRawTransaction(signed.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    await connection.confirmTransaction(txHash, 'confirmed');

    return {
      success: true,
      txHash,
      explorerUrl: `https://solscan.io/tx/${txHash}`,
    };

  } catch (err: unknown) {
    const error = err as Error;
    return { success: false, error: error.message || 'cNFT burn failed' };
  }
}
