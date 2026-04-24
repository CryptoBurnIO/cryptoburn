'use client';
import { useState } from 'react';
import type { Asset } from '@/lib/chains';
import { SUPPORTED_CHAINS } from '@/lib/chains';
import type { FeeBreakdown } from '@/lib/fees';

interface BurnModalProps {
  assets: Asset[];
  chainKey: string;
  fee: FeeBreakdown;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export function BurnModal({ assets, chainKey, fee, onConfirm, onCancel }: BurnModalProps) {
  const [burning, setBurning] = useState(false);
  const [typed, setTyped] = useState('');
  const chain = SUPPORTED_CHAINS[chainKey as keyof typeof SUPPORTED_CHAINS];
  const requireConfirm = typed.toUpperCase() === 'BURN';

  const handleConfirm = async () => {
    if (!requireConfirm) return;
    setBurning(true);
    await onConfirm();
    setBurning(false);
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onCancel();
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={handleBackdropClick}
    >
      <div className="bg-gray-900 border border-orange-600 rounded-sm max-w-md w-full p-6 my-auto">

        <div className="text-4xl text-center mb-3">🔥</div>
        <h2 className="font-bebas text-3xl tracking-widest text-orange-400 text-center mb-2">
          CONFIRM BURN
        </h2>
        <p className="text-gray-400 text-sm text-center mb-4 leading-relaxed">
          You are about to permanently destroy{' '}
          <span className="text-white font-medium">{assets.length} asset{assets.length !== 1 ? 's' : ''}</span>.
          This is irreversible. These assets will be gone forever.
        </p>

        {/* Assets list — scrollable */}
        <div className="bg-gray-950 border border-gray-800 rounded-sm p-3 mb-3 space-y-1 max-h-32 overflow-y-auto">
          {assets.map((a) => (
            <div key={a.id} className="flex justify-between items-center text-sm">
              <span className="text-gray-300 truncate mr-2">{a.name}</span>
              <span className="text-gray-500 font-mono text-xs flex-shrink-0">{a.type.toUpperCase()}</span>
            </div>
          ))}
        </div>

        {/* Burn address */}
        <div className="bg-orange-950/20 border border-orange-900/40 rounded-sm p-3 mb-3">
          <p className="font-mono text-xs text-gray-500 leading-relaxed">
            Destination: <span className="text-orange-400 break-all">{chain?.burnAddress}</span>
            <br />
            Network: <span className="text-green-400">{chain?.name}</span>
          </p>
        </div>

        {/* Fee breakdown */}
        <div className="bg-gray-950 border border-gray-700 rounded-sm p-3 mb-4">
          <p className="font-mono text-xs text-gray-400 mb-2 tracking-widest uppercase">Fee Breakdown</p>
          {fee.tokenCount > 0 && (
            <div className="flex justify-between text-xs font-mono mb-1">
              <span className="text-gray-500">{fee.tokenCount} token{fee.tokenCount > 1 ? 's' : ''}</span>
              <span className="text-gray-300">$0.10</span>
            </div>
          )}
          {fee.nftCount > 0 && (
            <div className="flex justify-between text-xs font-mono mb-1">
              <span className="text-gray-500">
                {fee.nftCount} NFT{fee.nftCount > 1 ? 's' : ''} 
                {fee.nftCount >= 21 ? ' (21+ cap)' : fee.nftCount >= 6 ? ' (6-20 rate)' : ' (1-5 rate)'}
              </span>
              <span className="text-gray-300">
                ${fee.nftCount >= 21 ? '1.00' : fee.nftCount >= 6 ? '0.50' : '0.25'}
              </span>
            </div>
          )}
          <div className="border-t border-gray-800 mt-2 pt-2 flex justify-between text-xs font-mono">
            <span className="text-white font-bold">Total service fee</span>
            <span className="text-orange-400 font-bold">${fee.totalUsd.toFixed(2)}</span>
          </div>
          <p className="text-gray-600 text-xs font-mono mt-1">+ network gas paid to blockchain</p>
          <p className="text-gray-600 text-xs font-mono">Fees keep CryptoBurn running. No hidden costs.</p>
        </div>

        {/* Type BURN to confirm */}
        <div className="mb-4">
          <p className="font-mono text-xs text-gray-500 mb-2 tracking-widest">
            TYPE "BURN" TO CONFIRM
          </p>
          <input
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="BURN"
            className="w-full bg-gray-950 border border-gray-700 text-white font-mono text-sm px-4 py-3 rounded-sm outline-none focus:border-orange-600 placeholder-gray-700 uppercase tracking-widest"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={burning}
            className="flex-1 border border-gray-600 text-gray-400 py-3 font-bebas text-lg tracking-widest rounded-sm hover:border-gray-400 hover:text-white transition-all disabled:opacity-50"
          >
            CANCEL
          </button>
          <button
            onClick={handleConfirm}
            disabled={!requireConfirm || burning}
            className={`flex-2 flex-grow-[2] py-3 font-bebas text-lg tracking-widest rounded-sm transition-all ${
              requireConfirm && !burning
                ? 'bg-gradient-to-r from-orange-600 to-orange-500 text-black hover:opacity-90'
                : 'bg-gray-800 text-gray-600 cursor-not-allowed'
            }`}
          >
            {burning ? '⏳ BURNING...' : `🔥 BURN · $${fee.totalUsd.toFixed(2)}`}
          </button>
        </div>

        <p className="text-center mt-3">
          <button onClick={onCancel} className="font-mono text-xs text-gray-600 hover:text-gray-400 transition-colors">
            Cancel and go back
          </button>
        </p>

      </div>
    </div>
  );
}
