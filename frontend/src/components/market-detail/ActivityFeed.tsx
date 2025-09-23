// src/components/market-detail/ActivityFeed.tsx
'use client';
import { ArrowRightLeft, Plus, Minus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function ActivityFeed({ marketId }: { marketId: string }) {
  const activities = [
    {
      type: 'swap' as const,
      user: '0x742d...8f9a',
      action: 'Swapped 10 NO for 15 YES',
      timestamp: new Date(Date.now() - 1000 * 60 * 5),
      amount: 10,
    },
    {
      type: 'add' as const,
      user: '0x3b5c...2d1e',
      action: 'Added liquidity',
      timestamp: new Date(Date.now() - 1000 * 60 * 15),
      amount: 50,
    },
    {
      type: 'swap' as const,
      user: '0x9a1f...4c8b',
      action: 'Swapped 25 YES for 18 NO',
      timestamp: new Date(Date.now() - 1000 * 60 * 30),
      amount: 25,
    },
    {
      type: 'remove' as const,
      user: '0x6e2d...7a3f',
      action: 'Removed liquidity',
      timestamp: new Date(Date.now() - 1000 * 60 * 45),
      amount: 30,
    },
  ];

  const getActivityIcon = (type: 'swap' | 'add' | 'remove') => {
    switch (type) {
      case 'swap':
        return <ArrowRightLeft className="w-4 h-4" />;
      case 'add':
        return <Plus className="w-4 h-4" />;
      case 'remove':
        return <Minus className="w-4 h-4" />;
    }
  };

  const getActivityColor = (type: 'swap' | 'add' | 'remove') => {
    switch (type) {
      case 'swap':
        return 'from-purple-500 to-pink-500';
      case 'add':
        return 'from-cyan-500 to-blue-500';
      case 'remove':
        return 'from-orange-500 to-red-500';
    }
  };

  return (
    <div>
      <h3 className="text-2xl font-bold mb-6 font-[family-name:var(--font-geist-mono)]">
        Recent Activity
      </h3>
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl overflow-hidden">
        <div className="divide-y divide-white/10">
          {activities.map((activity, idx) => (
            <div key={idx} className="p-6 hover:bg-white/5 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  <div className={`p-2 rounded-xl bg-gradient-to-r ${getActivityColor(activity.type)}`}>
                    {getActivityIcon(activity.type)}
                  </div>
                  <div>
                    <div className="text-white font-medium mb-1">{activity.action}</div>
                    <div className="text-sm text-gray-500">by {activity.user}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-white font-semibold mb-1">${activity.amount}</div>
                  <div className="text-xs text-gray-500">
                    {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}