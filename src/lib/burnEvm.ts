// lib/burnEvm.ts
import { parseAbi, parseEther, type Address, type WalletClient, createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';
import { EVM_BURN_ADDRESS } from './chains';
import { FEE_RECIPIENT } from './fees';
import type { Asset } from './chains';

const ERC20_ABI = parseAbi([
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
]);

const ERC721_ABI = parseAbi([
  'function transferFrom(address from, address to, uint256 tokenId)',
]);

const ERC1155_ABI = parseAbi([
  'function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)',
]);

export interface BurnResult {
  success: boolean;
  txHash?: string;
  explorerUrl?: string;
  error?: string;
}

const NATIVE_RATES: Record<number, number> = {
  1: 3000, 8453: 3000, 42161: 3000, 10: 3000,
  59144: 3000, 534352: 3000, 1101: 3000, 81457: 3000, 324: 3000,
  137: 0.40, 56: 600, 43114: 35, 250: 0.60,
  25: 0.10, 100: 1, 42220: 0.80, 1088: 1.50,
  1284: 0.15, 2222: 0.50, 5000: 1.20,
};

function isUserRejection(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes('user rejected') ||
    lower.includes('user denied') ||
    lower.includes('rejected the request') ||
    lower.includes('transaction was rejected') ||
    lower.includes('cancelled');
}

/**
 * Wait for transaction receipt and check status
 * Returns true if transaction succeeded, false if it failed or reverted
 */
async function waitForReceipt(walletClient: WalletClient, txHash: string): Promise<boolean> {
  try {
    // Poll for receipt using eth_getTransactionReceipt via the transport
    const transport = walletClient.transport;
    
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      try {
        const receipt = await transport.request({
          method: 'eth_getTransactionReceipt',
          params: [txHash],
        }) as any;
        if (receipt) {
          return receipt.status === '0x1';
        }
      } catch {
        // Continue polling
      }
    }
    return true; // Assume success after timeout
  } catch {
    return true;
  }
}

/**
 * Send ONE fee transaction for the entire batch.
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

    const txHash = await walletClient.sendTransaction({
      account,
      to: FEE_RECIPIENT as Address,
      value: feeWei,
      chain: null,
    });

    if (!txHash) return false;
    const success = await waitForReceipt(walletClient, txHash);
    return success;
  } catch (err: unknown) {
    return false;
  }
}

/**
 * Burn an ERC-20 token.
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

    if (!txHash) return { success: false, error: 'No transaction hash returned' };

    const confirmed = await waitForReceipt(walletClient, txHash);
    if (!confirmed) return { success: false, error: 'Transaction failed on chain — asset may not be transferable' };

    return { success: true, txHash, explorerUrl: `${explorerBase}/tx/${txHash}` };
  } catch (err: unknown) {
    const error = err as Error;
    if (isUserRejection(error.message || '')) return { success: false, error: 'User rejected the request.' };
    return { success: false, error: error.message || 'Transaction failed' };
  }
}

/**
 * Burn an ERC-721 NFT.
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

    if (!txHash) return { success: false, error: 'No transaction hash returned' };

    const confirmed = await waitForReceipt(walletClient, txHash);
    if (!confirmed) return { success: false, error: 'Transaction failed on chain — NFT may not be transferable' };

    return { success: true, txHash, explorerUrl: `${explorerBase}/tx/${txHash}` };
  } catch (err: unknown) {
    const error = err as Error;
    if (isUserRejection(error.message || '')) return { success: false, error: 'User rejected the request.' };
    return { success: false, error: error.message || 'Transaction failed' };
  }
}

/**
 * Burn an ERC-1155 token.
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
      args: [account, EVM_BURN_ADDRESS as Address, BigInt(asset.tokenId || '0'), asset.balanceRaw, '0x'],
      account,
      chain: null,
    });

    if (!txHash) return { success: false, error: 'No transaction hash returned' };

    const confirmed = await waitForReceipt(walletClient, txHash);
    if (!confirmed) return { success: false, error: 'Transaction failed on chain' };

    return { success: true, txHash, explorerUrl: `${explorerBase}/tx/${txHash}` };
  } catch (err: unknown) {
    const error = err as Error;
    if (isUserRejection(error.message || '')) return { success: false, error: 'User rejected the request.' };
    return { success: false, error: error.message || 'Transaction failed' };
  }
}

/**
 * Route burn to correct function.
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
