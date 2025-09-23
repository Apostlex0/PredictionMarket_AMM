// src/components/market-detail/RemoveLiquidityForm.tsx
'use client';
import { useState } from 'react';
import { Minus, Info } from 'lucide-react';

interface Market {
    id: string;
    probability: number;
}

export default function RemoveLiquidityForm({ market }: { market: Market }) {
    const [percentage, setPercentage] = useState(50);

    // Mock LP position data
    const lpPosition = {
        lpTokens: 100,
        yesTokens: 67,
        noTokens: 33,
        value: 100,
    };

    const yesToReceive = (lpPosition.yesTokens * percentage / 100).toFixed(2);
    const noToReceive = (lpPosition.noTokens * percentage / 100).toFixed(2);

    return (
        <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-red-500/10 rounded-3xl blur-2xl"></div>
            <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8">
                <div className="flex items-center space-x-3 mb-6">
                    <Minus className="w-6 h-6 text-orange-400" />
                    <h3 className="text-2xl font-bold font-[family-name:var(--font-geist-mono)]">
                        Remove Liquidity
                    </h3>
                </div>

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
                <button className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 rounded-xl font-bold text-white transition-all duration-300 hover:scale-105">
                    Remove Liquidity
                </button>

                {/* Info */}
                <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-start space-x-2">
                    <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-gray-400">
                        Removing liquidity returns your proportional share of both YES and NO tokens from the pool.
                    </p>
                </div>
            </div>
        </div>
    );
}