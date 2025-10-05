// src/components/market-detail/CurrentPosition.tsx
'use client';
import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Wallet, Loader2, AlertCircle } from 'lucide-react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { motion } from 'framer-motion';
import { Market } from '@/types/market';
import { getUserBalances } from '@/lib/aptos_service';

interface UserPosition {
  yesTokens: number;
  noTokens: number;
  totalInvested: number;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
}

export default function CurrentPosition({ market }: { market: Market }) {
  const { account, connected } = useWallet();
  
  // Position state
  const [position, setPosition] = useState<UserPosition | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load user position when wallet connects or market changes
  useEffect(() => {
    const loadUserPosition = async () => {
      if (!connected || !account?.address) {
        setPosition(null);
        return;
      }

      // Skip loading for mock markets (use mock data)
      if (market.id.startsWith('mock-')) {
        const mockPosition: UserPosition = {
          yesTokens: 15.5,
          noTokens: 8.2,
          totalInvested: 23.7,
          currentValue: 28.4,
          pnl: 4.7,
          pnlPercent: 19.8,
        };
        setPosition(mockPosition);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Load real user balances from contract
        const balances = await getUserBalances(
          account.address.toString(),
          market.poolAddress
        );

        if (!balances) {
          throw new Error('Failed to fetch user balances');
        }

        // Convert from u64 string to numbers (8 decimals)
        const yesTokens = parseFloat(balances.yes) / Math.pow(10, 8) || 0;
        const noTokens = parseFloat(balances.no) / Math.pow(10, 8) || 0;

        // Calculate position value based on current market probability
        // For simplicity, assume each token is worth its probability of winning
        const yesValue = yesTokens * (market.probability / 100);
        const noValue = noTokens * ((100 - market.probability) / 100);
        const currentValue = yesValue + noValue;

        // For now, we'll estimate total invested as current value (since we don't track purchase history)
        // In a real implementation, you'd track this in the contract or a separate database
        const totalInvested = currentValue; // Simplified assumption
        const pnl = currentValue - totalInvested;
        const pnlPercent = totalInvested > 0 ? (pnl / totalInvested) * 100 : 0;

        const userPosition: UserPosition = {
          yesTokens,
          noTokens,
          totalInvested,
          currentValue,
          pnl,
          pnlPercent,
        };

        setPosition(userPosition);
      } catch (error) {
        console.error('Error loading user position:', error);
        setError('Failed to load position data');
      } finally {
        setIsLoading(false);
      }
    };

    loadUserPosition();
  }, [connected, account?.address, market]);

  const isProfitable = position ? position.pnl > 0 : false;

  // Not connected state
  if (!connected) {
    return (
      <div className="sticky top-24">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-pink-500/10 to-purple-500/10 rounded-3xl blur-xl"></div>
          <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-6">
            <h4 className="text-xl font-bold mb-6 font-[family-name:var(--font-geist-mono)]">
              Your Position
            </h4>
            <div className="text-center py-8">
              <Wallet className="w-12 h-12 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400 mb-2">Connect your wallet</p>
              <p className="text-sm text-gray-500">to view your position in this market</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="sticky top-24">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-pink-500/10 to-purple-500/10 rounded-3xl blur-xl"></div>
          <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-6">
            <h4 className="text-xl font-bold mb-6 font-[family-name:var(--font-geist-mono)]">
              Your Position
            </h4>
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-4" />
              <p className="text-gray-400">Loading position...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="sticky top-24">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-pink-500/10 to-purple-500/10 rounded-3xl blur-xl"></div>
          <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-6">
            <h4 className="text-xl font-bold mb-6 font-[family-name:var(--font-geist-mono)]">
              Your Position
            </h4>
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <p className="text-red-400 mb-2">Error loading position</p>
              <p className="text-sm text-gray-500">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // No position state
  if (!position || (position.yesTokens === 0 && position.noTokens === 0)) {
    return (
      <div className="sticky top-24">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-pink-500/10 to-purple-500/10 rounded-3xl blur-xl"></div>
          <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-6">
            <h4 className="text-xl font-bold mb-6 font-[family-name:var(--font-geist-mono)]">
              Your Position
            </h4>
            <div className="text-center py-8">
              <TrendingUp className="w-12 h-12 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400 mb-2">No position yet</p>
              <p className="text-sm text-gray-500">Start trading to build your position</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Position data state
  return (
    <div className="sticky top-24">
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-pink-500/10 to-purple-500/10 rounded-3xl blur-xl"></div>
        <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-xl font-bold font-[family-name:var(--font-geist-mono)]">
              Your Position
            </h4>
            {market.id.startsWith('mock-') && (
              <span className="text-xs text-yellow-400 bg-yellow-500/10 px-2 py-1 rounded">
                Demo Data
              </span>
            )}
          </div>

          {/* Token Holdings */}
          <div className="space-y-3 mb-6">
            <motion.div 
              className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/30 rounded-xl"
              whileHover={{ scale: 1.02 }}
            >
              <span className="text-sm text-gray-400">YES Tokens</span>
              <span className="text-lg font-bold text-white">{position.yesTokens.toFixed(2)}</span>
            </motion.div>
            <motion.div 
              className="flex items-center justify-between p-3 bg-red-500/10 border border-red-500/30 rounded-xl"
              whileHover={{ scale: 1.02 }}
            >
              <span className="text-sm text-gray-400">NO Tokens</span>
              <span className="text-lg font-bold text-white">{position.noTokens.toFixed(2)}</span>
            </motion.div>
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
                  ${Math.abs(position.pnl).toFixed(2)} ({Math.abs(position.pnlPercent).toFixed(1)}%)
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}