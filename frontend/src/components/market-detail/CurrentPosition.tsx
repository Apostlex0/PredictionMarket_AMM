'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Loader2, TrendingUp, Wallet } from 'lucide-react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { motion } from 'framer-motion';
import { Market } from '@/types/market';
import { getUserBalances } from '@/lib/aptos_service';
import { formatOutcome } from '@/lib/amounts';

interface UserHoldings {
  yesRaw: string;
  noRaw: string;
}

export default function CurrentPosition({ market }: { market: Market }) {
  const { account, connected } = useWallet();

  const [holdings, setHoldings] = useState<UserHoldings | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadUserHoldings = async () => {
      if (!connected || !account?.address) {
        setHoldings(null);
        setError(null);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const balances = await getUserBalances(
          account.address.toString(),
          market.poolAddress
        );

        if (!balances) {
          throw new Error('Balance view returned no data');
        }

        setHoldings({
          yesRaw: balances.yes,
          noRaw: balances.no,
        });
      } catch (loadError) {
        console.error('Error loading outcome token holdings:', loadError);
        setHoldings(null);
        setError('Failed to load on-chain token holdings.');
      } finally {
        setIsLoading(false);
      }
    };

    void loadUserHoldings();
  }, [connected, account?.address, market.poolAddress]);

  if (!connected) {
    return (
      <PositionShell>
        <div className="text-center py-8">
          <Wallet className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400 mb-2">Connect your wallet</p>
          <p className="text-sm text-gray-500">to view your outcome tokens</p>
        </div>
      </PositionShell>
    );
  }

  if (isLoading) {
    return (
      <PositionShell>
        <div className="text-center py-8">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading holdings...</p>
        </div>
      </PositionShell>
    );
  }

  if (error) {
    return (
      <PositionShell>
        <div className="text-center py-8">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-400 mb-2">Unable to load holdings</p>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </PositionShell>
    );
  }

  if (!holdings || (BigInt(holdings.yesRaw) === 0n && BigInt(holdings.noRaw) === 0n)) {
    return (
      <PositionShell>
        <div className="text-center py-8">
          <TrendingUp className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400 mb-2">No outcome tokens held</p>
          <p className="text-sm text-gray-500">Mint or trade to receive YES or NO tokens.</p>
        </div>
      </PositionShell>
    );
  }

  return (
    <PositionShell>
      <div className="text-xs text-gray-500 uppercase tracking-wide mb-3">
        On-chain Outcome Token Holdings
      </div>

      <div className="space-y-3">
        <motion.div
          className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/30 rounded-xl"
          whileHover={{ scale: 1.02 }}
        >
          <span className="text-sm text-gray-400">YES Tokens</span>
          <span className="text-lg font-bold text-white">
            {formatOutcome(holdings.yesRaw)}
          </span>
        </motion.div>

        <motion.div
          className="flex items-center justify-between p-3 bg-red-500/10 border border-red-500/30 rounded-xl"
          whileHover={{ scale: 1.02 }}
        >
          <span className="text-sm text-gray-400">NO Tokens</span>
          <span className="text-lg font-bold text-white">
            {formatOutcome(holdings.noRaw)}
          </span>
        </motion.div>
      </div>

      <div className="mt-5 pt-4 border-t border-white/10 text-xs text-gray-500">
        The protocol does not track cost basis or P&amp;L on-chain, so this view displays token holdings only.
      </div>
    </PositionShell>
  );
}

function PositionShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky top-24">
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-pink-500/10 to-purple-500/10 rounded-3xl blur-xl" />
        <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-6">
          <h4 className="text-xl font-bold mb-6 font-[family-name:var(--font-geist-mono)]">
            Your Position
          </h4>
          {children}
        </div>
      </div>
    </div>
  );
}