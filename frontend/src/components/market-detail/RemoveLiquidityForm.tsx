'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { AlertCircle, Clock, Info, Loader2, Minus, Shield } from 'lucide-react';
import { motion } from 'framer-motion';
import { Market, getMarketPhase } from '@/types/market';
import {
    buildRemoveLiquidityPayload,
    getUserLpPosition,
    previewRemoveLiquidity,
    UserLpPosition,
} from '@/lib/aptos_service';
import { formatLp, formatOutcome } from '@/lib/amounts';

interface RemovalPreview {
    lpTokensToBurnRaw: string;
    yesOutRaw: string;
    noOutRaw: string;
}

export default function RemoveLiquidityForm({ market }: { market: Market }) {
    const { connected, account, signAndSubmitTransaction } = useWallet();

    const [percentage, setPercentage] = useState(50);
    const [position, setPosition] = useState<UserLpPosition | null>(null);
    const [preview, setPreview] = useState<RemovalPreview | null>(null);
    const [isLoadingPosition, setIsLoadingPosition] = useState(true);
    const [isLoadingPreview, setIsLoadingPreview] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const marketPhase = getMarketPhase(market);

    // Static pools may be removed while live.
    // Dynamic pools remain locked until the market is resolved.
    const canRemoveLiquidity =
        !market.isDynamic || market.resolved || marketPhase === 'resolved';

    const loadPosition = useCallback(async () => {
        if (!connected || !account?.address) {
            setPosition(null);
            setPreview(null);
            setIsLoadingPosition(false);
            return;
        }

        setIsLoadingPosition(true);
        setError(null);

        try {
            const result = await getUserLpPosition(
                account.address.toString(),
                market.poolAddress
            );

            if (!result || BigInt(result.lpTokens) === 0n) {
                setPosition(null);
                setPreview(null);
                return;
            }

            setPosition(result);
        } catch (err) {
            console.error('Error loading LP position:', err);
            setPosition(null);
            setPreview(null);
            setError('Failed to load your LP position from the contract.');
        } finally {
            setIsLoadingPosition(false);
        }
    }, [connected, account?.address, market.poolAddress]);

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

    const lpTokensToBurnRaw = useMemo(() => {
        if (!position || percentage === 0) {
            return '0';
        }

        return (
            (BigInt(position.lpTokens) * BigInt(percentage)) /
            100n
        ).toString();
    }, [position, percentage]);

    useEffect(() => {
        const loadPreview = async () => {
            if (
                !position ||
                !canRemoveLiquidity ||
                percentage === 0 ||
                BigInt(lpTokensToBurnRaw) === 0n
            ) {
                setPreview(null);
                return;
            }

            setIsLoadingPreview(true);
            setError(null);

            try {
                const result = await previewRemoveLiquidity(
                    market.poolAddress,
                    lpTokensToBurnRaw
                );

                if (!result) {
                    setPreview(null);
                    setError('Unable to load an executable withdrawal preview.');
                    return;
                }

                setPreview({
                    lpTokensToBurnRaw,
                    yesOutRaw: result.yesOut,
                    noOutRaw: result.noOut,
                });
            } catch (err) {
                console.error('Error previewing liquidity removal:', err);
                setPreview(null);
                setError('Unable to load an executable withdrawal preview.');
            } finally {
                setIsLoadingPreview(false);
            }
        };

        void loadPreview();
    }, [
        position,
        canRemoveLiquidity,
        percentage,
        lpTokensToBurnRaw,
        market.poolAddress,
    ]);

    const handleRemoveLiquidity = async () => {
        if (!connected || !account || !signAndSubmitTransaction) {
            setError('Connect your wallet to remove liquidity.');
            return;
        }

        if (!position || BigInt(position.lpTokens) === 0n) {
            setError('You do not have an LP position in this market.');
            return;
        }

        if (!canRemoveLiquidity) {
            setError('Dynamic pool liquidity can only be removed after market resolution.');
            return;
        }

        if (!preview || BigInt(preview.lpTokensToBurnRaw) === 0n) {
            setError('Wait for a valid on-chain withdrawal preview before submitting.');
            return;
        }

        setIsSubmitting(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const payload = buildRemoveLiquidityPayload(
                market.poolAddress,
                preview.lpTokensToBurnRaw
            );

            await signAndSubmitTransaction({
                sender: account.address,
                data: payload,
            });

            setSuccessMessage(
                `Liquidity removal submitted: ${formatLp(preview.lpTokensToBurnRaw)} LP burned for ${formatOutcome(preview.yesOutRaw)} YES and ${formatOutcome(preview.noOutRaw)} NO.`
            );
            setPercentage(50);

            window.dispatchEvent(
                new CustomEvent('lp-position-updated', {
                    detail: market.poolAddress,
                })
            );
        } catch (err: unknown) {
            console.error('Error removing liquidity:', err);
            setError(err instanceof Error ? err.message : 'Failed to remove liquidity.');
        } finally {
            setIsSubmitting(false);
        }
    };

    useEffect(() => {
        if (!error && !successMessage) {
            return;
        }

        const timer = window.setTimeout(() => {
            setError(null);
            setSuccessMessage(null);
        }, 7000);

        return () => window.clearTimeout(timer);
    }, [error, successMessage]);

    if (isLoadingPosition) {
        return (
            <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-red-500/10 rounded-3xl blur-2xl" />
                <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8">
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
                        <span className="ml-3 text-gray-400">Loading LP position...</span>
                    </div>
                </div>
            </div>
        );
    }

    if (!position || BigInt(position.lpTokens) === 0n) {
        return (
            <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-red-500/10 rounded-3xl blur-2xl" />
                <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8">
                    <div className="text-center py-12">
                        <Minus className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-gray-400 mb-2">No Liquidity Position</h3>
                        <p className="text-gray-500">
                            You do not own LP tokens for this market.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-red-500/10 rounded-3xl blur-2xl" />
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

                {market.isDynamic && !canRemoveLiquidity && (
                    <motion.div
                        className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <div className="flex items-start space-x-3">
                            <Clock className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                            <div>
                                <div className="font-semibold text-yellow-400 mb-1">
                                    Liquidity Locked Until Resolution
                                </div>
                                <div className="text-sm text-yellow-300">
                                    Dynamic-pool LP tokens remain locked while the market is live.
                                    After resolution, withdrawing LP tokens returns your proportional
                                    YES and NO reserve share, including distributed swap-fee balances.
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

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

                {successMessage && (
                    <motion.div
                        className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-xl"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <span className="text-sm text-green-300">{successMessage}</span>
                    </motion.div>
                )}

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
                        onChange={(e) => setPercentage(Number(e.target.value))}
                        className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer slider"
                        style={{
                            background: `linear-gradient(to right, rgb(251 146 60) 0%, rgb(239 68 68) ${percentage}%, rgba(255,255,255,0.1) ${percentage}%, rgba(255,255,255,0.1) 100%)`,
                        }}
                    />

                    <div className="flex gap-2 mt-4">
                        {[25, 50, 75, 100].map((value) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => setPercentage(value)}
                                className={`flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                                    percentage === value
                                        ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white'
                                        : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                                }`}
                            >
                                {value}%
                            </button>
                        ))}
                    </div>
                </div>

                <div className="mb-6 p-4 bg-white/5 rounded-2xl">
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-400">LP Tokens Owned</span>
                        <span className="text-white font-semibold">
                            {formatLp(position.lpTokens)}
                        </span>
                    </div>
                    <div className="flex justify-between text-sm mt-2">
                        <span className="text-gray-400">LP Tokens to Burn</span>
                        <span className="text-white font-semibold">
                            {formatLp(lpTokensToBurnRaw)}
                        </span>
                    </div>
                </div>

                <div className="mb-6">
                    <div className="text-sm text-gray-400 mb-3">
                        Executable on-chain withdrawal preview
                    </div>

                    {isLoadingPreview ? (
                        <div className="p-5 bg-white/5 rounded-xl flex items-center justify-center text-gray-400">
                            <Loader2 className="w-5 h-5 animate-spin mr-2" />
                            Loading preview...
                        </div>
                    ) : preview ? (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                                <div>
                                    <div className="text-sm text-gray-400 mb-1">YES Tokens</div>
                                    <div className="text-2xl font-bold text-white">
                                        {formatOutcome(preview.yesOutRaw)}
                                    </div>
                                </div>
                                <div className="px-3 py-1 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg text-sm font-bold">
                                    YES
                                </div>
                            </div>

                            <div className="flex items-center justify-between p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                                <div>
                                    <div className="text-sm text-gray-400 mb-1">NO Tokens</div>
                                    <div className="text-2xl font-bold text-white">
                                        {formatOutcome(preview.noOutRaw)}
                                    </div>
                                </div>
                                <div className="px-3 py-1 bg-gradient-to-r from-red-500 to-rose-500 rounded-lg text-sm font-bold">
                                    NO
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="p-4 bg-white/5 rounded-xl text-sm text-gray-400">
                            {canRemoveLiquidity
                                ? 'Select a non-zero amount to load an executable preview.'
                                : 'A withdrawal preview becomes available after this dynamic market is resolved.'}
                        </div>
                    )}
                </div>

                <motion.button
                    type="button"
                    onClick={handleRemoveLiquidity}
                    disabled={
                        !connected ||
                        isSubmitting ||
                        !canRemoveLiquidity ||
                        !preview ||
                        percentage === 0
                    }
                    className={`w-full py-4 rounded-xl font-bold text-white transition-all duration-300 ${
                        !connected ||
                        isSubmitting ||
                        !canRemoveLiquidity ||
                        !preview ||
                        percentage === 0
                            ? 'bg-gray-600 cursor-not-allowed'
                            : 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600'
                    }`}
                    whileHover={
                        !connected || isSubmitting || !canRemoveLiquidity || !preview
                            ? {}
                            : { scale: 1.02 }
                    }
                    whileTap={
                        !connected || isSubmitting || !canRemoveLiquidity || !preview
                            ? {}
                            : { scale: 0.98 }
                    }
                >
                    <span className="flex items-center justify-center space-x-2">
                        {isSubmitting ? (
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
                        ) : !preview ? (
                            <>
                                <Loader2 className="w-5 h-5" />
                                <span>Waiting for Preview</span>
                            </>
                        ) : (
                            <>
                                <Minus className="w-5 h-5" />
                                <span>Remove {percentage}% Liquidity</span>
                            </>
                        )}
                    </span>
                </motion.button>

                <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-start space-x-2">
                    <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-gray-400">
                        <div className="font-semibold text-blue-400 mb-1">
                            Withdrawal Calculation
                        </div>
                        <div>
                            The displayed YES and NO amounts come from the on-chain
                            removal preview and include your proportional reserve
                            withdrawal plus allocated swap-fee balances.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}