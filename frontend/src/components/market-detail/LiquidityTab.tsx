// src/components/market-detail/LiquidityTab.tsx
'use client';
import { useState } from 'react';
import AddLiquidityForm from './AddLiquidityForm';
import RemoveLiquidityForm from './RemoveLiquidityForm';
import LPPositionCard from './LPPositionCard';
import { Market } from '@/types/market';

export default function LiquidityTab({ market }: { market: Market }) {
    const [activeView, setActiveView] = useState<'add' | 'remove'>('add');

    return (
        <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Liquidity Interface */}
            <div className="lg:col-span-2">
                {/* Toggle between Add and Remove */}
                <div className="flex space-x-2 mb-6">
                    <button
                        onClick={() => setActiveView('add')}
                        className={`flex-1 px-6 py-3 rounded-xl font-medium transition-all duration-300 ${activeView === 'add'
                                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white'
                                : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                            }`}
                    >
                        Add Liquidity
                    </button>
                    <button
                        onClick={() => setActiveView('remove')}
                        className={`flex-1 px-6 py-3 rounded-xl font-medium transition-all duration-300 ${activeView === 'remove'
                                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white'
                                : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                            }`}
                    >
                        Remove Liquidity
                    </button>
                </div>

                {activeView === 'add' ? (
                    <AddLiquidityForm market={market} />
                ) : (
                    <RemoveLiquidityForm market={market} />
                )}
            </div>

            {/* Sidebar - LP Position */}
            <div className="lg:col-span-1">
                <LPPositionCard market={market} />
            </div>
        </div>
    );
}