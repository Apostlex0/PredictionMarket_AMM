'use client';

import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import AddLiquidityForm from './AddLiquidityForm';
import RemoveLiquidityForm from './RemoveLiquidityForm';
import LPPositionCard from './LPPositionCard';
import { Market, getMarketPhase } from '@/types/market';

export default function LiquidityTab({ market }: { market: Market }) {
  const [activeView, setActiveView] = useState<'add' | 'remove'>('add');
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

  const canAdd =
    phase !== 'expired' &&
    phase !== 'resolved' &&
    (!market.isDynamic || phase === 'liquidity_period');

  return (
    <div className="grid lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2">
        <div className="flex space-x-2 mb-6">
          <button
            onClick={() => setActiveView('add')}
            className={`flex-1 px-6 py-3 rounded-xl font-medium transition-all duration-300 ${
              activeView === 'add'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white'
                : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            Add Liquidity
          </button>
          <button
            onClick={() => setActiveView('remove')}
            className={`flex-1 px-6 py-3 rounded-xl font-medium transition-all duration-300 ${
              activeView === 'remove'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white'
                : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            Remove Liquidity
          </button>
        </div>

        {activeView === 'add' && !canAdd ? (
          <div className="p-6 bg-yellow-500/10 border border-yellow-500/30 rounded-2xl">
            <div className="flex items-start space-x-3">
              <Clock className="w-5 h-5 text-yellow-400 mt-0.5" />
              <div>
                <div className="font-semibold text-yellow-400 mb-1">
                  Liquidity Addition Closed
                </div>
                <div className="text-sm text-yellow-200">
                  {market.isDynamic
                    ? 'Dynamic-market liquidity may only be added during the initial liquidity-collection period.'
                    : 'This market is no longer active.'}
                </div>
              </div>
            </div>
          </div>
        ) : activeView === 'add' ? (
          <AddLiquidityForm market={market} />
        ) : (
          <RemoveLiquidityForm market={market} />
        )}
      </div>

      <div className="lg:col-span-1">
        <LPPositionCard market={market} />
      </div>
    </div>
  );
}