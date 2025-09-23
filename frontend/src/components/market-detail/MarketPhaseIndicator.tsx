// src/components/market-detail/MarketPhaseIndicator.tsx
'use client';
import { Clock, CheckCircle, XCircle } from 'lucide-react';
import { formatDistanceToNow, isPast } from 'date-fns';

export default function MarketPhaseIndicator({
  expiresAt,
  resolved,
  outcome,
}: {
  expiresAt: Date;
  resolved: boolean;
  outcome?: boolean;
}) {
  const isExpired = isPast(expiresAt);
  
  if (resolved) {
    return (
      <div className="mb-8 p-4 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-2xl">
        <div className="flex items-center space-x-3">
          <CheckCircle className="w-6 h-6 text-green-400" />
          <div>
            <div className="text-lg font-semibold text-green-400">Market Resolved</div>
            <div className="text-sm text-gray-400">
              Outcome: <span className="font-semibold text-white">
                {outcome ? 'YES' : 'NO'}
              </span> tokens can be redeemed for $1
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isExpired) {
    return (
      <div className="mb-8 p-4 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-2xl">
        <div className="flex items-center space-x-3">
          <Clock className="w-6 h-6 text-yellow-400" />
          <div>
            <div className="text-lg font-semibold text-yellow-400">Market Expired</div>
            <div className="text-sm text-gray-400">
              Waiting for oracle to resolve the outcome
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8 p-4 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/30 rounded-2xl">
      <div className="flex items-center space-x-3">
        <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse"></div>
        <div>
          <div className="text-lg font-semibold text-blue-400">Market Active</div>
          <div className="text-sm text-gray-400">
            Trading closes {formatDistanceToNow(expiresAt, { addSuffix: true })}
          </div>
        </div>
      </div>
    </div>
  );
}