// lib/burnEvm.ts
import { parseAbi, parseEther, type Address, type WalletClient } from 'viem';
import { EVM_BURN_ADDRESS } from './chains';
import { FEE_RECIPIENT } from './fees';
import type { Asset } from './chains';

const ERC20_ABI = parseAbi([
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
]);

const ERC721_ABI = parseAbi([
  'function transferFrom(address from, address to, uint256 tokenId)',
  'function safeTransferFrom(address from, address to, uint256 tokenId)',
  'function ownerOf(uint256 tokenId) view returns (address)',
]);

const ERC1155_ABI = parseAbi([
  'function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)',
  'function balanceOf(address account, uint256 id) view returns (uint256)',
]);

export interface BurnResult {
  success: boolean;
  txHash?: string;
  explorerUrl?: string;
  error?: string;
}

// Native token approximate rates for fee conversion
const NATIVE_RATES: Record<number, number> = {
  1: 3000, 8453: 3000, 42161: 3000, 10: 3000,
  59144: 3000, 534352: 3000, 1101: 3000, 81457: 3000, 324: 3000,
  137: 0.40, 56: 600, 43114: 35, 250: 0.60,
  25: 0.10, 100: 1, 42220: 0.80, 1088: 1.50,
  1284: 0.15, 2222: 0.50, 5000: 1.20,
};

/**
 * Send ONE fee transaction for the entire batch.
 * Returns true if fee was paid, false if user cancelled.
 * Called once before any burns happen.
 */
export async function sendFeeOnce(
  walletClient: WalletClient,
  feeUsd: number
): Promise<boolean> {
  if (feeUsd <= 0) return true;
  try {
    const [account] = await walletClient.getAddresses();
    const chainId = await walletClient.getChainId();
    const rate = NATIVE_RATES[chainId] || 3000;
    const feeInNative = feeUsd / rate;
    const feeWei = parseEther(Math.max(feeInNative, 0.000001).toFixed(18));

    await walletClient.sendTransaction({
      account,
      to: FEE_RECIPIENT as Address,
      value: feeWei,
      chain: null,
    });

    return true;
  } catch {
    // User cancelled or transaction failed — return false to abort all burns
    return false;
  }
}

/**
 * Burn an ERC-20 token. No fee collected here — fee handled by sendFeeOnce.
 */
export async function burnERC20Token(
  walletClient: WalletClient,
  asset: Asset,
  explorerBase: string
): Promise<BurnResult> {
  try {
    const [account] = await walletClient.getAddresses();
    const txHash = await walletClient.writeContract({
      address: asset.contractAddress as Address,
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [EVM_BURN_ADDRESS as Address, asset.balanceRaw],
      account,
      chain: null,
    });
    return { success: true, txHash, explorerUrl: `${explorerBase}/tx/${txHash}` };
  } catch (err: unknown) {
    const error = err as Error;
    return { success: false, error: error.message || 'Transaction failed' };
  }
}

/**
 * Burn an ERC-721 NFT. No fee collected here — fee handled by sendFeeOnce.
 */
export async function burnERC721NFT(
  walletClient: WalletClient,
  asset: Asset,
  explorerBase: string
): Promise<BurnResult> {
  try {
    const [account] = await walletClient.getAddresses();
    const txHash = await walletClient.writeContract({
      address: asset.contractAddress as Address,
      abi: ERC721_ABI,
      functionName: 'transferFrom',
      args: [account, EVM_BURN_ADDRESS as Address, BigInt(asset.tokenId || '0')],
      account,
      chain: null,
    });
    return { success: true, txHash, explorerUrl: `${explorerBase}/tx/${txHash}` };
  } catch (err: unknown) {
    const error = err as Error;
    return { success: false, error: error.message || 'Transaction failed' };
  }
}

/**
 * Burn an ERC-1155 token. No fee collected here — fee handled by sendFeeOnce.
 */
export async function burnERC1155(
  walletClient: WalletClient,
  asset: Asset,
  explorerBase: string
): Promise<BurnResult> {
  try {
    const [account] = await walletClient.getAddresses();
    const txHash = await walletClient.writeContract({
      address: asset.contractAddress as Address,
      abi: ERC1155_ABI,
      functionName: 'safeTransferFrom',
      args: [
        account,
        EVM_BURN_ADDRESS as Address,
        BigInt(asset.tokenId || '0'),
        asset.balanceRaw,
        '0x',
      ],
      account,
      chain: null,
    });
    return { success: true, txHash, explorerUrl: `${explorerBase}/tx/${txHash}` };
  } catch (err: unknown) {
    const error = err as Error;
    return { success: false, error: error.message || 'Transaction failed' };
  }
}

/**
 * Route burn to correct function. Fee already collected before this is called.
 */
export async function burnAsset(
  walletClient: WalletClient,
  asset: Asset,
  explorerBase: string
): Promise<BurnResult> {
  if (asset.type === 'nft') {
    return burnERC721NFT(walletClient, asset, explorerBase);
  }
  return burnERC20Token(walletClient, asset, explorerBase);
}
