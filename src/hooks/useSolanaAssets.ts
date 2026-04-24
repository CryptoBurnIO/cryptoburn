import { useState, useEffect } from 'react';
import { PublicKey } from '@solana/web3.js';
import type { Asset } from '@/lib/chains';

const HELIUS_API_KEY = '78198a01-1c06-4950-aa53-12920224316d';
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

export function useSolanaAssets(publicKey: PublicKey | null) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!publicKey) { setAssets([]); return; }

    async function fetchAssets() {
      setLoading(true);
      try {
        const walletAddress = publicKey!.toBase58();
        const found: Asset[] = [];
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
            
            // Detect delegated cNFTs — these cannot be burned by the owner
            const isDelegated = isCompressed && 
              asset.ownership?.delegated === true &&
              asset.ownership?.delegate &&
              asset.ownership?.delegate !== walletAddress;

            const name = asset.content?.metadata?.name || (isNft ? `NFT (${mint.slice(0, 6)}...)` : `Token (${mint.slice(0, 6)}...)`);
            const symbol = asset.content?.metadata?.symbol || (isNft ? 'NFT' : 'SPL');
            const balance = isFungible ? (asset.token_info?.balance || 1) : 1;
            const decimals = isFungible ? (asset.token_info?.decimals || 0) : 0;

            // Label delegated cNFTs clearly
            let displayName = name;
            if (isCompressed && !isDelegated) displayName = `${name} [cNFT]`;
            if (isDelegated) displayName = `${name} [delegated — not burnable]`;

            found.push({
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
              // Store delegation status for filtering
              notBurnable: isDelegated,
            } as Asset & { notBurnable?: boolean });
          }

          if (items.length < 100 || found.length >= total) hasMore = false;
          else page++;
        }

        setAssets(found);
      } catch (err) {
        console.error('Solana asset fetch error:', err);
        setAssets([]);
      } finally {
        setLoading(false);
      }
    }

    fetchAssets();
  }, [publicKey]);

  return { assets, loading };
}
