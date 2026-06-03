'use client';

import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import MintCompleteSet from './MintCompleteSet';
import SwapInterface from './SwapInterface';
import CurrentPosition from './CurrentPosition';
import { Market, getMarketPhase } from '@/types/market';

export default function TradingTab({ market }: { market: Market }) {
  const [activeView, setActiveView] = useState<'swap' | 'mint'>('swap');
  const [, setTick] = useState(0);

  useEffect(() => {
    if (market.resolved) {
      return;
    }

    const interval = window.setInterval(() => {
      setTick((tick) => tick + 1);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [market.resolved]);

  const phase = getMarketPhase(market);
  const canSwap = phase === 'trading';
  const canMint = phase === 'liquidity_period' || phase === 'trading';

  return (
    <div className="grid lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2">
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

        {activeView === 'swap' && !canSwap ? (
          <div className="p-6 bg-yellow-500/10 border border-yellow-500/30 rounded-2xl">
            <div className="flex items-start space-x-3">
              <Clock className="w-5 h-5 text-yellow-400 mt-0.5" />
              <div>
                <div className="font-semibold text-yellow-400 mb-1">
                  Swaps Are Not Available
                </div>
                <div className="text-sm text-yellow-200">
                  {phase === 'liquidity_period'
                    ? 'This dynamic market is collecting liquidity. Swaps begin when the liquidity period ends.'
                    : 'This market is no longer open for trading.'}
                </div>
              </div>
            </div>
          </div>
        ) : activeView === 'mint' && !canMint ? (
          <div className="p-6 bg-yellow-500/10 border border-yellow-500/30 rounded-2xl text-sm text-yellow-200">
            This market is no longer open for minting complete sets.
          </div>
        ) : activeView === 'swap' ? (
          <SwapInterface market={market} />
        ) : (
          <MintCompleteSet market={market} />
        )}
      </div>

      <div className="lg:col-span-1">
        <CurrentPosition market={market} />
      </div>
    </div>
  );
}