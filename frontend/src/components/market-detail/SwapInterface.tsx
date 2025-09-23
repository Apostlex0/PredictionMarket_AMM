// src/components/market-detail/SwapInterface.tsx
'use client';
import { useState } from 'react';
import { ArrowDown, Info, Zap, Sparkles, TrendingUp, Activity, RotateCcw } from 'lucide-react';
import { motion } from 'framer-motion';

interface Market {
    id: string;
    probability: number;
    yesTokenAddress: string;
    noTokenAddress: string;
}

export default function SwapInterface({ market }: { market: Market }) {
    const [fromToken, setFromToken] = useState<'YES' | 'NO'>('NO');
    const [toToken, setToToken] = useState<'YES' | 'NO'>('YES');
    const [amount, setAmount] = useState('');
    const [estimatedOutput, setEstimatedOutput] = useState('0.00');

    const handleSwapDirection = () => {
        setFromToken(toToken);
        setToToken(fromToken);
    };

    const yesPrice = market.probability;
    const noPrice = 1 - market.probability;

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
                        >
                            Balance: 0.00
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
                                    className="bg-transparent text-2xl font-bold text-white outline-none flex-1 placeholder-gray-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                                <span>≈ ${fromToken === 'YES' ? yesPrice.toFixed(3) : noPrice.toFixed(3)} per token</span>
                            </motion.div>
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
                    >
                        <motion.div
                            className="absolute inset-0 bg-gradient-to-r from-white/30 to-cyan-300/30"
                            initial={{ scale: 0, opacity: 0 }}
                            whileHover={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.3 }}
                        />
                        <motion.div
                            animate={{ rotate: [0, 360] }}
                            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                            className="relative z-10"
                        >
                            <RotateCcw className="w-5 h-5 text-white" />
                        </motion.div>
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
                            <ArrowDown className="w-4 h-4" />
                            <span>To (estimated)</span>
                        </motion.span>
                        <motion.span 
                            className="text-sm text-gray-400 hover:text-cyan-400 transition-colors cursor-pointer px-3 py-1 bg-white/5 rounded-full border border-white/10"
                            whileHover={{ scale: 1.05 }}
                        >
                            Balance: 0.00
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
                                    key={estimatedOutput}
                                    initial={{ scale: 1.1, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    {estimatedOutput}
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
                                <span>≈ ${toToken === 'YES' ? yesPrice.toFixed(3) : noPrice.toFixed(3)} per token</span>
                            </motion.div>
                        </div>
                    </motion.div>
                </motion.div>

                {/* Enhanced Trade Info - Reduced padding */}
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
                        <span className="text-white font-semibold">~2.5%</span>
                    </motion.div>
                    <motion.div 
                        className="flex items-center justify-between text-sm"
                        whileHover={{ x: 3 }}
                    >
                        <span className="text-gray-400">Slippage Tolerance</span>
                        <motion.button 
                            className="text-purple-400 hover:text-purple-300 transition-colors"
                            whileHover={{ scale: 1.05 }}
                        >
                            0.5% <span className="text-gray-600">Edit</span>
                        </motion.button>
                    </motion.div>
                    <motion.div 
                        className="flex items-center justify-between text-sm"
                        whileHover={{ x: 3 }}
                    >
                        <span className="text-gray-400">Trading Fee</span>
                        <span className="text-white font-semibold">0.3%</span>
                    </motion.div>
                </motion.div>

                {/* Enhanced Swap Button - Reduced padding */}
                <motion.button 
                    className="w-full py-4 bg-gradient-to-r from-cyan-500 via-blue-500 via-purple-500 to-pink-500 hover:from-cyan-400 hover:via-blue-400 hover:via-purple-400 hover:to-pink-400 rounded-2xl font-bold text-white text-lg transition-all duration-300 relative overflow-hidden shadow-2xl shadow-cyan-500/30 border border-white/20 group"
                    whileHover={{ 
                        scale: 1.02, 
                        boxShadow: "0 25px 50px -12px rgba(6, 182, 212, 0.5)",
                        borderColor: "rgba(255, 255, 255, 0.3)"
                    }}
                    whileTap={{ scale: 0.98 }}
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
                            <span className="font-semibold text-cyan-300">Smart Trading:</span> Our advanced pm-AMM automatically calculates optimal exchange rates based on current market conditions.
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