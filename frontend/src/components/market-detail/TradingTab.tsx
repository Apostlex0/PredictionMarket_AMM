// src/components/market-detail/TradingTab.tsx
'use client';
import { useState } from 'react';
import MintCompleteSet from './MintCompleteSet';
import SwapInterface from './SwapInterface';
import CurrentPosition from './CurrentPosition';
import { Market } from '@/types/market';

export default function TradingTab({ market }: { market: Market }) {
  const [activeView, setActiveView] = useState<'swap' | 'mint'>('swap');

  return (
    <div className="grid lg:grid-cols-3 gap-8">
      {/* Main Trading Interface */}
      <div className="lg:col-span-2">
        {/* Toggle between Swap and Mint */}
        <div className="flex space-x-2 mb-6">
          <button
            onClick={() => setActiveView('swap')}
            className={`flex-1 px-6 py-3 rounded-xl font-medium transition-all duration-300 ${
              activeView === 'swap'
                ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white'
                : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            Swap Tokens
          </button>
          <button
            onClick={() => setActiveView('mint')}
            className={`flex-1 px-6 py-3 rounded-xl font-medium transition-all duration-300 ${
              activeView === 'mint'
                ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white'
                : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            Mint Set
          </button>
        </div>

        {activeView === 'swap' ? (
          <SwapInterface market={market} />
        ) : (
          <MintCompleteSet market={market} />
        )}
      </div>

      {/* Sidebar - Current Position */}
      <div className="lg:col-span-1">
        <CurrentPosition market={market} />
      </div>
    </div>
  );
}