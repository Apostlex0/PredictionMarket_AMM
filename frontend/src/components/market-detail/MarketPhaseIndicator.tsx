'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, Clock, Droplets } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Market, getMarketPhase } from '@/types/market';

export default function MarketPhaseIndicator({ market }: { market: Market }) {
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

  if (phase === 'resolved') {
    const winningOutcome = market.outcome === true ? 'YES' : 'NO';

    return (
      <div className="mb-8 p-4 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-2xl">
        <div className="flex items-center space-x-3">
          <CheckCircle className="w-6 h-6 text-green-400" />
          <div>
            <div className="text-lg font-semibold text-green-400">Market Resolved</div>
            <div className="text-sm text-gray-400">
              Outcome: <span className="font-semibold text-white">{winningOutcome}</span>. Winning tokens can be redeemed for APT collateral.
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'expired') {
    return (
      <div className="mb-8 p-4 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-2xl">
        <div className="flex items-center space-x-3">
          <Clock className="w-6 h-6 text-yellow-400" />
          <div>
            <div className="text-lg font-semibold text-yellow-400">Market Expired</div>
            <div className="text-sm text-gray-400">
              Waiting for the market creator to resolve the outcome.
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'liquidity_period') {
    return (
      <div className="mb-8 p-4 bg-gradient-to-r from-purple-500/10 to-cyan-500/10 border border-purple-500/30 rounded-2xl">
        <div className="flex items-center space-x-3">
          <Droplets className="w-6 h-6 text-purple-400" />
          <div>
            <div className="text-lg font-semibold text-purple-400">Liquidity Collection</div>
            <div className="text-sm text-gray-400">
              Trading begins {formatDistanceToNow(market.liquidityPeriodEndsAt!, { addSuffix: true })}. Liquidity may be added during this phase.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8 p-4 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/30 rounded-2xl">
      <div className="flex items-center space-x-3">
        <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse" />
        <div>
          <div className="text-lg font-semibold text-blue-400">Trading Active</div>
          <div className="text-sm text-gray-400">
            Trading closes {formatDistanceToNow(market.expiresAt, { addSuffix: true })}
          </div>
        </div>
      </div>
    </div>
  );
}