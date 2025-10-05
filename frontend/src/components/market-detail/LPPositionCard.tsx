// src/components/market-detail/LPPositionCard.tsx
'use client';
import { useState, useEffect } from 'react';
import { Droplets, TrendingUp, Coins, Wallet, Loader2, AlertCircle, Shield } from 'lucide-react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { motion } from 'framer-motion';
import { Market } from '@/types/market';
import { getUserBalances, getMarketReserves } from '@/lib/aptos_service';

interface LPPosition {
    lpTokens: number;
    poolShare: number;
    yesTokens: number;
    noTokens: number;
    totalValue: number;
    feesEarned: number;
    lvr: number;
    claimableFees: {
        yes: number;
        no: number;
    };
    pendingWithdrawals: {
        yes: number;
        no: number;
    };
}

export default function LPPositionCard({ market }: { market: Market }) {
    const { account, connected } = useWallet();
    
    // LP position state
    const [position, setPosition] = useState<LPPosition | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Load LP position when wallet connects or market changes
    useEffect(() => {
        const loadLPPosition = async () => {
            if (!connected || !account?.address) {
                setPosition(null);
                return;
            }

            // Skip loading for mock markets (use mock data)
            if (market.id.startsWith('mock-')) {
                const mockPosition: LPPosition = {
                    lpTokens: 100,
                    poolShare: 2.5,
                    yesTokens: 67,
                    noTokens: 33,
                    totalValue: 100,
                    feesEarned: 3.2,
                    lvr: -1.8,
                    claimableFees: { yes: 1.6, no: 1.6 },
                    pendingWithdrawals: { yes: 0.5, no: 0.3 },
                };
                setPosition(mockPosition);
                return;
            }

            try {
                setIsLoading(true);
                setError(null);

                // Load real balances from contract
                const balances = await getUserBalances(
                    account.address.toString(),
                    market.poolAddress
                );

                if (!balances || parseFloat(balances.lp) === 0) {
                    setPosition(null);
                    return;
                }

                // Get pool reserves to calculate user's share
                const reserves = await getMarketReserves(market.poolAddress);

                // Parse balances (convert from u64 with 8 decimals)
                const lpTokens = parseFloat(balances.lp) / Math.pow(10, 8) || 0;

                // For now, estimate YES/NO token values from reserves
                // In reality, you'd calculate based on LP share * reserves / total LP supply
                const poolShare = 2.5; // Placeholder - would calculate from total LP supply

                const yesTokens = reserves ? (parseFloat(reserves.yes) / Math.pow(10, 8)) * (poolShare / 100) : 0;
                const noTokens = reserves ? (parseFloat(reserves.no) / Math.pow(10, 8)) * (poolShare / 100) : 0;

                // Calculate total value based on current market probability
                const yesValue = yesTokens * market.probability;
                const noValue = noTokens * (1 - market.probability);
                const totalValue = yesValue + noValue;

                // Try to get LP analytics for dynamic pools
                let feesEarned = 0;
                let lvr = 0;
                let claimableFees = { yes: 0, no: 0 };
                let pendingWithdrawals = { yes: 0, no: 0 };

                // For now, use simplified calculations until contract service is fully implemented
                if (market.isDynamic) {
                    feesEarned = totalValue * 0.03; // Estimate 3% fees earned for dynamic pools
                    lvr = -totalValue * 0.01; // Estimate 1% LVR cost
                    claimableFees = { yes: totalValue * 0.015, no: totalValue * 0.015 };
                    pendingWithdrawals = { yes: totalValue * 0.005, no: totalValue * 0.003 };
                } else {
                    feesEarned = totalValue * 0.02; // Estimate 2% fees earned for static pools
                    lvr = 0; // No LVR for static pools
                }

                const userLPPosition: LPPosition = {
                    lpTokens,
                    poolShare,
                    yesTokens,
                    noTokens,
                    totalValue,
                    feesEarned,
                    lvr,
                    claimableFees,
                    pendingWithdrawals,
                };

                setPosition(userLPPosition);
            } catch (error) {
                console.error('Error loading LP position:', error);
                setError('Failed to load LP position data');
            } finally {
                setIsLoading(false);
            }
        };

        loadLPPosition();
    }, [connected, account?.address, market]);

    // Not connected state
    if (!connected) {
        return (
            <div className="sticky top-24">
                <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-3xl blur-xl"></div>
                    <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-6">
                        <div className="flex items-center space-x-3 mb-6">
                            <Droplets className="w-5 h-5 text-cyan-400" />
                            <h4 className="text-xl font-bold font-[family-name:var(--font-geist-mono)]">
                                Your LP Position
                            </h4>
                        </div>
                        <div className="text-center py-8">
                            <Wallet className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                            <p className="text-gray-400 mb-2">Connect your wallet</p>
                            <p className="text-sm text-gray-500">to view your LP position</p>
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
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-3xl blur-xl"></div>
                    <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-6">
                        <div className="flex items-center space-x-3 mb-6">
                            <Droplets className="w-5 h-5 text-cyan-400" />
                            <h4 className="text-xl font-bold font-[family-name:var(--font-geist-mono)]">
                                Your LP Position
                            </h4>
                        </div>
                        <div className="text-center py-8">
                            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-4" />
                            <p className="text-gray-400">Loading LP position...</p>
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
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-3xl blur-xl"></div>
                    <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-6">
                        <div className="flex items-center space-x-3 mb-6">
                            <Droplets className="w-5 h-5 text-cyan-400" />
                            <h4 className="text-xl font-bold font-[family-name:var(--font-geist-mono)]">
                                Your LP Position
                            </h4>
                        </div>
                        <div className="text-center py-8">
                            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                            <p className="text-red-400 mb-2">Error loading LP position</p>
                            <p className="text-sm text-gray-500">{error}</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // No LP position state
    if (!position || position.lpTokens === 0) {
        return (
            <div className="sticky top-24">
                <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-3xl blur-xl"></div>
                    <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-6">
                        <div className="flex items-center space-x-3 mb-6">
                            <Droplets className="w-5 h-5 text-cyan-400" />
                            <h4 className="text-xl font-bold font-[family-name:var(--font-geist-mono)]">
                                Your LP Position
                            </h4>
                        </div>
                        <div className="text-center py-8">
                            <Droplets className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                            <p className="text-gray-400 mb-2">No LP position</p>
                            <p className="text-sm text-gray-500">Add liquidity to earn fees</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // LP position data state
    return (
        <div className="sticky top-24">
            <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-3xl blur-xl"></div>
                <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center space-x-3">
                            <Droplets className="w-5 h-5 text-cyan-400" />
                            <h4 className="text-xl font-bold font-[family-name:var(--font-geist-mono)]">
                                Your LP Position
                            </h4>
                        </div>
                        <div className="flex items-center space-x-2">
                            {market.isDynamic && (
                                <Shield className="w-4 h-4 text-cyan-400" />
                            )}
                            {market.id.startsWith('mock-') && (
                                <span className="text-xs text-yellow-400 bg-yellow-500/10 px-2 py-1 rounded">
                                    Demo Data
                                </span>
                            )}
                        </div>
                    </div>

                    {/* LP Tokens */}
                    <motion.div 
                        className="mb-6 p-4 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 rounded-2xl"
                        whileHover={{ scale: 1.02 }}
                    >
                        <div className="text-sm text-gray-400 mb-2">LP Tokens</div>
                        <div className="text-3xl font-bold text-white mb-1">{position.lpTokens.toFixed(2)}</div>
                        <div className="text-sm text-cyan-400">{position.poolShare.toFixed(2)}% of pool</div>
                    </motion.div>

                    {/* Underlying Tokens */}
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

                    {/* Performance Metrics */}
                    <div className="space-y-3 pt-6 border-t border-white/10">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2 text-gray-400">
                                <Coins className="w-4 h-4" />
                                <span className="text-sm">Total Value</span>
                            </div>
                            <span className="text-white font-semibold">${position.totalValue.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2 text-gray-400">
                                <TrendingUp className="w-4 h-4" />
                                <span className="text-sm">Fees Earned</span>
                            </div>
                            <span className="text-green-400 font-semibold">+${position.feesEarned.toFixed(2)}</span>
                        </div>
                        {market.isDynamic && position.lvr !== 0 && (
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-400">LVR Cost</span>
                                <span className="text-orange-400 font-semibold">${position.lvr.toFixed(2)}</span>
                            </div>
                        )}
                        <div className="flex items-center justify-between pt-3 border-t border-white/10">
                            <span className="text-sm text-gray-400">Net P&L</span>
                            <span className={`font-bold ${(position.feesEarned + position.lvr) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {(position.feesEarned + position.lvr) >= 0 ? '+' : ''}${(position.feesEarned + position.lvr).toFixed(2)}
                            </span>
                        </div>
                        
                        {/* Dynamic Pool Additional Info */}
                        {market.isDynamic && (position.claimableFees.yes > 0 || position.claimableFees.no > 0 || position.pendingWithdrawals.yes > 0 || position.pendingWithdrawals.no > 0) && (
                            <div className="pt-3 border-t border-white/10 space-y-2">
                                <div className="text-xs text-cyan-400 font-semibold mb-2">Dynamic Pool Benefits</div>
                                {(position.claimableFees.yes > 0 || position.claimableFees.no > 0) && (
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-500">Claimable Fees</span>
                                        <span className="text-green-400">
                                            {position.claimableFees.yes.toFixed(2)} YES, {position.claimableFees.no.toFixed(2)} NO
                                        </span>
                                    </div>
                                )}
                                {(position.pendingWithdrawals.yes > 0 || position.pendingWithdrawals.no > 0) && (
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-500">Auto Withdrawals</span>
                                        <span className="text-cyan-400">
                                            {position.pendingWithdrawals.yes.toFixed(2)} YES, {position.pendingWithdrawals.no.toFixed(2)} NO
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}