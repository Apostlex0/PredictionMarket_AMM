'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Droplets, Loader2, Shield, Wallet } from 'lucide-react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { Market, getMarketPhase } from '@/types/market';
import {
    getUserLpPosition,
    previewRemoveLiquidity,
    u128ToPercentage,
    UserLpPosition,
} from '@/lib/aptos_service';
import { formatLp, formatOutcome } from '@/lib/amounts';

interface FullWithdrawalPreview {
    yesOutRaw: string;
    noOutRaw: string;
}

export default function LPPositionCard({ market }: { market: Market }) {
    const { account, connected } = useWallet();

    const [position, setPosition] = useState<UserLpPosition | null>(null);
    const [fullWithdrawalPreview, setFullWithdrawalPreview] =
        useState<FullWithdrawalPreview | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const marketPhase = getMarketPhase(market);
    const canPreviewWithdrawal =
        !market.isDynamic || market.resolved || marketPhase === 'resolved';

    const loadPosition = useCallback(async () => {
        if (!connected || !account?.address) {
            setPosition(null);
            setFullWithdrawalPreview(null);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const result = await getUserLpPosition(
                account.address.toString(),
                market.poolAddress
            );

            if (!result || BigInt(result.lpTokens) === 0n) {
                setPosition(null);
                setFullWithdrawalPreview(null);
                return;
            }

            setPosition(result);

            if (canPreviewWithdrawal) {
                const removalPreview = await previewRemoveLiquidity(
                    market.poolAddress,
                    result.lpTokens
                );

                if (removalPreview) {
                    setFullWithdrawalPreview({
                        yesOutRaw: removalPreview.yesOut,
                        noOutRaw: removalPreview.noOut,
                    });
                } else {
                    setFullWithdrawalPreview(null);
                }
            } else {
                setFullWithdrawalPreview(null);
            }
        } catch (err) {
            console.error('Error loading LP position:', err);
            setPosition(null);
            setFullWithdrawalPreview(null);
            setError('Failed to load LP position data from the contract.');
        } finally {
            setIsLoading(false);
        }
    }, [
        connected,
        account?.address,
        market.poolAddress,
        canPreviewWithdrawal,
    ]);

    useEffect(() => {
        void loadPosition();
    }, [loadPosition]);

    useEffect(() => {
        const onPositionUpdated = (event: Event) => {
            const customEvent = event as CustomEvent<string>;
            if (customEvent.detail === market.poolAddress) {
                void loadPosition();
            }
        };

        window.addEventListener('lp-position-updated', onPositionUpdated);

        return () => {
            window.removeEventListener('lp-position-updated', onPositionUpdated);
        };
    }, [loadPosition, market.poolAddress]);

    if (!connected) {
        return (
            <div className="sticky top-24">
                <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-3xl blur-xl" />
                    <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-6">
                        <Header market={market} />
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

    if (isLoading) {
        return (
            <div className="sticky top-24">
                <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-3xl blur-xl" />
                    <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-6">
                        <Header market={market} />
                        <div className="text-center py-8">
                            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-4" />
                            <p className="text-gray-400">Loading LP position...</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="sticky top-24">
                <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-3xl blur-xl" />
                    <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-6">
                        <Header market={market} />
                        <div className="text-center py-8">
                            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                            <p className="text-red-400 mb-2">Unable to load LP position</p>
                            <p className="text-sm text-gray-500">{error}</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!position || BigInt(position.lpTokens) === 0n) {
        return (
            <div className="sticky top-24">
                <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-3xl blur-xl" />
                    <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-6">
                        <Header market={market} />
                        <div className="text-center py-8">
                            <Droplets className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                            <p className="text-gray-400 mb-2">No LP position</p>
                            <p className="text-sm text-gray-500">
                                Add liquidity to receive LP tokens.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="sticky top-24">
            <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-3xl blur-xl" />
                <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-6">
                    <Header market={market} />

                    <div className="mb-6 p-4 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 rounded-2xl">
                        <div className="text-sm text-gray-400 mb-2">LP Tokens</div>
                        <div className="text-3xl font-bold text-white mb-1">
                            {formatLp(position.lpTokens)}
                        </div>
                        <div className="text-sm text-cyan-400">
                            {u128ToPercentage(position.shareOfPool)}% of pool
                        </div>
                    </div>

                    <div className="text-xs text-gray-500 uppercase tracking-wide mb-3">
                        Current Reserve Share
                    </div>

                    <div className="space-y-3 mb-6">
                        <div className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/30 rounded-xl">
                            <span className="text-sm text-gray-400">YES Tokens</span>
                            <span className="text-lg font-bold text-white">
                                {formatOutcome(position.yesReserveShare)}
                            </span>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                            <span className="text-sm text-gray-400">NO Tokens</span>
                            <span className="text-lg font-bold text-white">
                                {formatOutcome(position.noReserveShare)}
                            </span>
                        </div>
                    </div>

                    {fullWithdrawalPreview ? (
                        <div className="pt-5 border-t border-white/10">
                            <div className="text-xs text-gray-500 uppercase tracking-wide mb-3">
                                Full Withdrawal Preview
                            </div>
                            <div className="text-xs text-gray-500 mb-3">
                                Includes distributed swap-fee balances.
                            </div>

                            <div className="flex items-center justify-between text-sm mb-2">
                                <span className="text-gray-400">YES Out</span>
                                <span className="text-green-400 font-semibold">
                                    {formatOutcome(fullWithdrawalPreview.yesOutRaw)}
                                </span>
                            </div>

                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-400">NO Out</span>
                                <span className="text-red-400 font-semibold">
                                    {formatOutcome(fullWithdrawalPreview.noOutRaw)}
                                </span>
                            </div>
                        </div>
                    ) : market.isDynamic && !canPreviewWithdrawal ? (
                        <div className="pt-5 border-t border-white/10 text-sm text-gray-400">
                            Dynamic-pool withdrawal becomes available after market resolution.
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

function Header({ market }: { market: Market }) {
    return (
        <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
                <Droplets className="w-5 h-5 text-cyan-400" />
                <h4 className="text-xl font-bold font-[family-name:var(--font-geist-mono)]">
                    Your LP Position
                </h4>
            </div>

            {market.isDynamic && (
                <div className="flex items-center space-x-1 text-xs text-cyan-400">
                    <Shield className="w-4 h-4" />
                    <span>Dynamic</span>
                </div>
            )}
        </div>
    );
}