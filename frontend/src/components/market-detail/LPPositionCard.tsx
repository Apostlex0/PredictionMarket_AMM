// src/components/market-detail/LPPositionCard.tsx
'use client';
import { Droplets, TrendingUp, Coins } from 'lucide-react';

export default function LPPositionCard({ marketId }: { marketId: string }) {
    // Mock LP position data
    const position = {
        lpTokens: 100,
        poolShare: 2.5,
        yesTokens: 67,
        noTokens: 33,
        totalValue: 100,
        feesEarned: 3.2,
        lvr: -1.8,
    };

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

                    {/* LP Tokens */}
                    <div className="mb-6 p-4 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 rounded-2xl">
                        <div className="text-sm text-gray-400 mb-2">LP Tokens</div>
                        <div className="text-3xl font-bold text-white mb-1">{position.lpTokens}</div>
                        <div className="text-sm text-cyan-400">{position.poolShare}% of pool</div>
                    </div>

                    {/* Underlying Tokens */}
                    <div className="space-y-3 mb-6">
                        <div className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/30 rounded-xl">
                            <span className="text-sm text-gray-400">YES Tokens</span>
                            <span className="text-lg font-bold text-white">{position.yesTokens}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                            <span className="text-sm text-gray-400">NO Tokens</span>
                            <span className="text-lg font-bold text-white">{position.noTokens}</span>
                        </div>
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
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-400">LVR Cost</span>
                            <span className="text-orange-400 font-semibold">${position.lvr.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between pt-3 border-t border-white/10">
                            <span className="text-sm text-gray-400">Net P&L</span>
                            <span className="text-green-400 font-bold">
                                +${(position.feesEarned + position.lvr).toFixed(2)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}