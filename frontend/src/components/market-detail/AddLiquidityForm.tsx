// src/components/market-detail/AddLiquidityForm.tsx
'use client';
import { useState, useEffect } from 'react';
import { Plus, Info, AlertCircle, DollarSign, Zap, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { Market } from '@/types/market';
import {
  previewAddLiquidity,
  buildAddLiquidityPayload,
  u128ToNumber
} from '@/lib/aptos_service';

interface LiquidityPreview {
  requiredYes: string;
  requiredNo: string;
  lpTokens: string;
  shareOfPool: number;
}

export default function AddLiquidityForm({ market }: { market: Market }) {
    // Wallet integration
    const { account, connected, signAndSubmitTransaction } = useWallet();
    
    // PM-AMM uses VALUE-BASED liquidity, not token amounts
    const [usdAmount, setUsdAmount] = useState('');
    const [preview, setPreview] = useState<LiquidityPreview | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isExecutingTransaction, setIsExecutingTransaction] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Get liquidity preview when USD amount changes
    useEffect(() => {
        const getPreview = async () => {
            if (!usdAmount || parseFloat(usdAmount) <= 0) {
                setPreview(null);
                return;
            }

            setIsLoading(true);
            setError(null);

            try {
                const result = await previewAddLiquidity(
                    market.poolAddress,
                    parseFloat(usdAmount)
                );

                if (result) {
                    setPreview({
                        requiredYes: result.requiredYes,
                        requiredNo: result.requiredNo,
                        lpTokens: result.lpTokens,
                        shareOfPool: u128ToNumber(result.shareOfPool), // Convert FixedPoint128 to decimal
                    });
                } else {
                    // Fallback to mock calculation for development
                    const mockPreview = {
                        requiredYes: (parseFloat(usdAmount) * market.probability).toFixed(2),
                        requiredNo: (parseFloat(usdAmount) * (1 - market.probability)).toFixed(2),
                        lpTokens: usdAmount,
                        shareOfPool: parseFloat(usdAmount) / (market.liquidity + parseFloat(usdAmount)),
                    };
                    setPreview(mockPreview);
                }
            } catch (err) {
                console.error('Error getting liquidity preview:', err);
                setError('Failed to get liquidity preview');
            } finally {
                setIsLoading(false);
            }
        };

        const timeoutId = setTimeout(getPreview, 300); // Debounce
        return () => clearTimeout(timeoutId);
    }, [usdAmount, market]);

    // Execute add liquidity transaction
    const handleAddLiquidity = async () => {
        if (!preview || !usdAmount || parseFloat(usdAmount) <= 0 || !connected || !account) {
            setError('Please connect wallet and enter valid amount');
            return;
        }

        setIsExecutingTransaction(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const payload = buildAddLiquidityPayload(
                market.poolAddress,
                parseFloat(usdAmount)
            );

            await signAndSubmitTransaction({
                sender: account.address,
                data: payload
            });

            // Success - reset form and show success message
            setUsdAmount('');
            setPreview(null);
            setSuccessMessage(`Successfully added $${usdAmount} liquidity to the market!`);

        } catch (err: unknown) {
            console.error('Error adding liquidity:', err);
            setError(err instanceof Error ? err.message : 'Failed to add liquidity');
        } finally {
            setIsExecutingTransaction(false);
        }
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
        <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-3xl blur-2xl"></div>
            <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8">
                <div className="flex items-center space-x-3 mb-6">
                    <Plus className="w-6 h-6 text-cyan-400" />
                    <h3 className="text-2xl font-bold font-[family-name:var(--font-geist-mono)]">
                        Add Liquidity
                    </h3>
                </div>

                {/* PM-AMM Explanation */}
                <div className="mb-6 p-4 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-2xl">
                    <div className="flex items-start space-x-3">
                        <Info className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-gray-300">
                            <div className="font-semibold text-cyan-300 mb-1">PM-AMM Liquidity</div>
                            <div>
                                Specify the USD value you want to add. Our PM-AMM will automatically calculate the optimal YES and NO token amounts based on current market conditions.
                            </div>
                        </div>
                    </div>
                </div>

                {/* USD Value Input */}
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-400 flex items-center space-x-2">
                            <DollarSign className="w-4 h-4" />
                            <span>USD Value to Add</span>
                        </span>
                        <span className="text-sm text-gray-400">Wallet: $0.00</span>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                        <div className="flex items-center justify-between">
                            <input
                                type="number"
                                value={usdAmount}
                                onChange={(e) => setUsdAmount(e.target.value)}
                                placeholder="0.00"
                                className="bg-transparent text-3xl font-bold text-white outline-none w-full"
                                min="0"
                                step="0.01"
                            />
                            <div className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl font-bold text-sm">
                                USD
                            </div>
                        </div>
                    </div>
                </div>

                {/* Liquidity Preview */}
                {preview && (
                    <div className="mb-6 p-4 bg-white/5 rounded-2xl space-y-4">
                        <div className="text-sm font-medium text-white mb-3">Liquidity Preview</div>
                        
                        {/* Required Tokens */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-xl">
                                <div className="text-xs text-gray-400 mb-1">YES Tokens Required</div>
                                <div className="text-lg font-bold text-white">{parseFloat(preview.requiredYes).toFixed(2)}</div>
                            </div>
                            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                                <div className="text-xs text-gray-400 mb-1">NO Tokens Required</div>
                                <div className="text-lg font-bold text-white">{parseFloat(preview.requiredNo).toFixed(2)}</div>
                            </div>
                        </div>

                        {/* LP Details */}
                        <div className="space-y-2 pt-2 border-t border-white/10">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">LP Tokens to Receive</span>
                                <span className="text-white font-semibold">{parseFloat(preview.lpTokens).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Share of Pool</span>
                                <span className="text-white font-semibold">{(preview.shareOfPool * 100).toFixed(2)}%</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Current Market Price</span>
                                <span className="text-white">{(market.probability * 100).toFixed(1)}% YES</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Loading State */}
                {isLoading && (
                    <div className="mb-6 p-4 bg-white/5 rounded-2xl">
                        <div className="flex items-center space-x-3">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-cyan-400"></div>
                            <span className="text-sm text-gray-400">Calculating optimal amounts...</span>
                        </div>
                    </div>
                )}

                {/* Error State */}
                {error && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                        <div className="flex items-center space-x-3">
                            <AlertCircle className="w-5 h-5 text-red-400" />
                            <span className="text-sm text-red-300">{error}</span>
                        </div>
                    </div>
                )}

                {/* Dynamic Pool Benefits */}
                {market.isDynamic && (
                    <div className="mb-6 p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl flex items-start space-x-3">
                        <Info className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-gray-300">
                            <div className="font-semibold text-purple-400 mb-1">Dynamic Pool Benefits</div>
                            <div>
                                This dynamic pool provides automatic loss protection through time-based withdrawals. Your LP position is protected from impermanent loss as the market approaches expiration.
                            </div>
                        </div>
                    </div>
                )}

                {/* Warning about LVR for Static Pools */}
                {!market.isDynamic && (
                    <div className="mb-6 p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl flex items-start space-x-3">
                        <AlertCircle className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-gray-300">
                            <div className="font-semibold text-orange-400 mb-1">Impermanent Loss Warning</div>
                            <div>
                                This static pool exposes you to loss-vs-rebalancing (LVR). Consider dynamic pools for automatic loss protection.
                            </div>
                        </div>
                    </div>
                )}

                {/* Wallet Connection Status */}
                {!connected && (
                  <motion.div 
                    className="mb-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <p className="text-yellow-300">Please connect your wallet to add liquidity</p>
                  </motion.div>
                )}

                {/* Success Message */}
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

                {/* Enhanced Add Liquidity Button */}
                <motion.button 
                    onClick={handleAddLiquidity}
                    disabled={
                      !connected || 
                      !usdAmount || 
                      parseFloat(usdAmount) <= 0 || 
                      isLoading || 
                      isExecutingTransaction ||
                      !preview
                    }
                    className={`w-full py-4 rounded-2xl font-bold text-white text-lg transition-all duration-300 relative overflow-hidden shadow-2xl border border-white/20 group ${
                      !connected || !usdAmount || parseFloat(usdAmount) <= 0 || isLoading || isExecutingTransaction || !preview
                        ? 'bg-gray-600 cursor-not-allowed'
                        : 'bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 hover:from-cyan-400 hover:via-blue-400 hover:to-purple-400 shadow-cyan-500/30'
                    }`}
                    whileHover={!connected || !usdAmount || parseFloat(usdAmount) <= 0 || isLoading || isExecutingTransaction || !preview ? {} : { 
                      scale: 1.02, 
                      boxShadow: "0 25px 50px -12px rgba(6, 182, 212, 0.5)"
                    }}
                    whileTap={!connected || !usdAmount || parseFloat(usdAmount) <= 0 || isLoading || isExecutingTransaction || !preview ? {} : { scale: 0.98 }}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                >
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-white/20 via-cyan-300/20 to-white/20"
                    initial={{ x: '-100%' }}
                    whileHover={{ x: '100%' }}
                    transition={{ duration: 0.8 }}
                  />
                  <span className="relative z-10 flex items-center justify-center space-x-3">
                    {isExecutingTransaction ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        <span className="tracking-wide">Adding Liquidity...</span>
                      </>
                    ) : isLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        <span className="tracking-wide">Calculating...</span>
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
                          <Plus className="w-5 h-5" />
                        </motion.div>
                        <span className="tracking-wide">Add Liquidity</span>
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

                {/* Info */}
                <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-start space-x-2">
                    <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-gray-400">
                        Need tokens? Use the &quot;Mint Set&quot; tab to convert APT into equal amounts of YES and NO tokens first.
                    </p>
                </div>
            </div>
        </div>
    );
}