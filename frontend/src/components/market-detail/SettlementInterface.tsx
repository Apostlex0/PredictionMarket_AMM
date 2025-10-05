// src/components/market-detail/SettlementInterface.tsx
'use client';
import { useState, useEffect } from 'react';
import { Coins, TrendingUp, CheckCircle, AlertTriangle, Loader2, Wallet, Gift } from 'lucide-react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { motion } from 'framer-motion';
import { Market } from '@/types/market';
import { getUserBalances, buildSettleTokensPayload } from '@/lib/aptos_service';

interface SettlementInterfaceProps {
  market: Market;
  onSettlementComplete?: () => void;
}

interface UserBalances {
  yesTokens: number;
  noTokens: number;
  totalValue: number;
  winningTokens: number;
  losingTokens: number;
  potentialPayout: number;
}

export default function SettlementInterface({ market, onSettlementComplete }: SettlementInterfaceProps) {
  const { account, connected, signAndSubmitTransaction } = useWallet();
  
  // Component state
  const [balances, setBalances] = useState<UserBalances | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingBalances, setIsLoadingBalances] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Clear messages after delay
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Load user balances
  useEffect(() => {
    const loadBalances = async () => {
      if (!connected || !account || !market.resolved) {
        setIsLoadingBalances(false);
        return;
      }

      try {
        setIsLoadingBalances(true);

        // For mock markets, use demo data
        if (market.id.startsWith('mock-')) {
          const mockBalances: UserBalances = {
            yesTokens: 150,
            noTokens: 75,
            totalValue: 225,
            winningTokens: market.outcome ? 150 : 75,
            losingTokens: market.outcome ? 75 : 150,
            potentialPayout: (market.outcome ? 150 : 75) * 0.01, // 1 token = 100 octas = 0.01 APT
          };
          setBalances(mockBalances);
          return;
        }

        // Load real balances from contract
        const userBalances = await getUserBalances(
          account.address.toString(),
          market.poolAddress
        );

        if (userBalances) {
          const yesTokens = parseFloat(userBalances.yes) / Math.pow(10, 8);
          const noTokens = parseFloat(userBalances.no) / Math.pow(10, 8);
          const winningTokens = market.outcome ? yesTokens : noTokens;
          const losingTokens = market.outcome ? noTokens : yesTokens;
          const potentialPayout = winningTokens * 0.01; // 1 token = 100 octas = 0.01 APT

          setBalances({
            yesTokens,
            noTokens,
            totalValue: yesTokens + noTokens,
            winningTokens,
            losingTokens,
            potentialPayout,
          });
        }
      } catch (error) {
        console.error('Error loading balances:', error);
        setError('Failed to load token balances');
      } finally {
        setIsLoadingBalances(false);
      }
    };

    loadBalances();
  }, [connected, account, market]);

  const handleSettle = async () => {
    if (!connected || !account || !balances) {
      setError('Please connect wallet and ensure balances are loaded');
      return;
    }

    if (balances.totalValue === 0) {
      setError('No tokens to settle');
      return;
    }

    // Skip settlement for mock markets (just show success)
    if (market.id.startsWith('mock-')) {
      setIsLoading(true);
      setTimeout(() => {
        setIsLoading(false);
        setSuccessMessage(`Demo settlement complete! You would receive ${balances.potentialPayout.toFixed(4)} APT`);
        setShowConfirmation(false);
        onSettlementComplete?.();
      }, 2000);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setSuccessMessage(null);

      // Convert token amounts to u64 (with 8 decimals)
      const yesAmountU64 = (balances.yesTokens * Math.pow(10, 8)).toString();
      const noAmountU64 = (balances.noTokens * Math.pow(10, 8)).toString();

      // Build settlement transaction
      const payload = buildSettleTokensPayload(
        market.poolAddress,
        yesAmountU64,
        noAmountU64
      );

      // Submit transaction
      await signAndSubmitTransaction({
        sender: account.address,
        data: payload
      });

      setSuccessMessage(`Settlement successful! You received ${balances.potentialPayout.toFixed(4)} APT`);
      setShowConfirmation(false);
      onSettlementComplete?.();
    } catch (error) {
      console.error('Error settling tokens:', error);
      setError(error instanceof Error ? error.message : 'Failed to settle tokens');
    } finally {
      setIsLoading(false);
    }
  };

  // Don't show if market is not resolved
  if (!market.resolved) {
    return null;
  }

  // Not connected state
  if (!connected) {
    return (
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-3xl blur-xl"></div>
        <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-6">
          <div className="flex items-center space-x-3 mb-6">
            <Gift className="w-6 h-6 text-green-400" />
            <h3 className="text-xl font-bold text-white">Claim Winnings</h3>
          </div>
          <div className="text-center py-8">
            <Wallet className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400 mb-2">Connect your wallet</p>
            <p className="text-sm text-gray-500">to claim your winnings from this resolved market</p>
          </div>
        </div>
      </div>
    );
  }

  // Loading balances state
  if (isLoadingBalances) {
    return (
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-3xl blur-xl"></div>
        <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-6">
          <div className="flex items-center space-x-3 mb-6">
            <Gift className="w-6 h-6 text-green-400" />
            <h3 className="text-xl font-bold text-white">Claim Winnings</h3>
          </div>
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 text-green-400 animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Loading your token balances...</p>
          </div>
        </div>
      </div>
    );
  }

  // No tokens to settle
  if (!balances || balances.totalValue === 0) {
    return (
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-gray-500/10 to-slate-500/10 rounded-3xl blur-xl"></div>
        <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-6">
          <div className="flex items-center space-x-3 mb-6">
            <Gift className="w-6 h-6 text-gray-400" />
            <h3 className="text-xl font-bold text-white">Claim Winnings</h3>
          </div>
          <div className="text-center py-8">
            <Coins className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400 mb-2">No tokens to settle</p>
            <p className="text-sm text-gray-500">You don&apos;t have any tokens in this market</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-3xl blur-xl"></div>
      <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-6">
        <div className="flex items-center space-x-3 mb-6">
          <Gift className="w-6 h-6 text-green-400" />
          <h3 className="text-xl font-bold text-white">Claim Winnings</h3>
        </div>

        {/* Market Outcome */}
        <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-2xl">
          <div className="text-center">
            <div className="text-sm text-green-300 mb-2">Market Resolved</div>
            <div className="text-2xl font-bold text-white mb-2">
              {market.outcome ? 'YES' : 'NO'} Wins!
            </div>
            <div className="text-sm text-gray-400">
              {market.outcome ? 'YES' : 'NO'} tokens can now be redeemed for APT collateral
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <motion.div 
            className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center space-x-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <span className="text-sm text-red-300">{error}</span>
          </motion.div>
        )}

        {/* Success Message */}
        {successMessage && (
          <motion.div 
            className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-xl flex items-center space-x-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <CheckCircle className="w-5 h-5 text-green-400" />
            <span className="text-sm text-green-300">{successMessage}</span>
          </motion.div>
        )}

        {!showConfirmation ? (
          <>
            {/* Token Balances */}
            <div className="mb-6 space-y-3">
              <div className="text-sm text-gray-400 mb-3">Your Token Holdings:</div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className={`p-4 rounded-xl border ${
                  market.outcome 
                    ? 'bg-green-500/10 border-green-500/30' 
                    : 'bg-gray-500/10 border-gray-500/30'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">YES Tokens</span>
                    {market.outcome && <CheckCircle className="w-4 h-4 text-green-400" />}
                  </div>
                  <div className="text-2xl font-bold text-white">{balances.yesTokens.toFixed(2)}</div>
                  {market.outcome && (
                    <div className="text-xs text-green-400">Winning tokens!</div>
                  )}
                </div>

                <div className={`p-4 rounded-xl border ${
                  !market.outcome 
                    ? 'bg-green-500/10 border-green-500/30' 
                    : 'bg-gray-500/10 border-gray-500/30'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">NO Tokens</span>
                    {!market.outcome && <CheckCircle className="w-4 h-4 text-green-400" />}
                  </div>
                  <div className="text-2xl font-bold text-white">{balances.noTokens.toFixed(2)}</div>
                  {!market.outcome && (
                    <div className="text-xs text-green-400">Winning tokens!</div>
                  )}
                </div>
              </div>
            </div>

            {/* Settlement Summary */}
            <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-2xl">
              <div className="text-sm text-blue-300 mb-3">Settlement Summary:</div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Winning Tokens:</span>
                  <span className="text-white font-semibold">{balances.winningTokens.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Losing Tokens:</span>
                  <span className="text-gray-500">{balances.losingTokens.toFixed(2)}</span>
                </div>
                <div className="border-t border-blue-500/30 pt-2 mt-2">
                  <div className="flex justify-between">
                    <span className="text-blue-300 font-semibold">APT Payout:</span>
                    <span className="text-green-400 font-bold">{balances.potentialPayout.toFixed(4)} APT</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Settlement Button */}
            <motion.button
              onClick={() => setShowConfirmation(true)}
              className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-xl font-bold transition-all duration-300"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex items-center justify-center space-x-2">
                <Gift className="w-5 h-5" />
                <span>Claim {balances.potentialPayout.toFixed(4)} APT</span>
              </div>
            </motion.button>

            {/* Info */}
            <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-yellow-300">
                <div className="font-semibold mb-1">Settlement Process:</div>
                <div>
                  All your tokens (winning + losing) will be burned. You&apos;ll receive APT collateral only for winning tokens (1 token = 100 octas).
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Confirmation */}
            <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-2xl">
              <div className="text-center">
                <div className="text-lg font-bold text-white mb-2">Confirm Settlement</div>
                <div className="text-green-300 mb-4">
                  You are about to settle your entire position:
                </div>
                <div className="space-y-2 mb-4">
                  <div className="text-sm text-gray-400">
                    Burn: {balances.yesTokens.toFixed(2)} YES + {balances.noTokens.toFixed(2)} NO tokens
                  </div>
                  <div className="text-xl font-bold text-green-400">
                    Receive: {balances.potentialPayout.toFixed(4)} APT
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  This action is permanent and cannot be reversed.
                </div>
              </div>
            </div>

            {/* Confirmation Buttons */}
            <div className="grid grid-cols-2 gap-4">
              <motion.button
                onClick={() => setShowConfirmation(false)}
                disabled={isLoading}
                className="py-3 px-4 bg-gray-600 hover:bg-gray-700 text-white rounded-xl font-medium transition-all duration-300"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Cancel
              </motion.button>

              <motion.button
                onClick={handleSettle}
                disabled={isLoading}
                className={`py-3 px-4 rounded-xl font-medium transition-all duration-300 ${
                  isLoading
                    ? 'bg-gray-600 cursor-not-allowed'
                    : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white'
                }`}
                whileHover={!isLoading ? { scale: 1.02 } : {}}
                whileTap={!isLoading ? { scale: 0.98 } : {}}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Settling...</span>
                  </div>
                ) : (
                  'Confirm Settlement'
                )}
              </motion.button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
