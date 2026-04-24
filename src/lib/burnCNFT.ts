// lib/burnCNFT.ts
// Burns compressed NFTs (cNFTs) using direct Bubblegum program instructions
// Avoids UMI SDK which causes "undefined program id" errors in Next.js

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  AccountMeta,
} from '@solana/web3.js';
import { FEE_RECIPIENT_SOLANA } from './fees';

const HELIUS_API_KEY = '78198a01-1c06-4950-aa53-12920224316d';
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const SOL_RATE_USD = 150;

// Bubblegum program ID
const BUBBLEGUM_PROGRAM_ID = new PublicKey('BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY');
// SPL Account Compression program
const SPL_ACCOUNT_COMPRESSION_PROGRAM_ID = new PublicKey('cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK');
// Noop program
const SPL_NOOP_PROGRAM_ID = new PublicKey('noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV');

// Bubblegum burn instruction discriminator
const BURN_DISCRIMINATOR = Buffer.from([116, 110, 29, 56, 107, 219, 42, 93]);

export interface CNFTBurnResult {
  success: boolean;
  txHash?: string;
  explorerUrl?: string;
  error?: string;
}

async function getAssetProof(mintAddress: string) {
  const response = await fetch(HELIUS_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'get-asset-proof',
      method: 'getAssetProof',
      params: { id: mintAddress },
    }),
  });
  const data = await response.json();
  return data?.result;
}

async function getAsset(mintAddress: string) {
  const response = await fetch(HELIUS_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'get-asset',
      method: 'getAsset',
      params: { id: mintAddress },
    }),
  });
  const data = await response.json();
  return data?.result;
}

function decodeBase58(str: string): Uint8Array {
  const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let bytes = [0];
  for (const char of str) {
    let carry = ALPHABET.indexOf(char);
    if (carry < 0) throw new Error('Invalid base58 character');
    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  // Add leading zeros
  for (const char of str) {
    if (char === '1') bytes.push(0);
    else break;
  }
  return new Uint8Array(bytes.reverse());
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

    // Step 2: Get asset and proof from Helius
    const [asset, proof] = await Promise.all([
      getAsset(mintAddress),
      getAssetProof(mintAddress),
    ]);

    if (!asset || !proof) {
      return { success: false, error: 'Could not fetch asset data from Helius' };
    }

    const treeId = proof.tree_id;
    const treeAuthority = PublicKey.findProgramAddressSync(
      [new PublicKey(treeId).toBytes()],
      BUBBLEGUM_PROGRAM_ID
    )[0];

    // Step 3: Build proof accounts
    const proofAccounts: AccountMeta[] = (proof.proof || []).map((p: string) => ({
      pubkey: new PublicKey(p),
      isSigner: false,
      isWritable: false,
    }));

    // Step 4: Encode burn instruction data
    // burn(root, dataHash, creatorHash, nonce, index)
    const rootBytes = Buffer.from(proof.root, 'base58').length > 0
      ? new PublicKey(proof.root).toBytes()
      : Buffer.from(proof.root, 'base64');

    const dataHashBytes = asset.compression?.data_hash
      ? new PublicKey(asset.compression.data_hash).toBytes()
      : Buffer.alloc(32);

    const creatorHashBytes = asset.compression?.creator_hash
      ? new PublicKey(asset.compression.creator_hash).toBytes()
      : Buffer.alloc(32);

    const nonce = BigInt(asset.compression?.leaf_id || 0);
    const index = asset.compression?.leaf_id || 0;

    // Pack instruction data
    const data = Buffer.alloc(8 + 32 + 32 + 32 + 8 + 4);
    let offset = 0;
    BURN_DISCRIMINATOR.copy(data, offset); offset += 8;
    Buffer.from(rootBytes).copy(data, offset); offset += 32;
    Buffer.from(dataHashBytes).copy(data, offset); offset += 32;
    Buffer.from(creatorHashBytes).copy(data, offset); offset += 32;
    data.writeBigUInt64LE(nonce, offset); offset += 8;
    data.writeUInt32LE(index, offset);

    // Step 5: Build burn instruction
    const burnInstruction = new TransactionInstruction({
      programId: BUBBLEGUM_PROGRAM_ID,
      keys: [
        { pubkey: treeAuthority, isSigner: false, isWritable: false },
        { pubkey: publicKey, isSigner: true, isWritable: false }, // leafOwner
        { pubkey: publicKey, isSigner: true, isWritable: false }, // leafDelegate
        { pubkey: new PublicKey(treeId), isSigner: false, isWritable: true },
        { pubkey: SPL_NOOP_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID, isSigner: false, isWritable: false },
        ...proofAccounts,
      ],
      data,
    });

    // Step 6: Send transaction
    const { blockhash } = await connection.getLatestBlockhash();
    const tx = new Transaction();
    tx.add(burnInstruction);
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
