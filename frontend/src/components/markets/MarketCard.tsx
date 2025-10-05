// src/components/markets/MarketCard.tsx
'use client';
import Link from 'next/link';
import { Clock, Users, TrendingUp, Droplets, Sparkles, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { Market } from '@/types/market';

export default function MarketCard({ market }: { market: Market }) {
  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
    return `$${value}`;
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      crypto: 'from-cyan-400 to-blue-500',
      technology: 'from-blue-400 to-purple-500',
      sports: 'from-emerald-400 to-teal-500',
      politics: 'from-pink-400 to-rose-500',
      entertainment: 'from-purple-400 to-violet-500',
    };
    return colors[category] || 'from-gray-400 to-slate-500';
  };

  const probabilityPercentage = market.probability.toFixed(0);

  return (
    <Link href={`/markets/${market.id}`}>
      <motion.div 
        className="group relative h-full"
        whileHover={{ scale: 1.02 }}
        transition={{ duration: 0.2 }}
      >
        {/* Subtle Hover Glow */}
        <motion.div 
          className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 rounded-3xl blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          animate={{
            scale: [1, 1.02, 1],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        
        <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-6 h-full transition-all duration-300 group-hover:border-cyan-400/40 group-hover:bg-white/8 group-hover:shadow-xl group-hover:shadow-cyan-500/5 flex flex-col">
          {/* Enhanced Category Badge */}
          <div className="flex items-center justify-between mb-4">
            <motion.span 
              className={`px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r ${getCategoryColor(market.category)} text-white shadow-lg`}
              whileHover={{ scale: 1.05 }}
            >
              {market.category.toUpperCase()}
            </motion.span>
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDistanceToNow(market.expiresAt, { addSuffix: true })}
            </span>
          </div>

          {/* Enhanced Question */}
          <motion.h3 
            className="text-lg font-bold text-white mb-4 line-clamp-2 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-cyan-400 group-hover:to-blue-400 group-hover:bg-clip-text transition-all duration-300"
            whileHover={{ scale: 1.01 }}
          >
            {market.question}
          </motion.h3>

          {/* Enhanced Probability Bar */}
          <div className="mb-6 flex-grow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400 flex items-center gap-1">
                <Zap className="w-3 h-3 text-cyan-400" />
                Probability
              </span>
              <span className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 text-transparent bg-clip-text">
                {probabilityPercentage}%
              </span>
            </div>
            <div className="h-3 bg-white/5 rounded-full overflow-hidden relative">
              <div 
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-500 group-hover:shadow-sm group-hover:shadow-cyan-400/50"
                style={{ width: `${probabilityPercentage}%` }}
              />
            </div>
          </div>

          {/* Enhanced Stats Grid */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
            <StatItem
              icon={<TrendingUp className="w-4 h-4" />}
              label="Volume"
              value={formatCurrency(market.totalVolume)}
              color="text-emerald-400"
            />
            <StatItem
              icon={<Droplets className="w-4 h-4" />}
              label="Liquidity"
              value={formatCurrency(market.liquidity)}
              color="text-blue-400"
            />
            <StatItem
              icon={<Users className="w-4 h-4" />}
              label="Traders"
              value={market.totalTraders.toLocaleString()}
              color="text-purple-400"
            />
            <StatItem
              icon={<Clock className="w-4 h-4" />}
              label="Expires"
              value={formatDistanceToNow(market.expiresAt)}
              color="text-pink-400"
            />
          </div>

          {/* Enhanced Hover Arrow */}
          <motion.div 
            className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity"
            whileHover={{ scale: 1.2, rotate: 5 }}
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/50">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
          </motion.div>
        </div>
      </motion.div>
    </Link>
  );
}

function StatItem({ icon, label, value, color = "text-white" }: { 
  icon: React.ReactNode; 
  label: string; 
  value: string; 
  color?: string;
}) {
  return (
    <motion.div 
      className="flex items-center space-x-2 group/stat"
      whileHover={{ scale: 1.05 }}
    >
      <div className={`text-gray-500 group-hover/stat:${color} transition-colors duration-300`}>{icon}</div>
      <div>
        <div className="text-xs text-gray-500 group-hover/stat:text-gray-400 transition-colors">{label}</div>
        <div className={`text-sm font-semibold ${color} group-hover/stat:scale-105 transition-transform`}>{value}</div>
      </div>
    </motion.div>
  );
}