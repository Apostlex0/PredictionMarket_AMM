// src/components/market-detail/CurrentPosition.tsx
'use client';
import { TrendingUp, TrendingDown } from 'lucide-react';

export default function CurrentPosition({ marketId }: { marketId: string }) {
  // Mock data - replace with actual wallet position
  const position = {
    yesTokens: 15.5,
    noTokens: 8.2,
    totalInvested: 23.7,
    currentValue: 28.4,
    pnl: 4.7,
    pnlPercent: 19.8,
  };

  const isProfitable = position.pnl > 0;

  return (
    <div className="sticky top-24">
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-pink-500/10 to-purple-500/10 rounded-3xl blur-xl"></div>
        <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-6">
          <h4 className="text-xl font-bold mb-6 font-[family-name:var(--font-geist-mono)]">
            Your Position
          </h4>

          {/* Token Holdings */}
          <div className="space-y-3 mb-6">
            <div className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/30 rounded-xl">
              <span className="text-sm text-gray-400">YES Tokens</span>
              <span className="text-lg font-bold text-white">{position.yesTokens}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
              <span className="text-sm text-gray-400">NO Tokens</span>
              <span className="text-lg font-bold text-white">{position.noTokens}</span>
            </div>
          </div>

          {/* Value Info */}
          <div className="space-y-3 pt-6 border-t border-white/10">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Total Invested</span>
              <span className="text-white">${position.totalInvested.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Current Value</span>
              <span className="text-white">${position.currentValue.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm pt-3 border-t border-white/10">
              <span className="text-gray-400">P&L</span>
              <div className={`flex items-center space-x-1 ${isProfitable ? 'text-green-400' : 'text-red-400'}`}>
                {isProfitable ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                <span className="font-bold">
                  ${Math.abs(position.pnl).toFixed(2)} ({position.pnlPercent.toFixed(1)}%)
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}