// src/components/market-detail/AddLiquidityForm.tsx
'use client';
import { useState } from 'react';
import { Plus, Info, AlertCircle } from 'lucide-react';

interface Market {
    id: string;
    probability: number;
    liquidity: number;
}

export default function AddLiquidityForm({ market }: { market: Market }) {
    const [yesAmount, setYesAmount] = useState('');
    const [noAmount, setNoAmount] = useState('');
    const [autoBalance, setAutoBalance] = useState(true);

    const handleYesChange = (value: string) => {
        setYesAmount(value);
        if (autoBalance && value) {
            // Auto-balance based on current pool ratio
            const ratio = market.probability / (1 - market.probability);
            setNoAmount((parseFloat(value) * ratio).toFixed(2));
        }
    };

    const expectedLPTokens = parseFloat(yesAmount || '0') + parseFloat(noAmount || '0');
    const poolShare = (expectedLPTokens / (market.liquidity + expectedLPTokens) * 100).toFixed(2);

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

                {/* Auto-balance Toggle */}
                <div className="mb-6 p-4 bg-white/5 rounded-2xl flex items-center justify-between">
                    <div>
                        <div className="text-sm font-medium text-white mb-1">Auto-balance amounts</div>
                        <div className="text-xs text-gray-500">Match current pool ratio</div>
                    </div>
                    <button
                        onClick={() => setAutoBalance(!autoBalance)}
                        className={`relative w-14 h-7 rounded-full transition-colors ${autoBalance ? 'bg-gradient-to-r from-cyan-500 to-blue-500' : 'bg-white/20'
                            }`}
                    >
                        <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${autoBalance ? 'translate-x-7' : 'translate-x-0'
                            }`}></div>
                    </button>
                </div>

                {/* YES Token Input */}
                <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-400">YES Tokens</span>
                        <span className="text-sm text-gray-400">Balance: 0.00</span>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                        <div className="flex items-center justify-between">
                            <input
                                type="number"
                                value={yesAmount}
                                onChange={(e) => handleYesChange(e.target.value)}
                                placeholder="0.00"
                                className="bg-transparent text-2xl font-bold text-white outline-none w-full"
                            />
                            <div className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl font-bold text-sm">
                                YES
                            </div>
                        </div>
                    </div>
                </div>

                {/* Plus Icon */}
                <div className="flex justify-center -my-2 relative z-10">
                    <div className="p-2 bg-white/10 border border-white/20 rounded-lg">
                        <Plus className="w-4 h-4 text-gray-400" />
                    </div>
                </div>

                {/* NO Token Input */}
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-400">NO Tokens</span>
                        <span className="text-sm text-gray-400">Balance: 0.00</span>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                        <div className="flex items-center justify-between">
                            <input
                                type="number"
                                value={noAmount}
                                onChange={(e) => {
                                    setNoAmount(e.target.value);
                                    if (autoBalance) setAutoBalance(false);
                                }}
                                placeholder="0.00"
                                className="bg-transparent text-2xl font-bold text-white outline-none w-full"
                            />
                            <div className="px-4 py-2 bg-gradient-to-r from-red-500 to-rose-500 rounded-xl font-bold text-sm">
                                NO
                            </div>
                        </div>
                    </div>
                </div>

                {/* Expected Output */}
                <div className="mb-6 p-4 bg-white/5 rounded-2xl space-y-3">
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-400">LP Tokens to Receive</span>
                        <span className="text-white font-semibold">{expectedLPTokens.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Share of Pool</span>
                        <span className="text-white font-semibold">{poolShare}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Current Pool Ratio</span>
                        <span className="text-white">{(market.probability * 100).toFixed(1)}% / {((1 - market.probability) * 100).toFixed(1)}%</span>
                    </div>
                </div>

                {/* Warning about LVR */}
                <div className="mb-6 p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl flex items-start space-x-3">
                    <AlertCircle className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-gray-300">
                        <div className="font-semibold text-orange-400 mb-1">Impermanent Loss Warning</div>
                        <div>
                            Providing liquidity exposes you to loss-vs-rebalancing (LVR). The pm-AMM minimizes this compared to traditional AMMs, but risk remains.
                        </div>
                    </div>
                </div>

                {/* Add Liquidity Button */}
                <button className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 rounded-xl font-bold text-white transition-all duration-300 hover:scale-105">
                    Add Liquidity
                </button>

                {/* Info */}
                <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-start space-x-2">
                    <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-gray-400">
                        Don't have both tokens? Use the "Mint Set" tab to get equal amounts of YES and NO tokens.
                    </p>
                </div>
            </div>
        </div>
    );
}