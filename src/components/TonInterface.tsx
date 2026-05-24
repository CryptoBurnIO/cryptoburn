'use client';
import { useState } from 'react';
import { useTonConnectUI, useTonAddress } from '@tonconnect/ui-react';
import { AssetRow } from '@/components/AssetRow';
import { BurnModal } from '@/components/BurnModal';
import { BurnReceipt } from '@/components/BurnReceipt';
import { useTonAssets } from '@/hooks/useTonAssets';
import { buildTonBurnMessages } from '@/lib/burnTon';
import { FEE_RECIPIENT_TON } from '@/lib/fees';
import { calculateFee } from '@/lib/fees';
import type { TonAsset } from '@/lib/burnTon';

export function TonInterface() {
  const [tonConnectUI] = useTonConnectUI();
  const walletAddress = useTonAddress();
  const { assets: rawAssets, loading, scanning, hiddenCount } = useTonAssets(walletAddress || null);
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [burnResults, setBurnResults] = useState<any[] | null>(null);
  const [burnedIds, setBurnedIds] = useState<Set<string>>(new Set());
  const [assetFilter, setAssetFilter] = useState<'all' | 'token' | 'nft'>('all');

  const assets = rawAssets.filter((a) => !burnedIds.has(a.id));
  const filteredAssets = assets.filter((a) => assetFilter === 'all' || a.type === assetFilter);
  const selectedAssetObjects = assets.filter((a) => selectedAssets.has(a.id));
  const fee = calculateFee(selectedAssetObjects);

  const tokenCount = assets.filter((a) => a.type === 'token').length;
  const nftCount = assets.filter((a) => a.type === 'nft').length;

  const toggleAsset = (id: string) => {
    setSelectedAssets((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleBurn = async () => {
    if (!walletAddress || selectedAssetObjects.length === 0) return;

    try {
      const results: Array<{ assetName: string; txHash: string; explorerUrl: string; success: boolean; error?: string }> = [];
      const successfulIds = new Set<string>();

      // Send fee first as a single transaction
      if (fee.totalUsd > 0) {
        const feeInTon = fee.totalUsd / 5;
        const { Address, toNano, beginCell } = await import('@ton/ton');
        const feeTx = await tonConnectUI.sendTransaction({
          validUntil: Math.floor(Date.now() / 1000) + 600,
          messages: [{
            address: Address.parse(FEE_RECIPIENT_TON).toString(),
            amount: toNano(Math.max(feeInTon, 0.001).toFixed(9)).toString(),
            payload: beginCell().storeUint(0,32).storeStringTail('CryptoBurn fee').endCell().toBoc().toString('base64'),
          }],
        });
        if (!feeTx.boc) throw new Error('Fee transaction failed');
      }

      // Burn each asset individually
      for (const asset of selectedAssetObjects) {
        try {
          const { Address, toNano, beginCell } = await import('@ton/ton');
          
          let payload: string;
          if (asset.type === 'nft') {
            payload = beginCell()
              .storeUint(0x5fcc3d14, 32)
              .storeUint(0, 64)
              .storeAddress(Address.parse('UQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJKZ'))
              .storeAddress(Address.parse('UQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJKZ'))
              .storeBit(0)
              .storeCoins(toNano('0.001'))
              .storeBit(0)
              .endCell().toBoc().toString('base64');
          } else {
            payload = beginCell()
              .storeUint(0x0f8a7ea5, 32)
              .storeUint(0, 64)
              .storeCoins(BigInt(asset.balanceRaw))
              .storeAddress(Address.parse('UQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJKZ'))
              .storeAddress(Address.parse('UQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJKZ'))
              .storeBit(0)
              .storeCoins(toNano('0.001'))
              .storeBit(0)
              .endCell().toBoc().toString('base64');
          }

          const result = await tonConnectUI.sendTransaction({
            validUntil: Math.floor(Date.now() / 1000) + 600,
            messages: [{
              address: Address.parse(asset.contractAddress).toString(),
              amount: toNano('0.05').toString(),
              payload,
            }],
          });

          // Only mark success if wallet returned a valid boc
          if (result?.boc && result.boc.length > 10) {
            // Wait for TON to process then verify NFT is gone
            await new Promise(resolve => setTimeout(resolve, 5000));
            try {
              const verifyRes = await fetch(
                `https://tonapi.io/v2/nfts/${asset.contractAddress}`
              );
              const verifyData = await verifyRes.json();
              // If owner is now the burn/null address, it worked
              const newOwner = verifyData?.owner?.address || '';
              const isBurned = newOwner.includes('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA') || 
                               !verifyData?.owner;
              
              results.push({
                assetName: asset.name,
                txHash: result.boc,
                explorerUrl: 'https://tonscan.org',
                success: isBurned,
                error: isBurned ? undefined : 'Transaction submitted but NFT still appears in wallet — may not have burned',
              });
              if (isBurned) successfulIds.add(asset.id);
            } catch {
              // Can't verify — trust the wallet response
              results.push({
                assetName: asset.name,
                txHash: result.boc,
                explorerUrl: 'https://tonscan.org',
                success: true,
              });
              successfulIds.add(asset.id);
            }
          } else {
            results.push({
              assetName: asset.name,
              txHash: '',
              explorerUrl: '',
              success: false,
              error: 'Transaction rejected or cancelled',
            });
          }

        } catch (assetErr: unknown) {
          const error = assetErr as Error;
          results.push({
            assetName: asset.name,
            txHash: '',
            explorerUrl: '',
            success: false,
            error: error.message || 'TON burn failed',
          });
        }
      }

      setShowModal(false);
      setBurnResults(results);
      setBurnedIds((prev) => new Set([...prev, ...successfulIds]));
      setSelectedAssets(new Set());

    } catch (err: unknown) {
      const error = err as Error;
      const results = selectedAssetObjects.map((asset) => ({
        assetName: asset.name,
        txHash: '',
        explorerUrl: '',
        success: false,
        error: error.message || 'TON transaction failed',
      }));
      setShowModal(false);
      setBurnResults(results);
    }
  };

  if (!walletAddress) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[30vh] text-center px-4 py-8">
        <div className="text-5xl mb-4">💎</div>
        <h3 className="font-bebas text-2xl tracking-widest mb-3" style={{ color: '#0088cc' }}>
          CONNECT TON WALLET
        </h3>
        <p className="text-gray-500 mb-6 text-sm max-w-xs">
          Connect Tonkeeper, MyTonWallet or any TON Connect wallet to burn your Jettons and NFTs.
        </p>
        <button
          onClick={() => tonConnectUI.openModal()}
          className="px-6 py-3 font-bebas text-lg tracking-widest rounded-sm text-white transition-all hover:opacity-90"
          style={{ background: '#0088cc' }}
        >
          CONNECT TON WALLET
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-gray-500 text-sm font-mono">
          {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)} · TON
        </p>
        <button
          onClick={() => tonConnectUI.disconnect()}
          className="font-mono text-xs text-gray-500 hover:text-gray-300 border border-gray-700 px-3 py-1.5 rounded-sm transition-colors"
        >
          Disconnect
        </button>
      </div>

      {/* Fee info */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-sm p-3 mb-4">
        <p className="font-mono text-xs text-gray-500 leading-relaxed">
          💳 <span className="text-gray-300">Fee structure:</span>{' '}
          Tokens <span style={{ color: '#0088cc' }}>$0.10</span> ·
          NFTs 1-5 <span style={{ color: '#0088cc' }}>$0.25</span> ·
          NFTs 6-20 <span style={{ color: '#0088cc' }}>$0.50</span> ·
          NFTs 21+ <span style={{ color: '#0088cc' }}>$1.00 cap</span>
          <span className="text-gray-600"> · paid in TON</span>
        </p>
      </div>

      {/* Asset filter tabs */}
      <div className="flex gap-2 mb-3">
        {[
          { key: 'all', label: `All (${assets.length})` },
          { key: 'token', label: `Tokens (${tokenCount})` },
          { key: 'nft', label: `NFTs (${nftCount})` },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setAssetFilter(tab.key as 'all' | 'token' | 'nft')}
            className={`font-mono text-xs px-3 py-1.5 rounded-sm border transition-all ${
              assetFilter === tab.key
                ? 'text-white border-blue-500'
                : 'text-gray-500 border-gray-700 hover:border-gray-500'
            }`}
            style={assetFilter === tab.key ? { backgroundColor: '#0088cc22', borderColor: '#0088cc' } : {}}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Assets list */}
      <div className="bg-gray-900 border border-gray-800 rounded-sm overflow-hidden mb-4 flex flex-col" style={{ maxHeight: '420px' }}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-950">
          <span className="font-mono text-xs text-gray-500 tracking-widest uppercase">
            Your Assets · TON
          </span>
          {filteredAssets.length > 0 && (
            <button
              onClick={() => {
                const filteredIds = new Set(filteredAssets.map((a) => a.id));
                const allSelected = filteredAssets.every((a) => selectedAssets.has(a.id));
                setSelectedAssets((prev) => {
                  const next = new Set(prev);
                  if (allSelected) filteredIds.forEach((id) => next.delete(id));
                  else filteredIds.forEach((id) => next.add(id));
                  return next;
                });
              }}
              className="font-mono text-xs transition-colors hover:opacity-80"
              style={{ color: '#0088cc' }}
            >
              {filteredAssets.every((a) => selectedAssets.has(a.id)) ? 'Deselect All' : 'Select All'}
            </button>
          )}
        </div>

        <div className="divide-y divide-gray-800/50 overflow-y-auto flex-1">
          {loading ? (
            <div className="p-8 text-center">
              <div className="text-2xl mb-3 animate-pulse">💎</div>
              <p className="text-gray-500 font-mono text-sm">Scanning TON wallet...</p>
            </div>
          ) : scanning ? (
            <div className="p-4 text-center">
              <div className="text-xl mb-2 animate-pulse">🔍</div>
              <p className="text-gray-500 font-mono text-xs">Checking which assets are burnable...</p>
              <p className="text-gray-600 font-mono text-xs mt-1">We simulate each burn before showing it</p>
              {assets.length > 0 && <p style={{color: '#0088cc'}} className="font-mono text-xs mt-1">{assets.length} burnable found so far...</p>}
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500 text-sm">No {assetFilter === 'all' ? '' : assetFilter} assets found on TON</p>
            </div>
          ) : (
            filteredAssets.map((asset) => (
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

      {/* Burn footer */}
      {/* Hidden assets notice */}
      {hiddenCount > 0 && !scanning && (
        <div className="bg-gray-900/50 border border-gray-800 rounded-sm p-3 mb-4">
          <p className="font-mono text-xs text-gray-600">
            ℹ️ {hiddenCount} asset{hiddenCount !== 1 ? 's' : ''} hidden — not burnable. Only burnable assets are shown here.
          </p>
        </div>
      )}

      {selectedAssets.size > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-sm p-4">
          <div className="mb-4 bg-gray-950 border border-gray-800 rounded-sm p-3">
            <div className="flex justify-between items-center mb-1">
              <span className="font-mono text-xs text-gray-500">Service fee (one payment in TON)</span>
              <span className="font-mono text-xs font-bold" style={{ color: '#0088cc' }}>${fee.totalUsd.toFixed(2)}</span>
            </div>
            {fee.tokenCount > 0 && (
              <div className="flex justify-between items-center">
                <span className="font-mono text-xs text-gray-600">{fee.tokenCount} token{fee.tokenCount > 1 ? 's' : ''}</span>
                <span className="font-mono text-xs text-gray-600">$0.10</span>
              </div>
            )}
            {fee.nftCount > 0 && (
              <div className="flex justify-between items-center">
                <span className="font-mono text-xs text-gray-600">{fee.nftCount} NFT{fee.nftCount > 1 ? 's' : ''} (flat rate)</span>
                <span className="font-mono text-xs text-gray-600">
                  ${fee.nftCount >= 21 ? '1.00' : fee.nftCount >= 6 ? '0.50' : '0.25'}
                </span>
              </div>
            )}
            <div className="border-t border-gray-800 mt-2 pt-2 flex justify-between items-center">
              <span className="font-mono text-xs text-gray-500">+ TON network fee</span>
              <span className="font-mono text-xs text-gray-500">~0.05 TON</span>
            </div>
          </div>

          <p className="font-mono text-xs text-gray-600 mb-4">
            Burn address: <span style={{ color: '#0088cc99' }}>EQAAA...AM9c</span>
          </p>

          <button
            onClick={() => setShowModal(true)}
            className="w-full py-4 font-bebas text-xl tracking-widest rounded-sm hover:opacity-90 transition-all text-white"
            style={{ background: 'linear-gradient(to right, #006699, #0088cc)' }}
          >
            🔥 BURN {selectedAssets.size} ASSET{selectedAssets.size !== 1 ? 'S' : ''} · ${fee.totalUsd.toFixed(2)} FEE
          </button>
        </div>
      )}

      {showModal && (
        <BurnModal
          assets={selectedAssetObjects}
          chainKey="ton"
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
