// src/components/market-detail/MarketChart.tsx
'use client';
import { useState } from 'react';
import { TrendingUp } from 'lucide-react';

export default function MarketChart({ marketId }: { marketId: string }) {
  const [timeframe, setTimeframe] = useState<'1H' | '24H' | '7D' | '30D' | 'ALL'>('24H');

  return (
    <div className="relative">
      <div className="absolute inset-0 bg-gradient-to-r from-pink-500/5 via-purple-500/5 to-cyan-500/5 rounded-3xl blur-2xl"></div>
      <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <TrendingUp className="w-6 h-6 text-purple-400" />
            <h3 className="text-2xl font-bold font-[family-name:var(--font-geist-mono)]">
              Price History
            </h3>
          </div>
          
          {/* Timeframe Selector */}
          <div className="flex space-x-2">
            {(['1H', '24H', '7D', '30D', 'ALL'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                  timeframe === tf
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                    : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* Chart Placeholder */}
        <div className="h-80 bg-black/30 rounded-2xl flex items-center justify-center relative overflow-hidden">
          {/* Mock Chart Line */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 800 320">
            <path
              d="M 0 200 Q 100 180, 200 160 T 400 140 T 600 120 T 800 100"
              fill="none"
              stroke="url(#chartGradient)"
              strokeWidth="3"
              className="animate-draw"
            />
            <defs>
              <linearGradient id="chartGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ec4899" />
                <stop offset="50%" stopColor="#a855f7" />
                <stop offset="100%" stopColor="#06b6d4" />
              </linearGradient>
            </defs>
          </svg>
          
          <div className="relative z-10 text-center">
            <div className="text-6xl font-bold bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-400 text-transparent bg-clip-text mb-2">
              67%
            </div>
            <div className="text-gray-400">Current Probability</div>
          </div>
        </div>

        {/* Chart Legend */}
        <div className="flex items-center justify-center space-x-6 mt-6 text-sm text-gray-400">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-green-500 to-emerald-500"></div>
            <span>YES Price</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-red-500 to-rose-500"></div>
            <span>NO Price</span>
          </div>
        </div>
      </div>
    </div>
  );
}