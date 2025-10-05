// src/components/market-detail/MarketResolution.tsx
'use client';
import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Loader2, Shield, Clock } from 'lucide-react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { motion } from 'framer-motion';
import { Market } from '@/types/market';
import { buildResolveMarketPayload } from '@/lib/aptos_service';

interface MarketResolutionProps {
  market: Market;
  onResolutionComplete?: () => void;
}

export default function MarketResolution({ market, onResolutionComplete }: MarketResolutionProps) {
  const { account, connected, signAndSubmitTransaction } = useWallet();
  
  // Component state
  const [selectedOutcome, setSelectedOutcome] = useState<boolean | null>(null);
  const [isResolving, setIsResolving] = useState(false);
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

  // Check if user can resolve this market
  const canResolve = connected && account && (
    // Market creator can resolve
    market.creator === account.address.toString() ||
    // For demo purposes, allow any connected user to resolve mock markets
    market.id.startsWith('mock-')
  );

  // Check if market is expired
  const isExpired = market.expiresAt && new Date(market.expiresAt) < new Date();

  const handleOutcomeSelect = (outcome: boolean) => {
    setSelectedOutcome(outcome);
    setShowConfirmation(true);
  };

  const handleResolve = async () => {
    if (!connected || !account || selectedOutcome === null) {
      setError('Please connect wallet and select an outcome');
      return;
    }

    if (!canResolve) {
      setError('You are not authorized to resolve this market');
      return;
    }

    // Skip resolution for mock markets (just show success)
    if (market.id.startsWith('mock-')) {
      setIsResolving(true);
      setTimeout(() => {
        setIsResolving(false);
        setSuccessMessage(`Demo market resolved: ${selectedOutcome ? 'YES' : 'NO'} wins!`);
        setShowConfirmation(false);
        setSelectedOutcome(null);
        onResolutionComplete?.();
      }, 2000);
      return;
    }

    try {
      setIsResolving(true);
      setError(null);
      setSuccessMessage(null);

      // Build resolution transaction
      const payload = buildResolveMarketPayload(
        market.poolAddress,
        selectedOutcome
      );

      // Submit transaction
      await signAndSubmitTransaction({
        sender: account.address,
        data: payload
      });

      setSuccessMessage(`Market resolved successfully! ${selectedOutcome ? 'YES' : 'NO'} wins.`);
      setShowConfirmation(false);
      setSelectedOutcome(null);
      onResolutionComplete?.();
    } catch (error) {
      console.error('Error resolving market:', error);
      setError(error instanceof Error ? error.message : 'Failed to resolve market');
    } finally {
      setIsResolving(false);
    }
  };

  // Don't show if market is already resolved
  if (market.resolved) {
    return (
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-3xl blur-xl"></div>
        <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-6">
          <div className="flex items-center space-x-3 mb-4">
            <CheckCircle className="w-6 h-6 text-green-400" />
            <h3 className="text-xl font-bold text-white">Market Resolved</h3>
          </div>
          <div className="text-center py-4">
            <div className="text-2xl font-bold text-white mb-2">
              {market.outcome ? 'YES' : 'NO'} Wins!
            </div>
            <div className="text-sm text-gray-400">
              This market has been resolved and tokens can now be redeemed.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Don't show if user can't resolve
  if (!canResolve) {
    return null;
  }

  return (
    <div className="relative">
      <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-red-500/10 rounded-3xl blur-xl"></div>
      <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Shield className="w-6 h-6 text-orange-400" />
            <h3 className="text-xl font-bold text-white">Resolve Market</h3>
          </div>
          {isExpired && (
            <div className="flex items-center space-x-2 text-orange-400">
              <Clock className="w-4 h-4" />
              <span className="text-sm">Expired</span>
            </div>
          )}
        </div>

        {/* Market Info */}
        <div className="mb-6 p-4 bg-orange-500/10 border border-orange-500/30 rounded-2xl">
          <div className="text-sm text-orange-300 mb-2">Market Question</div>
          <div className="text-white font-medium mb-3">{market.question}</div>
          <div className="text-xs text-gray-400">
            As the market creator, you can resolve this market by selecting the correct outcome.
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
            {/* Outcome Selection */}
            <div className="mb-6">
              <div className="text-sm text-gray-400 mb-4">Select the correct outcome:</div>
              <div className="grid grid-cols-2 gap-4">
                <motion.button
                  onClick={() => handleOutcomeSelect(true)}
                  className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl hover:bg-green-500/20 transition-all duration-300"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
                  <div className="text-lg font-bold text-white">YES</div>
                  <div className="text-sm text-green-400">The event occurred</div>
                </motion.button>

                <motion.button
                  onClick={() => handleOutcomeSelect(false)}
                  className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl hover:bg-red-500/20 transition-all duration-300"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <XCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                  <div className="text-lg font-bold text-white">NO</div>
                  <div className="text-sm text-red-400">The event did not occur</div>
                </motion.button>
              </div>
            </div>

            {/* Warning */}
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-yellow-300">
                <div className="font-semibold mb-1">Important:</div>
                <div>
                  Market resolution is permanent and cannot be undone. Please verify the outcome carefully before proceeding.
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Confirmation */}
            <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-2xl">
              <div className="text-center">
                <div className="text-lg font-bold text-white mb-2">Confirm Resolution</div>
                <div className="text-blue-300 mb-4">
                  You are about to resolve this market as:
                </div>
                <div className={`text-2xl font-bold mb-4 ${selectedOutcome ? 'text-green-400' : 'text-red-400'}`}>
                  {selectedOutcome ? 'YES WINS' : 'NO WINS'}
                </div>
                <div className="text-sm text-gray-400">
                  This action is permanent and cannot be reversed.
                </div>
              </div>
            </div>

            {/* Confirmation Buttons */}
            <div className="grid grid-cols-2 gap-4">
              <motion.button
                onClick={() => {
                  setShowConfirmation(false);
                  setSelectedOutcome(null);
                }}
                disabled={isResolving}
                className="py-3 px-4 bg-gray-600 hover:bg-gray-700 text-white rounded-xl font-medium transition-all duration-300"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Cancel
              </motion.button>

              <motion.button
                onClick={handleResolve}
                disabled={isResolving}
                className={`py-3 px-4 rounded-xl font-medium transition-all duration-300 ${
                  isResolving
                    ? 'bg-gray-600 cursor-not-allowed'
                    : 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white'
                }`}
                whileHover={!isResolving ? { scale: 1.02 } : {}}
                whileTap={!isResolving ? { scale: 0.98 } : {}}
              >
                {isResolving ? (
                  <div className="flex items-center justify-center space-x-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Resolving...</span>
                  </div>
                ) : (
                  'Confirm Resolution'
                )}
              </motion.button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
