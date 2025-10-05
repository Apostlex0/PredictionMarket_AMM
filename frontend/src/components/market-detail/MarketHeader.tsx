// src/components/market-detail/MarketHeader.tsx
'use client';
import { Share2, ExternalLink, Clock, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { CATEGORY_COLORS } from '@/lib/constants';
import { formatCurrency, formatNumber } from '@/lib/format';
import { Market } from '@/types/market';

export default function MarketHeader({ market }: { market: Market }) {
  const probabilityPercent = market.probability.toFixed(1);
  const categoryColor = CATEGORY_COLORS[market.category] || 'from-gray-500 to-slate-500';

  return (
    <div className="mb-8">
      {/* Category & Share */}
      <div className="flex items-center justify-between mb-4">
        <span className={`px-4 py-2 rounded-full text-sm font-semibold bg-gradient-to-r ${categoryColor} text-white`}>
          {market.category.toUpperCase()}
        </span>
        <button className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors">
          <Share2 className="w-5 h-5" />
        </button>
      </div>

      {/* Question */}
      <h1 className="text-4xl md:text-5xl font-bold mb-4 font-[family-name:var(--font-geist-mono)]">
        {market.question}
      </h1>

      {/* Description */}
      <p className="text-lg text-gray-400 mb-6 leading-relaxed">
        {market.description}
      </p>

      {/* Main Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatBox
          label="Current Probability"
          value={`${probabilityPercent}%`}
          valueClassName="text-3xl font-bold bg-gradient-to-r from-pink-400 to-purple-400 text-transparent bg-clip-text"
        />
        <StatBox
          label="24h Volume"
          value={formatCurrency(market.totalVolume)}
        />
        <StatBox
          label="Liquidity"
          value={formatCurrency(market.liquidity)}
        />
        <StatBox
          label="Traders"
          value={formatNumber(market.totalTraders)}
        />
      </div>

      {/* Secondary Info */}
      <div className="flex flex-wrap gap-4 mt-6 text-sm text-gray-500">
        <div className="flex items-center space-x-2">
          <Clock className="w-4 h-4" />
          <span>Expires {formatDistanceToNow(market.expiresAt, { addSuffix: true })}</span>
        </div>
        <div className="flex items-center space-x-2">
          <Users className="w-4 h-4" />
          <span>Created by {market.creator}</span>
        </div>
        <button className="flex items-center space-x-2 hover:text-white transition-colors">
          <ExternalLink className="w-4 h-4" />
          <span>View on Explorer</span>
        </button>
      </div>
    </div>
  );
}

function StatBox({ 
  label, 
  value, 
  valueClassName = "text-2xl font-bold text-white" 
}: { 
  label: string; 
  value: string; 
  valueClassName?: string;
}) {
  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4">
      <div className="text-sm text-gray-500 mb-1">{label}</div>
      <div className={valueClassName}>{value}</div>
    </div>
  );
}