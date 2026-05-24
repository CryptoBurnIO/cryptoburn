// lib/burnEvm.ts
import { parseAbi, parseEther, type Address, type WalletClient, type PublicClient, erc20Abi } from 'viem';
import { EVM_BURN_ADDRESS } from './chains';
import { FEE_RECIPIENT } from './fees';
import type { Asset } from './chains';

const ERC20_ABI = parseAbi([
  'function transfer(address to, uint256 amount) returns (bool)',
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
 * Send ONE fee transaction and wait for confirmed receipt.
 */
export async function sendFeeOnce(
  walletClient: WalletClient,
  publicClient: PublicClient,
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

    // Wait for confirmed receipt and check status
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 30_000 });
    return receipt.status === 'success';
  } catch {
    return false;
  }
}

/**
 * Burn an ERC-20 token. Waits for confirmed receipt before returning success.
 */
export async function burnERC20Token(
  walletClient: WalletClient,
  publicClient: PublicClient,
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

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 30_000 });
    if (receipt.status !== 'success') {
      return { success: false, error: 'Transaction failed on chain — token may not be burnable' };
    }

    // Verify balance is now zero — catches reflection tokens that intercept transfers
    try {
      const newBalance = await publicClient.readContract({
        address: asset.contractAddress as Address,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [account],
      });
      if (newBalance > BigInt(0)) {
        return { success: false, error: 'Token contract intercepted the transfer — this token cannot be burned (reflection/fee-on-transfer contract)' };
      }
    } catch {
      // If balance check fails, trust the receipt
    }

    return { success: true, txHash, explorerUrl: `${explorerBase}/tx/${txHash}` };
  } catch (err: unknown) {
    const error = err as Error;
    if (isUserRejection(error.message || '')) return { success: false, error: 'User rejected the request.' };
    if (error.message?.includes('timed out') || error.message?.includes('timeout') || error.message?.includes('Timed out')) return { success: false, error: 'Transaction cancelled or did not confirm in time.' };
    return { success: false, error: error.message || 'Transaction failed' };
  }
}

/**
 * Burn an ERC-721 NFT. Waits for confirmed receipt before returning success.
 */
export async function burnERC721NFT(
  walletClient: WalletClient,
  publicClient: PublicClient,
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

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 30_000 });
    if (receipt.status !== 'success') {
      return { success: false, error: 'Transaction failed on chain — NFT may not be burnable' };
    }

    // Verify NFT ownership changed — confirm it's no longer owned by user
    try {
      const ERC721_OWNER_ABI = parseAbi(['function ownerOf(uint256 tokenId) view returns (address)']);
      const newOwner = await publicClient.readContract({
        address: asset.contractAddress as Address,
        abi: ERC721_OWNER_ABI,
        functionName: 'ownerOf',
        args: [BigInt(asset.tokenId || '0')],
      }) as Address;
      if (newOwner.toLowerCase() === account.toLowerCase()) {
        return { success: false, error: 'NFT contract intercepted the transfer — this NFT cannot be burned' };
      }
    } catch {
      // ownerOf throws if token is burned (no longer exists) — that means it worked!
    }

    return { success: true, txHash, explorerUrl: `${explorerBase}/tx/${txHash}` };
  } catch (err: unknown) {
    const error = err as Error;
    if (isUserRejection(error.message || '')) return { success: false, error: 'User rejected the request.' };
    if (error.message?.includes('timed out') || error.message?.includes('timeout') || error.message?.includes('Timed out')) return { success: false, error: 'Transaction cancelled or did not confirm in time.' };
    return { success: false, error: error.message || 'Transaction failed' };
  }
}

/**
 * Burn an ERC-1155 token. Waits for confirmed receipt before returning success.
 */
export async function burnERC1155(
  walletClient: WalletClient,
  publicClient: PublicClient,
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

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 30_000 });
    if (receipt.status !== 'success') {
      return { success: false, error: 'Transaction failed on chain' };
    }

    return { success: true, txHash, explorerUrl: `${explorerBase}/tx/${txHash}` };
  } catch (err: unknown) {
    const error = err as Error;
    if (isUserRejection(error.message || '')) return { success: false, error: 'User rejected the request.' };
    if (error.message?.includes('timed out') || error.message?.includes('timeout') || error.message?.includes('Timed out')) return { success: false, error: 'Transaction cancelled or did not confirm in time.' };
    return { success: false, error: error.message || 'Transaction failed' };
  }
}

/**
 * Route burn to correct function.
 */
export async function burnAsset(
  walletClient: WalletClient,
  publicClient: PublicClient,
  asset: Asset,
  explorerBase: string
): Promise<BurnResult> {
  if (asset.type === 'nft') {
    return burnERC721NFT(walletClient, publicClient, asset, explorerBase);
  }
  return burnERC20Token(walletClient, publicClient, asset, explorerBase);
}
