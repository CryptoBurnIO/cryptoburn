'use client';
import { useState } from 'react';
import { SUPPORTED_CHAINS, type ChainKey } from '@/lib/chains';

interface ChainSelectorProps {
  selected: ChainKey;
  onChange: (chain: ChainKey) => void;
}

type Category = 'All' | 'L1' | 'L2';

// Chains that are coming soon — shown as disabled buttons
const COMING_SOON = [
  { name: 'Solana', color: '#9945ff', category: 'L1' },
  { name: 'TON', color: '#0088cc', category: 'L1' },
];

export function ChainSelector({ selected, onChange }: ChainSelectorProps) {
  const [filter, setFilter] = useState<Category>('All');

  const entries = Object.entries(SUPPORTED_CHAINS) as [ChainKey, typeof SUPPORTED_CHAINS[ChainKey]][];
  const filtered = entries.filter(([, chain]) => {
    if (filter === 'All') return true;
    return 'category' in chain && chain.category === filter;
  });

  const showComingSoon = filter === 'All' || filter === 'L1';

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="font-mono text-xs text-gray-500 tracking-widest uppercase">Select Chain</p>
        <div className="flex gap-1">
          {(['All', 'L1', 'L2'] as Category[]).map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`font-mono text-xs px-3 py-1 rounded-sm transition-all ${
                filter === cat
                  ? 'bg-orange-600 text-black'
                  : 'text-gray-500 hover:text-gray-300 border border-gray-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {/* Active chains */}
        {filtered.map(([key, chain]) => (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border font-mono text-xs tracking-wide transition-all duration-200 ${
              selected === key
                ? 'border-orange-500 text-orange-400 bg-orange-950/30'
                : 'border-gray-700 text-gray-400 hover:border-orange-700 hover:text-orange-300'
            }`}
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{
                backgroundColor: chain.color === '#000000' ? '#555' : chain.color,
                boxShadow: selected === key ? `0 0 6px ${chain.color}` : 'none',
              }}
            />
            {chain.name}
          </button>
        ))}

        {/* Coming Soon chains */}
        {showComingSoon && COMING_SOON.map((chain) => (
          <div
            key={chain.name}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-800 font-mono text-xs tracking-wide opacity-50 cursor-not-allowed relative group"
            title={`${chain.name} — Coming Soon`}
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: chain.color }}
            />
            <span className="text-gray-600">{chain.name}</span>
            <span className="text-gray-700 text-xs ml-1">soon</span>
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
              <div className="bg-gray-900 border border-gray-700 rounded-sm px-2 py-1 whitespace-nowrap">
                <p className="font-mono text-xs text-orange-400">Coming in Stage 2</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Selected chain info */}
      {selected && (
        <div className="mt-3 flex items-center gap-2">
          <span className="font-mono text-xs text-gray-600">Burn address:</span>
          <span className="font-mono text-xs text-orange-400/70 truncate max-w-xs">
            {SUPPORTED_CHAINS[selected].burnAddress}
          </span>
          <a
            href={`${SUPPORTED_CHAINS[selected].explorer}/address/${SUPPORTED_CHAINS[selected].burnAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-xs text-gray-600 hover:text-orange-400 transition-colors"
          >
            verify ↗
          </a>
        </div>
      )}
    </div>
  );
}
