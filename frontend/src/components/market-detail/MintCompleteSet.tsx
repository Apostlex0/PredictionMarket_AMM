// src/components/market-detail/MintCompleteSet.tsx
'use client';
import { useState, useEffect } from 'react';
import { Coins, Info, Loader2, AlertCircle, Wallet } from 'lucide-react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { motion } from 'framer-motion';
import { Market } from '@/types/market';
import { buildMintTokensPayload } from '@/lib/aptos_service';

export default function MintCompleteSet({ market }: { market: Market }) {
  const { account, connected, signAndSubmitTransaction } = useWallet();
  
  // Form state
  const [aptAmount, setAptAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
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

  // Calculate token amounts based on new contract ratio
  const calculateTokenAmounts = (aptInput: string) => {
    if (!aptInput || parseFloat(aptInput) <= 0) return { tokens: '0.00', octas: 0 };
    
    const aptValue = parseFloat(aptInput);
    const octas = Math.floor(aptValue * 100000000); // Convert APT to octas (1 APT = 10^8 octas)
    const tokens = octas / 100; // 100 octas = 1 token
    
    return { 
      tokens: tokens.toFixed(2), 
      octas 
    };
  };

  const { tokens: tokenAmount, octas } = calculateTokenAmounts(aptAmount);
  const isValidAmount = octas >= 100; // Minimum 100 octas required

  const handleMint = async () => {
    if (!connected || !account) {
      setError('Please connect your wallet');
      return;
    }

    if (!aptAmount || parseFloat(aptAmount) <= 0) {
      setError('Please enter a valid APT amount');
      return;
    }

    if (!isValidAmount) {
      setError('Minimum amount is 0.000001 APT (100 octas)');
      return;
    }

    // Skip minting for mock markets
    if (market.id.startsWith('mock-')) {
      setError('Cannot mint tokens for demo markets');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setSuccessMessage(null);

      // Build transaction payload
      const payload = buildMintTokensPayload(
        market.poolAddress,
        octas.toString()
      );

      // Submit transaction
      await signAndSubmitTransaction({
        sender: account.address,
        data: payload
      });

      setSuccessMessage(`Successfully minted ${tokenAmount} YES and ${tokenAmount} NO tokens!`);
      setAptAmount('');
    } catch (error) {
      console.error('Error minting tokens:', error);
      setError(error instanceof Error ? error.message : 'Failed to mint tokens');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative">
      <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10 rounded-3xl blur-2xl"></div>
      <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8">
        <div className="flex items-center space-x-3 mb-6">
          <Coins className="w-6 h-6 text-cyan-400" />
          <h3 className="text-2xl font-bold font-[family-name:var(--font-geist-mono)]">
            Mint Complete Set
          </h3>
        </div>

        {/* Explanation */}
        <div className="mb-6 p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl">
          <p className="text-sm text-gray-300 leading-relaxed">
            Deposit APT to mint prediction tokens. <span className="font-semibold text-white">100 octas = 1 token</span> (1 APT = 1,000,000 tokens). 
            Each APT creates equal amounts of YES and NO tokens backed by collateral.
          </p>
        </div>

        {/* Mock Market Warning */}
        {market.id.startsWith('mock-') && (
          <motion.div 
            className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center space-x-3">
              <AlertCircle className="w-5 h-5 text-yellow-400" />
              <div>
                <div className="font-semibold text-yellow-400 mb-1">Demo Market</div>
                <div className="text-sm text-yellow-300">
                  This is a demo market. Token minting is disabled for presentation purposes.
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Error Message */}
        {error && (
          <motion.div 
            className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center space-x-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <AlertCircle className="w-5 h-5 text-red-400" />
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
            <div className="w-5 h-5 bg-green-400 rounded-full flex items-center justify-center">
              <div className="w-2 h-2 bg-white rounded-full"></div>
            </div>
            <span className="text-sm text-green-300">{successMessage}</span>
          </motion.div>
        )}

        {/* Amount Input */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">APT Amount to Deposit</span>
            <span className="text-sm text-gray-400">Wallet: 0.00 APT</span>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <input
                type="number"
                value={aptAmount}
                onChange={(e) => setAptAmount(e.target.value)}
                placeholder="0.00"
                className="bg-transparent text-3xl font-bold text-white outline-none w-full"
                min="0"
                step="0.00000001"
              />
              <div className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl font-bold">
                APT
              </div>
            </div>
          </div>
        </div>

        {/* Output Display */}
        <div className="mb-6 p-4 bg-white/5 rounded-2xl">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-gray-400">You will receive:</div>
            {aptAmount && (
              <div className="text-xs text-gray-500">
                {octas.toLocaleString()} octas → {tokenAmount} tokens each
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <motion.div 
              className="p-3 bg-green-500/10 border border-green-500/30 rounded-xl"
              whileHover={{ scale: 1.02 }}
            >
              <div className="text-2xl font-bold text-white mb-1">{tokenAmount}</div>
              <div className="text-sm text-green-400">YES tokens</div>
            </motion.div>
            <motion.div 
              className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl"
              whileHover={{ scale: 1.02 }}
            >
              <div className="text-2xl font-bold text-white mb-1">{tokenAmount}</div>
              <div className="text-sm text-red-400">NO tokens</div>
            </motion.div>
          </div>
          {aptAmount && !isValidAmount && (
            <div className="mt-3 text-xs text-orange-400">
              ⚠️ Minimum amount: 0.000001 APT (100 octas)
            </div>
          )}
        </div>

        {/* Collateral Info */}
        <div className="mb-6 p-4 bg-purple-500/10 border border-purple-500/30 rounded-2xl">
          <div className="text-sm text-gray-300">
            <div className="font-semibold text-purple-400 mb-1">APT Collateral System</div>
            <div>
              Your APT is held as collateral. After market resolution, winning tokens can be redeemed 1:1 for APT.
            </div>
          </div>
        </div>

        {/* Mint Button */}
        <motion.button 
          onClick={handleMint}
          disabled={!connected || isLoading || !aptAmount || !isValidAmount || market.id.startsWith('mock-')}
          className={`w-full py-4 rounded-xl font-bold text-white transition-all duration-300 relative overflow-hidden ${
            !connected || isLoading || !aptAmount || !isValidAmount || market.id.startsWith('mock-')
              ? 'bg-gray-600 cursor-not-allowed'
              : 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600'
          }`}
          whileHover={!connected || isLoading || !aptAmount || !isValidAmount || market.id.startsWith('mock-') ? {} : { scale: 1.02 }}
          whileTap={!connected || isLoading || !aptAmount || !isValidAmount || market.id.startsWith('mock-') ? {} : { scale: 0.98 }}
        >
          <span className="relative z-10 flex items-center justify-center space-x-2">
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Minting Tokens...</span>
              </>
            ) : !connected ? (
              <>
                <Wallet className="w-5 h-5" />
                <span>Connect Wallet</span>
              </>
            ) : market.id.startsWith('mock-') ? (
              <>
                <AlertCircle className="w-5 h-5" />
                <span>Demo Market</span>
              </>
            ) : !aptAmount ? (
              <>
                <Coins className="w-5 h-5" />
                <span>Enter APT Amount</span>
              </>
            ) : !isValidAmount ? (
              <>
                <AlertCircle className="w-5 h-5" />
                <span>Minimum 0.000001 APT</span>
              </>
            ) : (
              <>
                <Coins className="w-5 h-5" />
                <span>Mint {tokenAmount} Tokens Each</span>
              </>
            )}
          </span>
        </motion.button>

        {/* Info */}
        <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-start space-x-2">
          <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-gray-400">
            Complete sets ensure YES + NO tokens are always backed 1:1 by APT. After resolution, winning tokens redeem for APT.
          </p>
        </div>
      </div>
    </div>
  );
}