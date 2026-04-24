'use client';
import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Transaction } from '@solana/web3.js';
import { AssetRow } from '@/components/AssetRow';
import { BurnModal } from '@/components/BurnModal';
import { BurnReceipt } from '@/components/BurnReceipt';
import { useSolanaAssets } from '@/hooks/useSolanaAssets';
import { burnSPLToken, burnSolanaNFT } from '@/lib/burnSolana';
import { burnCompressedNFT } from '@/lib/burnCNFT';
import { calculateFee } from '@/lib/fees';
import { SUPPORTED_CHAINS } from '@/lib/chains';

export function SolanaInterface() {
  const { publicKey, signTransaction, connected } = useWallet();
  const { assets: rawAssets, loading } = useSolanaAssets(publicKey);
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [burnResults, setBurnResults] = useState<any[] | null>(null);
  const [burnedIds, setBurnedIds] = useState<Set<string>>(new Set());

  const assets = rawAssets.filter((a) => !burnedIds.has(a.id));
  const selectedAssetObjects = assets.filter((a) => selectedAssets.has(a.id));
  const fee = calculateFee(selectedAssetObjects);

  const toggleAsset = (id: string) => {
    setSelectedAssets((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleBurn = async () => {
    if (!publicKey || !signTransaction || selectedAssetObjects.length === 0) return;

    const signTx = async (tx: Transaction): Promise<Transaction> => {
      return await signTransaction(tx);
    };

    const results: Array<{ assetName: string; txHash: string; explorerUrl: string; success: boolean; error?: string }> = [];

    // Single fee split across assets
    const feePerAsset = fee.totalUsd / selectedAssetObjects.length;

    for (const asset of selectedAssetObjects) {
      const isCompressed = asset.name.includes('[cNFT]');
      let result;

      if (isCompressed) {
        // Use Bubblegum for compressed NFTs
        result = await burnCompressedNFT(publicKey, signTx, asset.contractAddress, feePerAsset);
      } else if (asset.type === 'nft') {
        result = await burnSolanaNFT(publicKey, signTx, asset, feePerAsset);
      } else {
        result = await burnSPLToken(publicKey, signTx, asset, feePerAsset);
      }

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

    const successfulIds = new Set(
      selectedAssetObjects.filter((_, i) => results[i]?.success).map((a) => a.id)
    );
    setBurnedIds((prev) => new Set([...prev, ...successfulIds]));
    setSelectedAssets(new Set());
  };

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[30vh] text-center px-4 py-8">
        <div className="text-5xl mb-4">◎</div>
        <h3 className="font-bebas text-2xl tracking-widest text-purple-400 mb-3">
          CONNECT SOLANA WALLET
        </h3>
        <p className="text-gray-500 mb-6 text-sm max-w-xs">
          Connect Phantom or Solflare to scan and burn your Solana tokens and NFTs.
        </p>
        <WalletMultiButton style={{
          backgroundColor: '#9945ff',
          borderRadius: '2px',
          fontFamily: 'monospace',
          fontSize: '12px',
          letterSpacing: '2px',
        }} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-gray-500 text-sm font-mono">
          {publicKey?.toBase58().slice(0, 6)}...{publicKey?.toBase58().slice(-4)} · Solana
        </p>
        <WalletMultiButton style={{
          backgroundColor: 'transparent',
          border: '1px solid #374151',
          borderRadius: '2px',
          fontFamily: 'monospace',
          fontSize: '11px',
          letterSpacing: '1px',
          padding: '6px 12px',
        }} />
      </div>

      <div className="bg-gray-900/50 border border-gray-800 rounded-sm p-3 mb-4">
        <p className="font-mono text-xs text-gray-500 leading-relaxed">
          💳 <span className="text-gray-300">Fee structure:</span>{' '}
          Tokens <span className="text-purple-400">$0.10</span> ·
          NFTs 1-5 <span className="text-purple-400">$0.25</span> ·
          NFTs 6-20 <span className="text-purple-400">$0.50</span> ·
          NFTs 21+ <span className="text-purple-400">$1.00 cap</span>
          <span className="text-gray-600"> · paid in SOL</span>
        </p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-sm overflow-hidden mb-4 flex flex-col" style={{maxHeight: '420px'}}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-950">
          <span className="font-mono text-xs text-gray-500 tracking-widest uppercase">
            Your Assets · Solana ({assets.length})
          </span>
          {assets.length > 0 && (
            <button
              onClick={() =>
                selectedAssets.size === assets.length
                  ? setSelectedAssets(new Set())
                  : setSelectedAssets(new Set(assets.map((a) => a.id)))
              }
              className="font-mono text-xs text-purple-400 hover:text-purple-300 transition-colors"
            >
              {selectedAssets.size === assets.length ? 'Deselect All' : 'Select All'}
            </button>
          )}
        </div>

        <div className="divide-y divide-gray-800/50 overflow-y-auto flex-1">
          {loading ? (
            <div className="p-8 text-center">
              <div className="text-2xl mb-3 animate-pulse">◎</div>
              <p className="text-gray-500 font-mono text-sm">Scanning Solana wallet...</p>
            </div>
          ) : assets.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500 text-sm">No burnable assets found on Solana</p>
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

      {selectedAssets.size > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-sm p-4">
          <div className="mb-4 bg-gray-950 border border-gray-800 rounded-sm p-3">
            <div className="flex justify-between items-center mb-1">
              <span className="font-mono text-xs text-gray-500">Service fee (one payment in SOL)</span>
              <span className="font-mono text-xs text-purple-400 font-bold">${fee.totalUsd.toFixed(2)}</span>
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
              <span className="font-mono text-xs text-gray-500">+ Solana network fee</span>
              <span className="font-mono text-xs text-gray-500">~$0.001</span>
            </div>
          </div>

          <p className="font-mono text-xs text-gray-600 mb-4">
            Burn address: <span className="text-purple-400/70">1nc1nerator11111111111111111111111111111111</span>
          </p>

          <button
            onClick={() => setShowModal(true)}
            className="w-full py-4 font-bebas text-xl tracking-widest rounded-sm hover:opacity-90 transition-all text-white"
            style={{background: 'linear-gradient(to right, #7c3aed, #9945ff)'}}
          >
            🔥 BURN {selectedAssets.size} ASSET{selectedAssets.size !== 1 ? 'S' : ''} · ${fee.totalUsd.toFixed(2)} FEE
          </button>
        </div>
      )}

      {showModal && (
        <BurnModal
          assets={selectedAssetObjects}
          chainKey="solana"
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
