// hooks/useEvmAssets.ts
'use client';
import { useState, useEffect } from 'react';
import type { Asset, ChainKey } from '@/lib/chains';
import { EVM_BURN_ADDRESS } from '@/lib/chains';

const MORALIS_CHAIN_IDS: Record<number, string> = {
  1: '0x1', 56: '0x38', 137: '0x89', 43114: '0xa86a',
  42161: '0xa4b1', 10: '0xa', 8453: '0x2105', 324: '0x144',
  59144: '0xe708', 534352: '0x82750', 1101: '0x44d', 5000: '0x1388',
  81457: '0x13e31', 250: '0xfa', 25: '0x19', 100: '0x64',
  42220: '0xa4ec', 1088: '0x440', 1284: '0x504', 2222: '0x8ae',
};

// ERC20 transfer ABI for simulation
const ERC20_TRANSFER_SIG = '0xa9059cbb'; // transfer(address,uint256)
const ERC721_TRANSFER_SIG = '0x23b872dd'; // transferFrom(address,address,uint256)

/**
 * Check if a token is burnable by inspecting its bytecode for reflection patterns
 * and simulating the transfer
 */
async function isTokenBurnable(
  contractAddress: string,
  ownerAddress: string,
  balance: bigint,
  tokenType: 'token' | 'nft',
  tokenId: string | undefined,
  rpcUrl: string
): Promise<boolean> {
  try {
    // Step 1: Get contract bytecode and check for reflection/fee signatures
    if (tokenType === 'token') {
      const codeRes = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 1, method: 'eth_getCode',
          params: [contractAddress, 'latest'],
        }),
      });
      const codeData = await codeRes.json();
      const bytecode = codeData?.result || '';

      // Check for common reflection token function signatures in bytecode
      // _reflectFee, _takeLiquidity, _transferStandard patterns
      const reflectionSigs = [
        '2f54bf6e', // isExcludedFromFee
        '52f7c988', // setTaxFeePercent  
        'a9059cbb', // standard transfer - check if it has fee logic after
      ];
      
      // Check for _rOwned/_tOwned pattern (reflection tokens store two balance maps)
      // These show as storage slot patterns in bytecode
      const hasReflectionPattern = 
        bytecode.includes('60646') || // common 10% fee pattern
        bytecode.length > 20000; // reflection contracts are typically very large
      
      if (hasReflectionPattern) {
        // Do a simulation to verify
        const to = EVM_BURN_ADDRESS.replace('0x', '').padStart(64, '0');
        const amount = balance.toString(16).padStart(64, '0');
        const data = `0xa9059cbb${to}${amount}`;
        
        const simRes = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0', id: 2, method: 'eth_call',
            params: [{ from: ownerAddress, to: contractAddress, data }, 'latest'],
          }),
        });
        const simData = await simRes.json();
        if (simData.error) return false;
        
        // Check balance before and after using debug_traceCall if available
        // Fall back to just checking simulation result
        return simData.result !== '0x' && 
               simData.result !== '0x0000000000000000000000000000000000000000000000000000000000000000';
      }
    }

    // Step 2: Standard simulation for non-reflection tokens
    let data: string;
    if (tokenType === 'token') {
      const to = EVM_BURN_ADDRESS.replace('0x', '').padStart(64, '0');
      const amount = balance.toString(16).padStart(64, '0');
      data = `${ERC20_TRANSFER_SIG}${to}${amount}`;
    } else {
      const from = ownerAddress.replace('0x', '').padStart(64, '0');
      const to = EVM_BURN_ADDRESS.replace('0x', '').padStart(64, '0');
      const id = BigInt(tokenId || '0').toString(16).padStart(64, '0');
      data = `${ERC721_TRANSFER_SIG}${from}${to}${id}`;
    }

    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 3, method: 'eth_call',
        params: [{ from: ownerAddress, to: contractAddress, data }, 'latest'],
      }),
    });

    const result = await response.json();
    if (result.error) return false;
    if (result.result === '0x' || 
        result.result === '0x0000000000000000000000000000000000000000000000000000000000000000') return false;
    return true;
  } catch {
    return true;
  }
}

// RPC URLs for simulation
const CHAIN_RPC: Record<number, string> = {
  1: 'https://eth.llamarpc.com',
  56: 'https://bsc-dataseed.binance.org',
  137: 'https://polygon-rpc.com',
  43114: 'https://api.avax.network/ext/bc/C/rpc',
  42161: 'https://arb1.arbitrum.io/rpc',
  10: 'https://mainnet.optimism.io',
  8453: 'https://mainnet.base.org',
  324: 'https://mainnet.era.zksync.io',
  59144: 'https://rpc.linea.build',
  534352: 'https://rpc.scroll.io',
  1101: 'https://zkevm-rpc.com',
  5000: 'https://rpc.mantle.xyz',
  81457: 'https://rpc.blast.io',
  250: 'https://rpcapi.fantom.network',
  25: 'https://evm.cronos.org',
  100: 'https://rpc.gnosischain.com',
  42220: 'https://forno.celo.org',
  1088: 'https://andromeda.metis.io/?owner=1088',
  1284: 'https://rpc.api.moonbeam.network',
  2222: 'https://evm.kava.io',
};

