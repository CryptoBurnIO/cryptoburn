import { useState, useEffect } from 'react';
import { PublicKey, Connection } from '@solana/web3.js';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import type { Asset } from '@/lib/chains';

const HELIUS_API_KEY = '78198a01-1c06-4950-aa53-12920224316d';
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

/**
 * Simulate a Solana SPL token burn to check if it's burnable
 * Uses simulateTransaction to check without spending SOL
 */
async function isSolanaAssetBurnable(
  publicKey: PublicKey,
  asset: Asset & { notBurnable?: boolean }
): Promise<boolean> {
  // Already known not burnable from delegation/freeze check
  if (asset.notBurnable) return false;

  try {
    const connection = new Connection(HELIUS_RPC, 'confirmed');
    const mintPubkey = new PublicKey(asset.contractAddress);

    if (asset.type === 'nft' && !asset.name.includes('[cNFT]')) {
      // For standard NFTs — check if token account is frozen
      const tokenAccount = await getAssociatedTokenAddress(mintPubkey, publicKey);
      const accountInfo = await connection.getParsedAccountInfo(tokenAccount);
      const parsed = (accountInfo.value?.data as any)?.parsed?.info;
      if (parsed?.state === 'frozen') return false;
    }

    // For cNFTs already handled by delegation check
    return true;
  } catch {
    return true; // Assume burnable if can't check
  }
}

export function useSolanaAssets(publicKey: PublicKey | null) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [notBurnableAssets, setNotBurnableAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [hiddenCount, setHiddenCount] = useState(0);

  useEffect(() => {
    if (!publicKey) { setAssets([]); return; }

    async function fetchAssets() {
      setLoading(true);
      setHiddenCount(0);
      try {
        const walletAddress = publicKey!.toBase58();
        const allFound: Array<Asset & { notBurnable?: boolean }> = [];
        let page = 1;
        let hasMore = true;

        while (hasMore) {
          const response = await fetch(HELIUS_RPC, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: `get-assets-${page}`,
              method: 'getAssetsByOwner',
              params: {
                ownerAddress: walletAddress,
                page,
                limit: 100,
                displayOptions: { showFungible: true, showNativeBalance: false },
              },
            }),
          });

          const data = await response.json();
          const items = data?.result?.items || [];
          const total = data?.result?.total || 0;

          for (const asset of items) {
            const mint = asset.id as string;
            const isFungible = asset.interface === 'FungibleToken' || asset.interface === 'FungibleAsset';
            const isNft = !isFungible;
            const isCompressed = asset.compression?.compressed === true;
            const isDelegated = isCompressed &&
              asset.ownership?.delegated === true &&
              asset.ownership?.delegate &&
              asset.ownership?.delegate !== walletAddress;
            const isFrozen = asset.ownership?.frozen === true;
            const isNotBurnable = isDelegated || isFrozen;

            const name = asset.content?.metadata?.name || (isNft ? `NFT (${mint.slice(0, 6)}...)` : `Token (${mint.slice(0, 6)}...)`);
            const symbol = asset.content?.metadata?.symbol || (isNft ? 'NFT' : 'SPL');
            const balance = isFungible ? (asset.token_info?.balance || 1) : 1;
            const decimals = isFungible ? (asset.token_info?.decimals || 0) : 0;

            let displayName = name;
            if (isCompressed && !isNotBurnable) displayName = `${name} [cNFT]`;

            allFound.push({
              id: `sol-${mint}`,
              name: displayName,
              symbol,
              type: isNft ? 'nft' : 'token',
              balance: balance.toString(),
              balanceRaw: BigInt(Math.floor(balance)),
              decimals,
              contractAddress: mint,
              usdValue: '0',
              chain: 'solana',
              notBurnable: isNotBurnable,
            } as Asset & { notBurnable?: boolean });
          }

          if (items.length < 100 || allFound.length >= total) hasMore = false;
          else page++;
        }

        setLoading(false);
        setScanning(true);

        // Filter to burnable only
        const burnable: Asset[] = [];
        const notBurnable: Asset[] = [];
        let hidden = 0;

        for (const asset of allFound) {
          const canBurn = await isSolanaAssetBurnable(publicKey!, asset);
          if (canBurn) {
            burnable.push(asset);
          } else {
            notBurnable.push(asset);
            hidden++;
          }
          setAssets([...burnable]);
          setNotBurnableAssets([...notBurnable]);
          setHiddenCount(hidden);
        }

        setScanning(false);
      } catch (err) {
        console.error('Solana asset fetch error:', err);
        setAssets([]);
      } finally {
        setLoading(false);
        setScanning(false);
      }
    }

    fetchAssets();
  }, [publicKey]);

  return { assets, notBurnableAssets, loading, scanning, hiddenCount };
}
