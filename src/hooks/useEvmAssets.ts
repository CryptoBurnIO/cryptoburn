// hooks/useEvmAssets.ts
'use client';
import { useState, useEffect } from 'react';
import type { Asset, ChainKey } from '@/lib/chains';

const MORALIS_CHAIN_IDS: Record<number, string> = {
  1: '0x1',           // Ethereum
  56: '0x38',         // BNB Chain
  137: '0x89',        // Polygon
  43114: '0xa86a',    // Avalanche
  42161: '0xa4b1',    // Arbitrum
  10: '0xa',          // Optimism
  8453: '0x2105',     // Base
  324: '0x144',       // zkSync Era
  59144: '0xe708',    // Linea
  534352: '0x82750',  // Scroll
  1101: '0x44d',      // Polygon zkEVM
  5000: '0x1388',     // Mantle
  81457: '0x13e31',   // Blast
  250: '0xfa',        // Fantom
  25: '0x19',         // Cronos
  100: '0x64',        // Gnosis
  42220: '0xa4ec',    // Celo
  1088: '0x440',      // Metis
  1284: '0x504',      // Moonbeam
  2222: '0x8ae',      // Kava
};

export function useEvmAssets(address: string | undefined, chainId: number | undefined) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address || !chainId) return;
    
    const fetchAssets = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const moralisChain = MORALIS_CHAIN_IDS[chainId] || '0x1';
        const apiKey = process.env.NEXT_PUBLIC_MORALIS_API_KEY;

        if (!apiKey) {
          // Demo mode — show sample assets if no API key configured
          setAssets(getDemoAssets(chainId));
          setLoading(false);
          return;
        }

        // Fetch ERC-20 tokens
        const tokenRes = await fetch(
          `https://deep-index.moralis.io/api/v2.2/${address}/erc20?chain=${moralisChain}`,
          { headers: { 'X-API-Key': apiKey } }
        );
        const tokenData = await tokenRes.json();

        // Fetch NFTs
        const nftRes = await fetch(
          `https://deep-index.moralis.io/api/v2.2/${address}/nft?chain=${moralisChain}&format=decimal&limit=50`,
          { headers: { 'X-API-Key': apiKey } }
        );
        const nftData = await nftRes.json();

        const chainKey = getChainKey(chainId);
        const tokens: Asset[] = (tokenData.result || []).map((t: any) => ({
          id: `${t.token_address}-${chainId}`,
          name: t.name || 'Unknown Token',
          symbol: t.symbol || '???',
          type: 'token' as const,
          balance: (Number(t.balance) / 10 ** (t.decimals || 18)).toFixed(4),
          balanceRaw: BigInt(t.balance || '0'),
          decimals: t.decimals || 18,
          contractAddress: t.token_address,
          usdValue: t.usd_value ? `$${Number(t.usd_value).toFixed(2)}` : '< $0.01',
          logoUrl: t.logo,
          chain: chainKey,
        }));

        const nfts: Asset[] = (nftData.result || []).map((n: any) => ({
          id: `${n.token_address}-${n.token_id}-${chainId}`,
          name: n.name || `NFT #${n.token_id}`,
          symbol: n.symbol || 'NFT',
          type: 'nft' as const,
          balance: '1',
          balanceRaw: BigInt(1),
          decimals: 0,
          contractAddress: n.token_address,
          usdValue: 'Unknown',
          tokenId: n.token_id,
          chain: chainKey,
        }));

        setAssets([...tokens, ...nfts]);
      } catch (err: unknown) {
        const e = err as Error;
        setError(e.message);
        setAssets(getDemoAssets(chainId));
      } finally {
        setLoading(false);
      }
    };

    fetchAssets();
  }, [address, chainId]);

  return { assets, loading, error };
}

function getChainKey(chainId: number): ChainKey {
  const map: Record<number, ChainKey> = {
    1: 'ethereum',
    56: 'bnb',
    137: 'polygon',
    43114: 'avalanche',
    42161: 'arbitrum',
    10: 'optimism',
    8453: 'base',
    324: 'zksync',
    59144: 'linea',
    534352: 'scroll',
    1101: 'polygonzkevm',
    5000: 'mantle',
    81457: 'blast',
    250: 'fantom',
    25: 'cronos',
    100: 'gnosis',
    42220: 'celo',
    1088: 'metis',
    1284: 'moonbeam',
    2222: 'kava',
  };
  return map[chainId] || 'ethereum';
}

// Demo assets shown when no API key is configured
function getDemoAssets(chainId: number): Asset[] {
  const chainKey = getChainKey(chainId);
  return [
    {
      id: 'demo-1',
      name: 'Worthless Token',
      symbol: 'WLSS',
      type: 'token',
      balance: '1,000,000',
      balanceRaw: 1000000000000000000000000n,
      decimals: 18,
      contractAddress: '0x0000000000000000000000000000000000000001',
      usdValue: '< $0.01',
      chain: chainKey,
    },
    {
      id: 'demo-2',
      name: 'Dead Meme Coin',
      symbol: 'DEAD',
      type: 'token',
      balance: '420,690',
      balanceRaw: 420690000000000000000000n,
      decimals: 18,
      contractAddress: '0x0000000000000000000000000000000000000002',
      usdValue: '< $0.01',
      chain: chainKey,
    },
    {
      id: 'demo-3',
      name: 'Rug Pull NFT #9999',
      symbol: 'RUGPULL',
      type: 'nft',
      balance: '1',
      balanceRaw: 1n,
      decimals: 0,
      contractAddress: '0x0000000000000000000000000000000000000003',
      usdValue: 'Floor: 0 ETH',
      tokenId: '9999',
      chain: chainKey,
    },
  ];
}
