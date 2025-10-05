// src/components/market-detail/SwapInterface.tsx
'use client';
import { useState, useEffect } from 'react';
import { ArrowDown, Info, Zap, Sparkles, TrendingUp, Activity, RotateCcw, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { Market } from '@/types/market';
import {
  getUserBalances,
  getSwapQuote,
  buildBuyYesPayload,
  buildBuyNoPayload,
  formatBalance,
  u128ToNumber
} from '@/lib/aptos_service';

interface SwapQuote {
  outputAmount: string;
  priceImpact: number;
}

interface UserBalances {
  yes: string;
  no: string;
}

export default function SwapInterface2({ market }: { market: Market }) {
  // Wallet integration
  const { account, connected, signAndSubmitTransaction } = useWallet();
  
  // Swap state
  const [fromToken, setFromToken] = useState<'YES' | 'NO'>('NO');
  const [toToken, setToToken] = useState<'YES' | 'NO'>('YES');
  const [amount, setAmount] = useState('');
  
  // Quote and balance state
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [balances, setBalances] = useState<UserBalances>({ yes: '0', no: '0' });
  
  // UI state
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [isExecutingSwap, setIsExecutingSwap] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [slippageTolerance, setSlippageTolerance] = useState(0.5); // 0.5%

  // Load user balances when wallet connects
  useEffect(() => {
    const loadBalances = async () => {
      if (!connected || !account) {
        setBalances({ yes: '0', no: '0' });
        return;
      }

      try {
        const result = await getUserBalances(
          account.address.toString(),
          market.poolAddress
        );
        
        if (result) {
          setBalances({
            yes: result.yes,
            no: result.no,
          });
        } else {
          // Mock balances for development
          setBalances({
            yes: '500000000', // 5 YES tokens (8 decimals)
            no: '300000000',  // 3 NO tokens (8 decimals)
          });
        }
      } catch (err) {
        console.error('Error loading balances:', err);
        setBalances({ yes: '500000000', no: '300000000' });
      }
    };

    loadBalances();
  }, [connected, account, market]);

  // Get swap quote when amount changes
  useEffect(() => {
    const getQuote = async () => {
      if (!amount || parseFloat(amount) <= 0 || !connected) {
        setQuote(null);
        return;
      }

      setIsLoadingQuote(true);
      setError(null);

      try {
        // Convert amount to proper units (8 decimals) using integer arithmetic to avoid floating point errors
        const amountInUnits = Math.floor(parseFloat(amount) * Math.pow(10, 8)).toString();
        
        // Determine swap direction (YES = X, NO = Y in pool)
        const isXToY = fromToken === 'YES';
        
        const result = await getSwapQuote(
          market.poolAddress,
          amountInUnits,
          isXToY
        );

        if (result) {
          setQuote({
            outputAmount: result.outputAmount,
            priceImpact: u128ToNumber(result.priceImpact),
          });
        } else {
          // Fallback to mock calculation - use integer arithmetic to avoid floating point errors
          const mockOutput = parseFloat(amount) * (fromToken === 'YES' ? (1 - market.probability) : market.probability);
          const mockOutputU64 = Math.floor(mockOutput * Math.pow(10, 8));
          setQuote({
            outputAmount: mockOutputU64.toString(),
            priceImpact: 0.025, // 2.5%
          });
        }
      } catch (err) {
        console.error('Error getting swap quote:', err);
        setError('Failed to get swap quote');
      } finally {
        setIsLoadingQuote(false);
      }
    };

    const timeoutId = setTimeout(getQuote, 300); // Debounce
    return () => clearTimeout(timeoutId);
  }, [amount, fromToken, toToken, market, connected]);

  // Execute swap transaction using contract service functions
  const handleSwap = async () => {
    if (!quote || !amount || parseFloat(amount) <= 0 || !connected || !account) {
      setError('Please connect wallet and enter valid amount');
      return;
    }

    setIsExecutingSwap(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Convert to integer units (8 decimals) - use Math.floor to avoid floating point issues
      const amountInUnits = Math.floor(parseFloat(amount) * Math.pow(10, 8)).toString();

      // Calculate minimum output with slippage using BigInt to avoid floating point errors
      // quote.outputAmount is already a u64 string (e.g., "100000000" for 1 token)
      const outputAmountBigInt = BigInt(quote.outputAmount);
      const slippageFactor = BigInt(Math.floor((100 - slippageTolerance) * 100)); // e.g., 99.5% = 9950
      const minOutputBigInt = (outputAmountBigInt * slippageFactor) / BigInt(10000);
      const minOutputWithSlippage = minOutputBigInt.toString();

      // Build transaction payload using clean builders
      const payload = fromToken === 'NO'
        ? buildBuyYesPayload(
            market.poolAddress,
            amountInUnits,
            minOutputWithSlippage
          )
        : buildBuyNoPayload(
            market.poolAddress,
            amountInUnits,
            minOutputWithSlippage
          );

      // Submit via wallet
      const response = await signAndSubmitTransaction({
        sender: account.address,
        data: payload
      });
      
      // Success - reset form and show success message
      setAmount('');
      setQuote(null);
      setSuccessMessage(`Successfully swapped ${amount} ${fromToken} tokens!`);
      
      // Refresh balances after successful swap
      setTimeout(async () => {
        if (connected && account) {
          try {
            const result = await getUserBalances(
              account.address.toString(),
              market.poolAddress
            );
            
            if (result) {
              setBalances({
                yes: result.yes,
                no: result.no,
              });
            }
          } catch (err) {
            console.error('Error refreshing balances:', err);
          }
        }
      }, 2000);
      
    } catch (err: unknown) {
      console.error('Error executing swap:', err);
      setError(err instanceof Error ? err.message : 'Failed to execute swap');
    } finally {
      setIsExecutingSwap(false);
    }
  };

  // Helper functions
  const formatBalance = (balance: string): string => {
    return (parseFloat(balance) / Math.pow(10, 8)).toFixed(2);
  };

  const formatOutput = (outputAmount: string): string => {
    return (parseFloat(outputAmount) / Math.pow(10, 8)).toFixed(4);
  };

  const getCurrentBalance = (): string => {
    return fromToken === 'YES' ? balances.yes : balances.no;
  };

  const isInsufficientBalance = (): boolean => {
    if (!amount || !connected) return false;
    const requiredAmount = parseFloat(amount) * Math.pow(10, 8);
    const availableBalance = parseFloat(getCurrentBalance());
    return requiredAmount > availableBalance;
  };

  const handleSwapDirection = () => {
    const newFromToken = toToken;
    const newToToken = fromToken;
    setFromToken(newFromToken);
    setToToken(newToToken);
    setAmount('');
    setQuote(null);
  };

  // Clear messages after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  return (
    <motion.div 
      className="relative"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
    >
      {/* Enhanced Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-blue-500/10 to-purple-500/10 rounded-3xl blur-3xl animate-pulse"></div>
      <div className="absolute inset-0 bg-gradient-to-tr from-pink-500/5 via-transparent to-cyan-500/5 rounded-3xl"></div>
      
      <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl">
        {/* Enhanced Header */}
        <motion.div 
          className="flex items-center justify-between mb-6"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="flex items-center space-x-3">
            <motion.div
              className="p-2 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-xl border border-cyan-400/30"
              whileHover={{ rotate: 360, scale: 1.1 }}
              transition={{ duration: 0.5 }}
            >
              <Zap className="w-6 h-6 text-cyan-400" />
            </motion.div>
            <h3 className="text-2xl font-bold font-[family-name:var(--font-geist-mono)] bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 text-transparent bg-clip-text">
              Swap Tokens
            </h3>
            <motion.div
              animate={{ rotate: [0, 360], scale: [1, 1.2, 1] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              <Sparkles className="w-5 h-5 text-cyan-400" />
            </motion.div>
          </div>
          <motion.button 
            className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors border border-white/10 hover:border-cyan-400/30"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Info className="w-5 h-5 text-gray-400 hover:text-cyan-400 transition-colors" />
          </motion.button>
        </motion.div>
      
      {/* Wallet Connection Status */}
      {!connected && (
        <div className="mb-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
          <p className="text-yellow-300">Please connect your wallet to start trading</p>
        </div>
      )}

        {/* From Token */}
        <motion.div 
          className="mb-4"
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <div className="flex items-center justify-between mb-2">
            <motion.span 
              className="text-sm text-gray-400 font-medium flex items-center space-x-2"
              whileHover={{ x: 5 }}
            >
              <TrendingUp className="w-4 h-4" />
              <span>From</span>
            </motion.span>
            <motion.span 
              className="text-sm text-gray-400 hover:text-cyan-400 transition-colors cursor-pointer px-3 py-1 bg-white/5 rounded-full border border-white/10"
              whileHover={{ scale: 1.05 }}
              onClick={() => connected && setAmount(formatBalance(getCurrentBalance()))}
            >
              Balance: {connected ? formatBalance(getCurrentBalance()) : '0.00'}
            </motion.span>
          </div>
          <motion.div 
            className="relative"
            whileHover={{ scale: 1.01 }}
            transition={{ duration: 0.2 }}
          >
            <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.0"
                  className={`bg-transparent text-2xl font-bold outline-none flex-1 placeholder-gray-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                    isInsufficientBalance() ? 'text-red-400' : 'text-white'
                  }`}
                  disabled={!connected}
                  min="0"
                  step="0.00000001"
                />
                <motion.button 
                  className={`px-5 py-2 rounded-xl font-bold text-lg border-2 transition-all duration-300 relative overflow-hidden ${
                    fromToken === 'YES' 
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-500 border-cyan-400 text-white shadow-lg shadow-cyan-500/25' 
                      : 'bg-gradient-to-r from-purple-500 to-pink-500 border-purple-400 text-white shadow-lg shadow-purple-500/25'
                  }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <span className="relative z-10">{fromToken}</span>
                </motion.button>
              </div>
              <motion.div 
                className="text-sm text-gray-400 mt-2 flex items-center space-x-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <Sparkles className="w-3 h-3" />
                <span>≈ ${fromToken === 'YES' ? market.probability.toFixed(3) : (1 - market.probability).toFixed(3)} per token</span>
              </motion.div>
              {isInsufficientBalance() && (
                <motion.div 
                  className="text-xs text-red-400 mt-1 flex items-center space-x-1"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <AlertCircle className="w-3 h-3" />
                  <span>Insufficient balance</span>
                </motion.div>
              )}
            </div>
          </motion.div>
        </motion.div>

        {/* Enhanced Swap Direction Button */}
        <div className="flex justify-center -my-2 relative z-20">
          <motion.button
            onClick={handleSwapDirection}
            className="p-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 border-2 border-white/20 rounded-full transition-all duration-300 relative overflow-hidden group shadow-xl shadow-cyan-500/30"
            whileHover={{ scale: 1.15, rotate: 180, boxShadow: "0 20px 40px -12px rgba(6, 182, 212, 0.6)" }}
            whileTap={{ scale: 0.9 }}
            transition={{ duration: 0.3 }}
            disabled={!connected}
          >
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-full"
              initial={{ rotate: 0 }}
              whileHover={{ rotate: 360 }}
              transition={{ duration: 0.8 }}
            />
            <ArrowDown className="w-5 h-5 text-white relative z-10" />
          </motion.button>
        </div>

        {/* To Token */}
        <motion.div 
          className="mb-6"
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <div className="flex items-center justify-between mb-2">
            <motion.span 
              className="text-sm text-gray-400 font-medium flex items-center space-x-2"
              whileHover={{ x: 5 }}
            >
              <Activity className="w-4 h-4" />
              <span>To (estimated)</span>
            </motion.span>
            <motion.span 
              className="text-sm text-gray-400 hover:text-cyan-400 transition-colors cursor-pointer px-3 py-1 bg-white/5 rounded-full border border-white/10"
              whileHover={{ scale: 1.05 }}
            >
              Balance: {connected ? (toToken === 'YES' ? formatBalance(balances.yes) : formatBalance(balances.no)) : '0.00'}
            </motion.span>
          </div>
          <motion.div 
            className="relative"
            whileHover={{ scale: 1.01 }}
            transition={{ duration: 0.2 }}
          >
            <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <motion.div 
                  className="text-2xl font-bold text-white"
                  key={quote?.outputAmount || '0'}
                  initial={{ scale: 1.1, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  {isLoadingQuote ? (
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-cyan-400"></div>
                      <span className="text-lg">Loading...</span>
                    </div>
                  ) : quote ? (
                    formatOutput(quote.outputAmount)
                  ) : (
                    '0.0000'
                  )}
                </motion.div>
                <motion.button 
                  className={`px-5 py-2 rounded-xl font-bold text-lg border-2 transition-all duration-300 relative overflow-hidden ${
                    toToken === 'YES' 
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-500 border-cyan-400 text-white shadow-lg shadow-cyan-500/25' 
                      : 'bg-gradient-to-r from-purple-500 to-pink-500 border-purple-400 text-white shadow-lg shadow-purple-500/25'
                  }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <span className="relative z-10">{toToken}</span>
                </motion.button>
              </div>
              <motion.div 
                className="text-sm text-gray-400 mt-2 flex items-center space-x-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
              >
                <Sparkles className="w-3 h-3" />
                <span>≈ ${toToken === 'YES' ? market.probability.toFixed(3) : (1 - market.probability).toFixed(3)} per token</span>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>

        {/* Enhanced Trade Info */}
        {quote && (
          <motion.div 
            className="space-y-2 mb-6 p-4 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            <motion.div 
              className="flex items-center justify-between text-sm"
              whileHover={{ x: 3 }}
            >
              <div className="flex items-center space-x-2 text-gray-400">
                <Activity className="w-4 h-4" />
                <span>Price Impact</span>
              </div>
              <span className={`font-semibold ${
                quote.priceImpact > 0.05 ? 'text-red-400' : 'text-white'
              }`}>
                {(quote.priceImpact * 100).toFixed(2)}%
              </span>
            </motion.div>
            <motion.div 
              className="flex items-center justify-between text-sm"
              whileHover={{ x: 3 }}
            >
              <span className="text-gray-400">Slippage Tolerance</span>
              <motion.button 
                className="text-purple-400 hover:text-purple-300 transition-colors"
                whileHover={{ scale: 1.05 }}
                onClick={() => {
                  const newSlippage = slippageTolerance === 0.5 ? 1.0 : slippageTolerance === 1.0 ? 2.0 : 0.5;
                  setSlippageTolerance(newSlippage);
                }}
              >
                {slippageTolerance}% <span className="text-gray-600">Edit</span>
              </motion.button>
            </motion.div>
            <motion.div 
              className="flex items-center justify-between text-sm"
              whileHover={{ x: 3 }}
            >
              <span className="text-gray-400">Trading Fee</span>
              <span className="text-white font-semibold">{(market.feeRate / 100).toFixed(1)}%</span>
            </motion.div>
          </motion.div>
        )}

        {/* Error Display */}
        {error && (
          <motion.div 
            className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center space-x-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <AlertCircle className="w-5 h-5 text-red-400" />
            <span className="text-sm text-red-300">{error}</span>
          </motion.div>
        )}

        {/* Success Display */}
        {successMessage && (
          <motion.div 
            className="mb-4 p-4 bg-green-500/10 border border-green-500/30 rounded-xl flex items-center space-x-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Sparkles className="w-5 h-5 text-green-400" />
            <span className="text-sm text-green-300">{successMessage}</span>
          </motion.div>
        )}

        {/* Enhanced Swap Button */}
        <motion.button 
          onClick={handleSwap}
          disabled={
            !connected || 
            !quote || 
            !amount || 
            parseFloat(amount) <= 0 || 
            isInsufficientBalance() || 
            isExecutingSwap || 
            isLoadingQuote
          }
          className={`w-full py-4 rounded-2xl font-bold text-white text-lg transition-all duration-300 relative overflow-hidden shadow-2xl border border-white/20 group ${
            !connected || !quote || !amount || parseFloat(amount) <= 0 || isInsufficientBalance() || isExecutingSwap || isLoadingQuote
              ? 'bg-gray-600 cursor-not-allowed'
              : 'bg-gradient-to-r from-cyan-500 via-blue-500 via-purple-500 to-pink-500 hover:from-cyan-400 hover:via-blue-400 hover:via-purple-400 hover:to-pink-400 shadow-cyan-500/30'
          }`}
          whileHover={!connected || !quote || !amount || parseFloat(amount) <= 0 || isInsufficientBalance() || isExecutingSwap || isLoadingQuote ? {} : { 
            scale: 1.02, 
            boxShadow: "0 25px 50px -12px rgba(6, 182, 212, 0.5)",
            borderColor: "rgba(255, 255, 255, 0.3)"
          }}
          whileTap={!connected || !quote || !amount || parseFloat(amount) <= 0 || isInsufficientBalance() || isExecutingSwap || isLoadingQuote ? {} : { scale: 0.98 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-white/20 via-cyan-300/20 to-white/20"
            initial={{ x: '-100%' }}
            whileHover={{ x: '100%' }}
            transition={{ duration: 0.8 }}
          />
          <span className="relative z-10 flex items-center justify-center space-x-3">
            {isExecutingSwap ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span className="tracking-wide">Executing Swap...</span>
              </>
            ) : isLoadingQuote ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span className="tracking-wide">Getting Quote...</span>
              </>
            ) : isInsufficientBalance() ? (
              <>
                <AlertCircle className="w-5 h-5" />
                <span className="tracking-wide">Insufficient Balance</span>
              </>
            ) : !connected ? (
              <>
                <Zap className="w-5 h-5" />
                <span className="tracking-wide">Connect Wallet</span>
              </>
            ) : (
              <>
                <motion.div
                  animate={{ rotate: [0, 360], scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Zap className="w-5 h-5" />
                </motion.div>
                <span className="tracking-wide">Swap Tokens</span>
                <motion.div
                  animate={{ 
                    scale: [1, 1.3, 1], 
                    rotate: [0, 180, 360],
                    opacity: [0.7, 1, 0.7]
                  }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Sparkles className="w-4 h-4" />
                </motion.div>
              </>
            )}
          </span>
        </motion.button>

        {/* Enhanced Info Note */}
        <motion.div 
          className="mt-4 p-3 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-400/30 rounded-xl flex items-start space-x-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7 }}
        >
          <motion.div
            whileHover={{ rotate: 360, scale: 1.1 }}
            transition={{ duration: 0.5 }}
          >
            <Info className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
          </motion.div>
          <div className="text-sm text-gray-300">
            <p className="mb-1">
              <span className="font-semibold text-cyan-300">Smart Trading:</span> Our advanced PM-AMM automatically calculates optimal exchange rates based on current market conditions.
            </p>
            <p>
              <span className="font-semibold text-cyan-300">Low Fees:</span> Enjoy competitive trading fees with minimal slippage for the best trading experience.
            </p>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
