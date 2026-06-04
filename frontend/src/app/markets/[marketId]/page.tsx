// src/app/markets/[marketId]/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, TrendingUp, Droplets, Loader2, Shield, Gift } from 'lucide-react';
import { motion } from 'framer-motion';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import MarketHeader from '@/components/market-detail/MarketHeader';
import TradingTab from '@/components/market-detail/TradingTab';
import LiquidityTab from '@/components/market-detail/LiquidityTab';
import MarketPhaseIndicator from '@/components/market-detail/MarketPhaseIndicator';
import MarketResolution from '@/components/market-detail/MarketResolution';
import SettlementInterface from '@/components/market-detail/SettlementInterface';
import { Market } from '@/types/market';
import { getAllMarkets } from '@/lib/aptos_service';

type Tab = 'trade' | 'liquidity' | 'resolve' | 'settle';

export default function MarketDetailPage() {
  const params = useParams();
  const marketId = params.marketId as string;
  const { account, connected } = useWallet();
  const [activeTab, setActiveTab] = useState<Tab>('trade');
  
  // Market data state
  const [market, setMarket] = useState<Market | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadMarket = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const realMarkets = await getAllMarkets();
        const realMarket = realMarkets.find((candidate) => candidate.id === marketId);

        if (cancelled) {
          return;
        }

        if (!realMarket) {
          setMarket(null);
          setError('Market not found on-chain.');
          return;
        }

        setMarket(realMarket);
      } catch (loadError) {
        console.error('Error loading market:', loadError);

        if (!cancelled) {
          setMarket(null);
          setError('Could not load market from the contract.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadMarket();

    return () => {
      cancelled = true;
    };
  }, [marketId]);

  // Loading state
  if (isLoading) {
    return (
      <>
        <Navigation />
        <main className="min-h-screen bg-black text-white pt-24 pb-16 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mr-3" />
              <span className="text-gray-400">Loading market...</span>
            </div>
          </div>
        </main>
      </>
    );
  }

  // Error state
  if (error || !market) {
    return (
      <>
        <Navigation />
        <main className="min-h-screen bg-black text-white pt-24 pb-16 px-6">
          <div className="max-w-7xl mx-auto text-center">
            <h1 className="text-4xl font-bold mb-4">
              {error ? 'Error Loading Market' : 'Market Not Found'}
            </h1>
            <p className="text-gray-400 mb-8">
              {error || "The market you're looking for doesn't exist."}
            </p>
            <Link 
              href="/markets"
              className="inline-flex items-center space-x-2 text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Markets</span>
            </Link>
          </div>
        </main>
      </>
    );
  }

  const canResolve =
    connected &&
    account &&
    market &&
    !market.resolved &&
    market.creator.toLowerCase() === account.address.toString().toLowerCase();

  const tabs = [
    { id: 'trade' as Tab, label: 'Trade', description: 'Mint or exchange outcome tokens', icon: TrendingUp },
    { id: 'liquidity' as Tab, label: 'Liquidity', description: 'Manage your LP position', icon: Droplets },
    ...(canResolve ? [{ id: 'resolve' as Tab, label: 'Resolve', description: 'Creator-resolve the outcome', icon: Shield }] : []),
    ...(market.resolved ? [{ id: 'settle' as Tab, label: 'Settle', description: 'Redeem winning tokens', icon: Gift }] : []),
  ];

  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-black text-white pt-24 pb-16 px-6">
        {/* Enhanced Background Effects */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <motion.div 
            className="absolute top-20 right-1/4 w-96 h-96 bg-gradient-to-r from-blue-500/8 to-cyan-500/8 rounded-full blur-3xl"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
          <motion.div 
            className="absolute bottom-40 left-1/3 w-96 h-96 bg-gradient-to-r from-purple-500/8 to-pink-500/8 rounded-full blur-3xl"
            animate={{
              scale: [1.2, 1, 1.2],
              opacity: [0.4, 0.7, 0.4],
            }}
            transition={{
              duration: 6,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
          <motion.div 
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-emerald-500/5 to-teal-500/5 rounded-full blur-3xl"
            animate={{
              rotate: [0, 360],
              scale: [0.8, 1.1, 0.8],
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: "linear"
            }}
          />
        </div>

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Enhanced Back Button */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Link 
            href="/markets"
            className="inline-flex items-center space-x-2 text-gray-400 hover:text-cyan-400 transition-colors mb-8 group"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span>Back to Markets</span>
          </Link>
        </motion.div>

        {/* Market Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <MarketHeader market={market} />
        </motion.div>

        {/* Phase Indicator */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <MarketPhaseIndicator market={market} />
        </motion.div>

        {/* Enhanced Tabs */}
        <motion.div 
          className="flex space-x-2 mb-8 border-b border-white/10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          {tabs.map((tab, index) => {
            const IconComponent = tab.icon;
            return (
              <motion.button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative px-6 py-4 transition-all duration-300 group ${
                  activeTab === tab.id
                    ? 'text-white'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.8 + index * 0.1 }}
              >
                <div className="flex items-center space-x-2 mb-1">
                  <IconComponent className={`w-4 h-4 ${activeTab === tab.id ? 'text-cyan-400' : 'text-gray-500 group-hover:text-cyan-400'} transition-colors`} />
                  <span className="font-semibold font-[family-name:var(--font-geist-mono)]">
                    {tab.label}
                  </span>
                </div>
                <span className="text-xs text-gray-600 block text-left">{tab.description}</span>
                {activeTab === tab.id && (
                  <motion.div 
                    className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-cyan-500 to-blue-500"
                    layoutId="activeTab"
                    transition={{ duration: 0.3 }}
                  />
                )}
              </motion.button>
            );
          })}
        </motion.div>

        {/* Tab Content */}
        <motion.div 
          className="mt-8"
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {activeTab === 'trade' && <TradingTab market={market} />}
          {activeTab === 'liquidity' && <LiquidityTab market={market} />}
          {activeTab === 'resolve' && <MarketResolution 
            market={market} 
            onResolutionComplete={() => {
              // Refresh market data after resolution
              window.location.reload();
            }} 
          />}
          {activeTab === 'settle' && <SettlementInterface 
            market={market} 
            onSettlementComplete={() => {
              // Refresh market data after settlement
              window.location.reload();
            }} 
          />}
        </motion.div>
        </div>
      </main>
    </>
  );
}