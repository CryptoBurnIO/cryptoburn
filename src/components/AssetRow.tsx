'use client';
import type { Asset } from '@/lib/chains';

interface AssetRowProps {
  asset: Asset;
  selected: boolean;
  onToggle: () => void;
}

export function AssetRow({ asset, selected, onToggle }: AssetRowProps) {
  return (
    <div
      onClick={onToggle}
      className={`flex items-center justify-between p-4 border cursor-pointer transition-all duration-200 rounded-sm ${
        selected
          ? 'border-orange-600 bg-orange-950/20'
          : 'border-gray-800 bg-gray-900/50 hover:border-gray-600'
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Checkbox */}
        <div
          className={`w-5 h-5 rounded-sm border flex items-center justify-center flex-shrink-0 transition-all ${
            selected ? 'border-orange-500 bg-orange-950' : 'border-gray-600'
          }`}
        >
          {selected && <span className="text-orange-400 text-xs">✓</span>}
        </div>

        {/* Icon */}
        <div className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center text-lg flex-shrink-0">
          {asset.type === 'nft' ? '🖼' : '🪙'}
        </div>

        {/* Info */}
        <div>
          <div className="text-sm font-medium text-gray-100">{asset.name}</div>
          <div className="text-xs font-mono text-gray-500 mt-0.5">
            {asset.type === 'token'
              ? `${asset.balance} ${asset.symbol}`
              : `NFT · Token #${asset.tokenId}`}
          </div>
        </div>
      </div>

      {/* Value */}
      <div className="text-right">
        <div className="text-xs font-mono text-gray-500">{asset.usdValue}</div>
        <div className={`text-xs mt-1 ${asset.type === 'nft' ? 'text-purple-400' : 'text-blue-400'}`}>
          {asset.type.toUpperCase()}
        </div>
      </div>
    </div>
  );
}
