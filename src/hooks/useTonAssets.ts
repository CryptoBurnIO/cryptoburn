import { useState, useEffect } from 'react';
import type { Asset } from '@/lib/chains';

export function useTonAssets(walletAddress: string | null) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!walletAddress) { setAssets([]); return; }

    async function fetchAssets() {
      setLoading(true);
      try {
        const found: Asset[] = [];

        // Fetch Jettons (TON tokens)
        const jettonsRes = await fetch(
          `https://tonapi.io/v2/accounts/${walletAddress}/jettons?currencies=usd`
        );
        if (jettonsRes.ok) {
          const jettonsData = await jettonsRes.json();
          for (const jetton of jettonsData?.balances || []) {
            const balance = jetton.balance || '0';
            if (balance === '0') continue;
            const decimals = jetton.jetton?.decimals || 9;
            const uiBalance = Number(BigInt(balance)) / Math.pow(10, decimals);
            found.push({
              id: `ton-jetton-${jetton.jetton?.address}`,
              name: jetton.jetton?.name || `Jetton (${jetton.jetton?.address?.slice(0, 6)}...)`,
              symbol: jetton.jetton?.symbol || 'JETTON',
              type: 'token',
              balance: uiBalance.toString(),
              balanceRaw: BigInt(balance),
              decimals,
              contractAddress: jetton.wallet_address?.address || jetton.jetton?.address,
              usdValue: jetton.price?.prices?.USD ? (uiBalance * jetton.price.prices.USD).toFixed(2) : '0',
              chain: 'ton',
            });
          }
        }

        // Fetch NFTs
        const nftsRes = await fetch(
          `https://tonapi.io/v2/accounts/${walletAddress}/nfts?limit=100&offset=0&indirect_ownership=false`
        );
        if (nftsRes.ok) {
          const nftsData = await nftsRes.json();
          for (const nft of nftsData?.nft_items || []) {
            found.push({
              id: `ton-nft-${nft.address}`,
              name: nft.metadata?.name || `NFT (${nft.address?.slice(0, 6)}...)`,
              symbol: 'NFT',
              type: 'nft',
              balance: '1',
              balanceRaw: BigInt(1),
              decimals: 0,
              contractAddress: nft.address,
              usdValue: '0',
              chain: 'ton',
            });
          }
        }

        setAssets(found);
      } catch (err) {
        console.error('TON asset fetch error:', err);
        setAssets([]);
      } finally {
        setLoading(false);
      }
    }

    fetchAssets();
  }, [walletAddress]);

  return { assets, loading };
}
