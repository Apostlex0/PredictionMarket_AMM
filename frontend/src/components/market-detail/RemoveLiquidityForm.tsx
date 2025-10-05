// src/components/market-detail/RemoveLiquidityForm.tsx
'use client';
import { useState, useEffect } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { Minus, Info, AlertCircle, Clock, Shield, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Market, getMarketPhase } from '@/types/market';
import { getUserBalances, buildRemoveLiquidityPayload } from '@/lib/aptos_service';

interface LPPosition {
    lpTokens: number;
    yesTokens: number;
    noTokens: number;
    value: number;
    claimableFees: {
        yes: number;
        no: number;
    };
    pendingWithdrawals: {
        yes: number;
        no: number;
    };
}

export default function RemoveLiquidityForm({ market }: { market: Market }) {
    const { connected, account, signAndSubmitTransaction } = useWallet();
    const [percentage, setPercentage] = useState(50);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [lpPosition, setLpPosition] = useState<LPPosition | null>(null);
    const [isLoadingPosition, setIsLoadingPosition] = useState(true);

    // Get market phase to determine if removal is allowed
    const marketPhase = getMarketPhase(market);
    const canRemoveLiquidity = !market.isDynamic || market.resolved || marketPhase === 'resolved';

    // Load LP position on mount
    useEffect(() => {
        const loadLPPosition = async () => {
            if (!connected || !account) {
                setIsLoadingPosition(false);
                return;
            }

            try {
                // Fetch LP position from contract
                const balances = await getUserBalances(account.address.toString(), market.poolAddress);

                if (!balances || parseFloat(balances.lp) === 0) {
                    setLpPosition(null);
                    return;
                }

                const lpTokens = parseFloat(balances.lp) / Math.pow(10, 8);
                const yesTokens = parseFloat(balances.yes) / Math.pow(10, 8);
                const noTokens = parseFloat(balances.no) / Math.pow(10, 8);
                const value = lpTokens; // Simplified

                const position: LPPosition = {
                    lpTokens,
                    yesTokens,
                    noTokens,
                    value,
                    claimableFees: { yes: 0, no: 0 }, // Would need separate contract call
                    pendingWithdrawals: { yes: 0, no: 0 } // Would need separate contract call
                };
                setLpPosition(position);
            } catch (err) {
                console.error('Error loading LP position:', err);
                setError('Failed to load LP position');
            } finally {
                setIsLoadingPosition(false);
            }
        };

        loadLPPosition();
    }, [connected, account, market.id]);

    // Handle remove liquidity
    const handleRemoveLiquidity = async () => {
        if (!connected || !account || !signAndSubmitTransaction || !lpPosition) {
            setError('Please connect your wallet');
            return;
        }

        if (!canRemoveLiquidity) {
            setError('Dynamic pool liquidity can only be removed after market resolution');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const lpTokensToRemove = lpPosition.lpTokens * percentage / 100;
            const lpTokensU64 = (lpTokensToRemove * Math.pow(10, 8)).toString();

            const payload = buildRemoveLiquidityPayload(
                market.poolAddress,
                lpTokensU64
            );

            await signAndSubmitTransaction({
                sender: account.address,
                data: payload
            });

            setSuccessMessage(`Successfully removed ${percentage}% of your liquidity position!`);
            setPercentage(50); // Reset to default
        } catch (err: unknown) {
            console.error('Error removing liquidity:', err);
            setError(err instanceof Error ? err.message : 'Failed to remove liquidity');
        } finally {
            setIsLoading(false);
        }
    };

    // Clear messages after 5 seconds
    useEffect(() => {
        if (error || successMessage) {
            const timer = setTimeout(() => {
                setError(null);
                setSuccessMessage(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [error, successMessage]);

    // Safe calculations with null checks
    const yesToReceive = lpPosition ? (lpPosition.yesTokens * percentage / 100).toFixed(2) : '0.00';
    const noToReceive = lpPosition ? (lpPosition.noTokens * percentage / 100).toFixed(2) : '0.00';
    const lpTokensToBurn = lpPosition ? (lpPosition.lpTokens * percentage / 100).toFixed(2) : '0.00';

    // Show loading state
    if (isLoadingPosition) {
        return (
            <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-red-500/10 rounded-3xl blur-2xl"></div>
                <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8">
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
                        <span className="ml-3 text-gray-400">Loading LP position...</span>
                    </div>
                </div>
            </div>
        );
    }

    // Show no position state
    if (!lpPosition || lpPosition.lpTokens === 0) {
        return (
            <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-red-500/10 rounded-3xl blur-2xl"></div>
                <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8">
                    <div className="text-center py-12">
                        <Minus className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-gray-400 mb-2">No Liquidity Position</h3>
                        <p className="text-gray-500">You don&apos;t have any liquidity in this market.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-red-500/10 rounded-3xl blur-2xl"></div>
            <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-3">
                        <Minus className="w-6 h-6 text-orange-400" />
                        <h3 className="text-2xl font-bold font-[family-name:var(--font-geist-mono)]">
                            Remove Liquidity
                        </h3>
                    </div>
                    {market.isDynamic && (
                        <div className="flex items-center space-x-2 text-sm">
                            <Shield className="w-4 h-4 text-cyan-400" />
                            <span className="text-cyan-400">Dynamic Pool</span>
                        </div>
                    )}
                </div>

                {/* Dynamic Pool Restriction Warning */}
                {market.isDynamic && !canRemoveLiquidity && (
                    <motion.div 
                        className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <div className="flex items-start space-x-3">
                            <Clock className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                            <div>
                                <div className="font-semibold text-yellow-400 mb-1">Liquidity Locked</div>
                                <div className="text-sm text-yellow-300">
                                    Dynamic pool liquidity can only be removed after market resolution. 
                                    This protects against L₀ parameter changes that could destabilize the pool.
                                </div>
                                <div className="text-xs text-yellow-400 mt-2">
                                    Market expires: {market.expiresAt.toLocaleDateString()}
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

                {/* Percentage Slider */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-sm text-gray-400">Amount to Remove</span>
                        <span className="text-3xl font-bold bg-gradient-to-r from-orange-400 to-red-400 text-transparent bg-clip-text">
                            {percentage}%
                        </span>
                    </div>

                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={percentage}
                        onChange={(e) => setPercentage(parseInt(e.target.value))}
                        className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer slider"
                        style={{
                            background: `linear-gradient(to right, rgb(251 146 60) 0%, rgb(239 68 68) ${percentage}%, rgba(255,255,255,0.1) ${percentage}%, rgba(255,255,255,0.1) 100%)`
                        }}
                    />

                    {/* Quick Buttons */}
                    <div className="flex gap-2 mt-4">
                        {[25, 50, 75, 100].map((val) => (
                            <button
                                key={val}
                                onClick={() => setPercentage(val)}
                                className={`flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${percentage === val
                                        ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white'
                                        : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                                    }`}
                            >
                                {val}%
                            </button>
                        ))}
                    </div>
                </div>

                {/* Tokens to Receive */}
                <div className="mb-6">
                    <div className="text-sm text-gray-400 mb-3">You will receive:</div>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                            <div>
                                <div className="text-sm text-gray-400 mb-1">YES Tokens</div>
                                <div className="text-2xl font-bold text-white">{yesToReceive}</div>
                            </div>
                            <div className="px-3 py-1 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg text-sm font-bold">
                                YES
                            </div>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                            <div>
                                <div className="text-sm text-gray-400 mb-1">NO Tokens</div>
                                <div className="text-2xl font-bold text-white">{noToReceive}</div>
                            </div>
                            <div className="px-3 py-1 bg-gradient-to-r from-red-500 to-rose-500 rounded-lg text-sm font-bold">
                                NO
                            </div>
                        </div>
                    </div>
                </div>

                {/* LP Tokens to Burn */}
                <div className="mb-6 p-4 bg-white/5 rounded-2xl">
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-400">LP Tokens to Burn</span>
                        <span className="text-white font-semibold">
                            {(lpPosition.lpTokens * percentage / 100).toFixed(2)}
                        </span>
                    </div>
                </div>

                {/* Remove Liquidity Button */}
                <motion.button 
                    onClick={handleRemoveLiquidity}
                    disabled={!connected || isLoading || !canRemoveLiquidity || percentage === 0}
                    className={`w-full py-4 rounded-xl font-bold text-white transition-all duration-300 relative overflow-hidden ${
                        !connected || isLoading || !canRemoveLiquidity || percentage === 0
                            ? 'bg-gray-600 cursor-not-allowed'
                            : 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600'
                    }`}
                    whileHover={!connected || isLoading || !canRemoveLiquidity || percentage === 0 ? {} : { scale: 1.02 }}
                    whileTap={!connected || isLoading || !canRemoveLiquidity || percentage === 0 ? {} : { scale: 0.98 }}
                >
                    <span className="relative z-10 flex items-center justify-center space-x-2">
                        {isLoading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span>Removing Liquidity...</span>
                            </>
                        ) : !connected ? (
                            <>
                                <AlertCircle className="w-5 h-5" />
                                <span>Connect Wallet</span>
                            </>
                        ) : !canRemoveLiquidity ? (
                            <>
                                <Clock className="w-5 h-5" />
                                <span>Locked Until Resolution</span>
                            </>
                        ) : percentage === 0 ? (
                            <>
                                <Minus className="w-5 h-5" />
                                <span>Select Amount</span>
                            </>
                        ) : (
                            <>
                                <Minus className="w-5 h-5" />
                                <span>Remove {percentage}% Liquidity</span>
                            </>
                        )}
                    </span>
                </motion.button>

                {/* Enhanced Info Section */}
                <div className="mt-4 space-y-3">
                    <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-start space-x-2">
                        <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-gray-400">
                            <div className="font-semibold text-blue-400 mb-1">What You&apos;ll Receive</div>
                            <div>
                                • Proportional share of YES and NO tokens from the pool<br/>
                                • Your accumulated trading fees ({lpPosition.claimableFees.yes.toFixed(2)} YES, {lpPosition.claimableFees.no.toFixed(2)} NO)<br/>
                                {market.isDynamic && (
                                    <>• Pending automatic withdrawals ({lpPosition.pendingWithdrawals.yes.toFixed(2)} YES, {lpPosition.pendingWithdrawals.no.toFixed(2)} NO)</>
                                )}
                            </div>
                        </div>
                    </div>

                    {market.isDynamic && (
                        <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl flex items-start space-x-2">
                            <Shield className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                            <div className="text-sm text-gray-400">
                                <div className="font-semibold text-cyan-400 mb-1">Dynamic Pool Protection</div>
                                <div>
                                    This dynamic pool includes automatic loss protection. All fees and automatic withdrawals are distributed when you remove liquidity.
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}