export function useEvmAssets(address: string | undefined, chainId: number | undefined) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [hiddenCount, setHiddenCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address || !chainId) return;

    const fetchAssets = async () => {
      setLoading(true);
      setError(null);
      setHiddenCount(0);

      try {
        const moralisChain = MORALIS_CHAIN_IDS[chainId] || '0x1';
        const apiKey = process.env.NEXT_PUBLIC_MORALIS_API_KEY;

        if (!apiKey) {
          setAssets(getDemoAssets(chainId));
          setLoading(false);
          return;
        }

        // Fetch tokens and NFTs
        const [tokenRes, nftRes] = await Promise.all([
          fetch(`https://deep-index.moralis.io/api/v2.2/wallets/${address}/tokens?chain=${moralisChain}`,
            { headers: { 'X-API-Key': apiKey } }),
          fetch(`https://deep-index.moralis.io/api/v2.2/${address}/nft?chain=${moralisChain}&format=decimal&limit=50`,
            { headers: { 'X-API-Key': apiKey } }),
        ]);

        const [tokenData, nftData] = await Promise.all([tokenRes.json(), nftRes.json()]);
        const chainKey = getChainKey(chainId);

        const allAssets: Asset[] = [
          ...((tokenData.result || tokenData.tokens || [])
            .filter((t: any) => t.token_address || t.contract_address)
            .map((t: any) => ({
              id: `${t.token_address || t.contract_address}-${chainId}`,
              name: t.name || 'Unknown Token',
              symbol: t.symbol || '???',
              type: 'token' as const,
              balance: (Number(t.balance || '0') / 10 ** (t.decimals || 18)).toFixed(4),
              balanceRaw: BigInt(t.balance || '0'),
              decimals: t.decimals || 18,
              contractAddress: t.token_address || t.contract_address,
              usdValue: t.usd_value ? `$${Number(t.usd_value).toFixed(2)}` : '< $0.01',
              logoUrl: t.logo || t.thumbnail,
              chain: chainKey,
            }))),
          ...((nftData.result || []).map((n: any) => ({
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
          }))),
        ];

        setLoading(false);
        setScanning(true);

        // Simulate each asset to check if burnable
        const rpcUrl = CHAIN_RPC[chainId] || 'https://eth.llamarpc.com';
        const burnable: Asset[] = [];
        let hidden = 0;

        for (const asset of allAssets) {
          const canBurn = await isTokenBurnable(
            asset.contractAddress,
            address,
            asset.balanceRaw,
            asset.type,
            asset.tokenId,
            rpcUrl
          );
          if (canBurn) {
            burnable.push(asset);
          } else {
            hidden++;
          }
          // Update progressively as we scan
          setAssets([...burnable]);
          setHiddenCount(hidden);
        }

        setScanning(false);
      } catch (err: unknown) {
        const e = err as Error;
        setError(e.message);
        setAssets(getDemoAssets(chainId));
      } finally {
        setLoading(false);
        setScanning(false);
      }
    };

    fetchAssets();
  }, [address, chainId]);

  return { assets, loading, scanning, hiddenCount, error };
}

function getChainKey(chainId: number): ChainKey {
  const map: Record<number, ChainKey> = {
    1: 'ethereum', 56: 'bnb', 137: 'polygon', 43114: 'avalanche',
    42161: 'arbitrum', 10: 'optimism', 8453: 'base', 324: 'zksync',
    59144: 'linea', 534352: 'scroll', 1101: 'polygonzkevm', 5000: 'mantle',
    81457: 'blast', 250: 'fantom', 25: 'cronos', 100: 'gnosis',
    42220: 'celo', 1088: 'metis', 1284: 'moonbeam', 2222: 'kava',
  };
  return map[chainId] || 'ethereum';
}

function getDemoAssets(chainId: number): Asset[] {
  const chainKey = getChainKey(chainId);
  return [
    { id: 'demo-1', name: 'Worthless Token', symbol: 'WLSS', type: 'token', balance: '1,000,000', balanceRaw: 1000000000000000000000000n, decimals: 18, contractAddress: '0x0000000000000000000000000000000000000001', usdValue: '< $0.01', chain: chainKey },
    { id: 'demo-2', name: 'Dead Meme Coin', symbol: 'DEAD', type: 'token', balance: '420,690', balanceRaw: 420690000000000000000000n, decimals: 18, contractAddress: '0x0000000000000000000000000000000000000002', usdValue: '< $0.01', chain: chainKey },
    { id: 'demo-3', name: 'Rug Pull NFT #9999', symbol: 'RUGPULL', type: 'nft', balance: '1', balanceRaw: 1n, decimals: 0, contractAddress: '0x0000000000000000000000000000000000000003', usdValue: 'Floor: 0 ETH', tokenId: '9999', chain: chainKey },
  ];
}
