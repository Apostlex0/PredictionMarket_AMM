// src/components/market-detail/MarketStats.tsx
'use client';
import { TrendingUp, Droplets, Users, Zap, Clock, DollarSign } from 'lucide-react';
import { Market } from '@/types/market';

export default function MarketStats({ market }: { market: Market }) {
  const stats = [
    {
      icon: <TrendingUp className="w-5 h-5" />,
      label: '24h Volume',
      value: `$${(market.totalVolume / 1000).toFixed(1)}K`,
      change: '+12.5%',
      positive: true,
    },
    {
      icon: <Droplets className="w-5 h-5" />,
      label: 'Total Liquidity',
      value: `$${(market.liquidity / 1000).toFixed(1)}K`,
      change: '+5.2%',
      positive: true,
    },
    {
      icon: <Users className="w-5 h-5" />,
      label: 'Total Traders',
      value: market.totalTraders.toLocaleString(),
      change: '+8.3%',
      positive: true,
    },
    {
      icon: <Zap className="w-5 h-5" />,
      label: 'Avg LVR',
      value: '0.08%',
      change: '-12%',
      positive: true,
    },
    {
      icon: <DollarSign className="w-5 h-5" />,
      label: 'Fees Generated',
      value: '$1.2K',
      change: '+15.7%',
      positive: true,
    },
    {
      icon: <Clock className="w-5 h-5" />,
      label: 'Avg Hold Time',
      value: '2.3 days',
      change: '-5%',
      positive: false,
    },
  ];

  return (
    <div>
      <h3 className="text-2xl font-bold mb-6 font-[family-name:var(--font-geist-mono)]">
        Market Statistics
      </h3>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-gray-400">{stat.icon}</div>
              <span className={`text-sm font-medium ${stat.positive ? 'text-green-400' : 'text-red-400'}`}>
                {stat.change}
              </span>
            </div>
            <div className="text-2xl font-bold text-white mb-1">{stat.value}</div>
            <div className="text-sm text-gray-500">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}