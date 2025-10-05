// src/components/market-detail/AnalyticsTab.tsx
'use client';
import MarketChart from './MarketChart';
import MarketStats from './MarketStats';
import ActivityFeed from './ActivityFeed';
import { Market } from '@/types/market';

export default function AnalyticsTab({ market }: { market: Market }) {
  return (
    <div className="space-y-8">
      {/* Price Chart */}
      <MarketChart marketId={market.id} />

      {/* Stats Grid */}
      <MarketStats market={market} />

      {/* Activity Feed */}
      <ActivityFeed marketId={market.id} />
    </div>
  );
}