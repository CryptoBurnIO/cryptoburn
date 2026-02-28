'use client';
import { useState } from 'react';
import { useAccount, useWalletClient, useChainId, useSwitchChain } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { ChainSelector } from '@/components/ChainSelector';
import { AssetRow } from '@/components/AssetRow';
import { BurnModal } from '@/components/BurnModal';
import { BurnReceipt } from '@/components/BurnReceipt';
import { useEvmAssets } from '@/hooks/useEvmAssets';
import { burnAsset, sendFeeOnce } from '@/lib/burnEvm';
import { SUPPORTED_CHAINS, type ChainKey } from '@/lib/chains';
import { calculateFee } from '@/lib/fees';
import { useEffect } from 'react';

export function BurnInterface() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  const [selectedChain, setSelectedChain] = useState<ChainKey>('ethereum');
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [burnResults, setBurnResults] = useState<any[] | null>(null);
  const [burnedIds, setBurnedIds] = useState<Set<string>>(new Set());

  const { assets: rawAssets, loading } = useEvmAssets(address, chainId);
  const assets = rawAssets.filter((a) => !burnedIds.has(a.id));
  const chain = SUPPORTED_CHAINS[selectedChain];
  const selectedAssetObjects = assets.filter((a) => selectedAssets.has(a.id));
  const fee = calculateFee(selectedAssetObjects);

  // Auto-sync selected chain with wallet's actual connected chain
  useEffect(() => {
    const match = Object.entries(SUPPORTED_CHAINS).find(
      ([, c]) => c.type === 'evm' && 'id' in c && c.id === chainId
    );
    if (match) setSelectedChain(match[0] as ChainKey);
  }, [chainId]);

  const handleChainChange = (newChain: ChainKey) => {
    setSelectedChain(newChain);
    setSelectedAssets(new Set());
    const c = SUPPORTED_CHAINS[newChain];
    if (c.type === 'evm' && 'id' in c && typeof c.id === 'number') {
      switchChain?.({ chainId: c.id });
    }
  };

  const toggleAsset = (id: string) => {
    setSelectedAssets((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleBurn = async () => {
    if (!walletClient || selectedAssetObjects.length === 0) return;

    // Step 1: Collect the SINGLE fee for the entire batch upfront
    // If user cancels this, the whole burn is cancelled
    const feeSuccess = await sendFeeOnce(walletClient, fee.totalUsd);
    if (!feeSuccess) {
      setShowModal(false);
      return; // User cancelled fee — abort everything, no burns happen
    }

    // Step 2: Burn all selected assets (no more fee requests)
    const results: Array<{ assetName: string; txHash: string; explorerUrl: string; success: boolean; error?: string }> = [];
    for (const asset of selectedAssetObjects) {
      const result = await burnAsset(walletClient, asset, chain.explorer);
      results.push({
        assetName: asset.name,
        txHash: result.txHash || '',
        explorerUrl: result.explorerUrl || '',
        success: result.success,
        error: result.error,
      });
    }

    setShowModal(false);
    setBurnResults(results);

    // Immediately remove successfully burned assets from the visible list
    const successfulIds = new Set(
      selectedAssetObjects
        .filter((_, i) => results[i]?.success)
        .map((a) => a.id)
    );
    setBurnedIds((prev) => new Set([...prev, ...successfulIds]));
    setSelectedAssets(new Set());
  };

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
        <div className="text-6xl mb-6">🔥</div>
        <h2 className="font-bebas text-4xl tracking-widest text-orange-400 mb-4">
          CONNECT YOUR WALLET
        </h2>
        <p className="text-gray-500 mb-8 max-w-sm">
          Connect to scan your wallet for burnable assets. We never hold your keys.
        </p>
        <ConnectButton />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="font-bebas text-3xl tracking-widest text-white">BURN ASSETS</h2>
          <p className="text-gray-500 text-sm font-mono mt-1">
            {address?.slice(0, 6)}...{address?.slice(-4)} connected
          </p>
        </div>
        <ConnectButton showBalance={false} />
      </div>

      {/* Chain Selector */}
      <div className="mb-8">
        <ChainSelector selected={selectedChain} onChange={handleChainChange} />
      </div>

      {/* Fee info box */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-sm p-3 mb-4">
        <p className="font-mono text-xs text-gray-500 leading-relaxed">
          💳 <span className="text-gray-300">Fee structure:</span>{' '}
          Tokens <span className="text-orange-400">$0.10</span> ·
          NFTs 1-5 <span className="text-orange-400">$0.25</span> ·
          NFTs 6-20 <span className="text-orange-400">$0.50</span> ·
          NFTs 21+ <span className="text-orange-400">$1.00 cap</span>
        </p>
      </div>

      {/* Assets List */}
      <div className="bg-gray-900 border border-gray-800 rounded-sm overflow-hidden mb-4 flex flex-col" style={{maxHeight: "420px"}}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-950">
          <span className="font-mono text-xs text-gray-500 tracking-widest uppercase">
            Your Assets · {chain.name}
          </span>
          {assets.length > 0 && (
            <button
              onClick={() =>
                selectedAssets.size === assets.length
                  ? setSelectedAssets(new Set())
                  : setSelectedAssets(new Set(assets.map((a) => a.id)))
              }
              className="font-mono text-xs text-orange-400 hover:text-orange-300 transition-colors"
            >
              {selectedAssets.size === assets.length ? 'Deselect All' : 'Select All'}
            </button>
          )}
        </div>

        <div className="divide-y divide-gray-800/50 overflow-y-auto flex-1">
          {loading ? (
            <div className="p-8 text-center">
              <div className="text-2xl mb-3 animate-pulse">🔥</div>
              <p className="text-gray-500 font-mono text-sm">Scanning wallet...</p>
            </div>
          ) : assets.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500 text-sm">No assets found on {chain.name}</p>
            </div>
          ) : (
            assets.map((asset) => (
              <AssetRow
                key={asset.id}
                asset={asset}
                selected={selectedAssets.has(asset.id)}
                onToggle={() => toggleAsset(asset.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Burn Footer */}
      {selectedAssets.size > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-sm p-4">
          <div className="mb-4 bg-gray-950 border border-gray-800 rounded-sm p-3">
            <div className="flex justify-between items-center mb-1">
              <span className="font-mono text-xs text-gray-500">Service fee (one payment)</span>
              <span className="font-mono text-xs text-orange-400 font-bold">${fee.totalUsd.toFixed(2)}</span>
            </div>
            {fee.tokenCount > 0 && (
              <div className="flex justify-between items-center">
                <span className="font-mono text-xs text-gray-600">{fee.tokenCount} token{fee.tokenCount > 1 ? 's' : ''}</span>
                <span className="font-mono text-xs text-gray-600">$0.10</span>
              </div>
            )}
            {fee.nftCount > 0 && (
              <div className="flex justify-between items-center">
                <span className="font-mono text-xs text-gray-600">
                  {fee.nftCount} NFT{fee.nftCount > 1 ? 's' : ''} (flat rate)
                </span>
                <span className="font-mono text-xs text-gray-600">
                  ${fee.nftCount >= 21 ? '1.00' : fee.nftCount >= 6 ? '0.50' : '0.25'}
                </span>
              </div>
            )}
            <div className="border-t border-gray-800 mt-2 pt-2 flex justify-between items-center">
              <span className="font-mono text-xs text-gray-500">+ Network gas</span>
              <span className="font-mono text-xs text-gray-500">varies</span>
            </div>
          </div>

          <p className="font-mono text-xs text-gray-600 mb-4">
            Burn address: <span className="text-orange-400/70">{chain.burnAddress}</span>
          </p>

          <button
            onClick={() => setShowModal(true)}
            className="w-full bg-gradient-to-r from-orange-600 to-orange-500 text-black py-4 font-bebas text-xl tracking-widest rounded-sm hover:opacity-90 transition-all"
          >
            🔥 BURN {selectedAssets.size} ASSET{selectedAssets.size !== 1 ? 'S' : ''} · ${fee.totalUsd.toFixed(2)} FEE
          </button>
        </div>
      )}

      {showModal && (
        <BurnModal
          assets={selectedAssetObjects}
          chainKey={selectedChain}
          fee={fee}
          onConfirm={handleBurn}
          onCancel={() => setShowModal(false)}
        />
      )}

      {burnResults && (
        <BurnReceipt
          results={burnResults}
          onDone={() => {
            setBurnResults(null);
            setSelectedAssets(new Set());
          }}
        />
      )}
    </div>
  );
}
