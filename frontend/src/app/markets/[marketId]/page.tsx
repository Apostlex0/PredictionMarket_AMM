// src/app/markets/[marketId]/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Share2, TrendingUp, Droplets, BarChart3, Sparkles, Loader2, Bookmark, Clock, ExternalLink, Shield, Gift } from 'lucide-react';
import { motion } from 'framer-motion';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import MarketHeader from '@/components/market-detail/MarketHeader';
import TradingTab from '@/components/market-detail/TradingTab';
import LiquidityTab from '@/components/market-detail/LiquidityTab';
import AnalyticsTab from '@/components/market-detail/AnalyticsTab';
import MarketPhaseIndicator from '@/components/market-detail/MarketPhaseIndicator';
import MarketResolution from '@/components/market-detail/MarketResolution';
import SettlementInterface from '@/components/market-detail/SettlementInterface';
import { Market } from '@/types/market';
import { getAllMarkets } from '@/lib/aptos_service';

type Tab = 'trade' | 'liquidity' | 'analytics' | 'resolve' | 'settle';

export default function MarketDetailPage() {
  const params = useParams();
  const marketId = params.marketId as string;
  const { account, connected } = useWallet();
  const [activeTab, setActiveTab] = useState<Tab>('trade');
  
  // Market data state
  const [market, setMarket] = useState<Market | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mock markets for presentation (same as markets page)
  const getMockMarkets = (): Market[] => [
    {
      id: 'mock-1',
      question: 'Will Bitcoin reach $100,000 by end of 2024?',
      description: 'This market resolves to YES if Bitcoin (BTC) trades at or above $100,000 on any major exchange before December 31, 2024 23:59:59 UTC.',
      category: 'crypto',
      probability: 67,
      totalVolume: 234567,
      liquidity: 45678,
      expiresAt: new Date('2024-12-31'),
      createdAt: new Date('2024-01-01'),
      totalTraders: 1234,
      resolved: false,
      creator: '0x742d...8f9a',
      isDynamic: false,
      feeRate: 30,
      initialProbability: 50,
      yesTokenAddress: '0x1234...5678',
      noTokenAddress: '0x8765...4321',
      lpTokenAddress: '0xabcd...efgh',
      poolAddress: '0xabcd...efgh',
      marketAuthority: '0x742d...8f9a',
    },
    {
      id: 'mock-2',
      question: 'Will AI achieve AGI before 2030?',
      description: 'This market resolves to YES if Artificial General Intelligence (AGI) is achieved and publicly demonstrated by any organization before January 1, 2030 00:00:00 UTC.',
      category: 'technology',
      probability: 23,
      totalVolume: 567890,
      liquidity: 123456,
      expiresAt: new Date('2030-01-01'),
      createdAt: new Date('2024-02-15'),
      totalTraders: 3456,
      resolved: false,
      creator: '0x123a...4b5c',
      isDynamic: true,
      feeRate: 30,
      initialProbability: 25,
      yesTokenAddress: '0x2345...6789',
      noTokenAddress: '0x9876...5432',
      lpTokenAddress: '0xbcde...fghi',
      poolAddress: '0xbcde...fghi',
      marketAuthority: '0x123a...4b5c',
    },
    {
      id: 'mock-3',
      question: 'Will Ethereum surpass Bitcoin in market cap?',
      description: 'This market resolves to YES if Ethereum (ETH) market capitalization exceeds Bitcoin (BTC) market capitalization for at least 7 consecutive days before the expiration date.',
      category: 'crypto',
      probability: 15,
      totalVolume: 123456,
      liquidity: 34567,
      expiresAt: new Date('2025-06-30'),
      createdAt: new Date('2024-03-10'),
      totalTraders: 892,
      resolved: false,
      creator: '0x456d...7e8f',
      isDynamic: false,
      feeRate: 30,
      initialProbability: 20,
      yesTokenAddress: '0x3456...7890',
      noTokenAddress: '0x0987...6543',
      lpTokenAddress: '0xcdef...ghij',
      poolAddress: '0xcdef...ghij',
      marketAuthority: '0x456d...7e8f',
    },
    {
      id: 'mock-4',
      question: 'Will Manchester City win the Premier League 2024-25?',
      description: 'This market resolves to YES if Manchester City FC wins the Premier League title for the 2024-25 season.',
      category: 'sports',
      probability: 45,
      totalVolume: 89234,
      liquidity: 23456,
      expiresAt: new Date('2025-05-25'),
      createdAt: new Date('2024-08-15'),
      totalTraders: 567,
      resolved: false,
      creator: '0x789g...0h1i',
      isDynamic: true,
      feeRate: 30,
      initialProbability: 40,
      yesTokenAddress: '0x4567...8901',
      noTokenAddress: '0x1098...7654',
      lpTokenAddress: '0xdefg...hijk',
      poolAddress: '0xdefg...hijk',
      marketAuthority: '0x789g...0h1i',
    },
    {
      id: 'mock-5',
      question: 'Will the next US President be a Democrat?',
      description: 'This market resolves to YES if the candidate from the Democratic Party wins the 2024 US Presidential Election.',
      category: 'politics',
      probability: 52,
      totalVolume: 1234567,
      liquidity: 345678,
      expiresAt: new Date('2025-01-20'),
      createdAt: new Date('2024-01-15'),
      totalTraders: 5678,
      resolved: false,
      creator: '0xabc1...2def',
      isDynamic: false,
      feeRate: 30,
      initialProbability: 50,
      yesTokenAddress: '0x5678...9012',
      noTokenAddress: '0x2109...8765',
      lpTokenAddress: '0xefgh...ijkl',
      poolAddress: '0xefgh...ijkl',
      marketAuthority: '0xabc1...2def',
    },
    {
      id: 'mock-6',
      question: 'Will SpaceX land humans on Mars by 2030?',
      description: 'This market resolves to YES if SpaceX successfully lands human astronauts on the surface of Mars before January 1, 2030 00:00:00 UTC.',
      category: 'science',
      probability: 18,
      totalVolume: 345678,
      liquidity: 67890,
      expiresAt: new Date('2030-01-01'),
      createdAt: new Date('2024-03-20'),
      totalTraders: 2345,
      resolved: false,
      creator: '0x234b...5cde',
      isDynamic: true,
      feeRate: 30,
      initialProbability: 15,
      yesTokenAddress: '0x6789...0123',
      noTokenAddress: '0x3210...9876',
      lpTokenAddress: '0xfghi...jklm',
      poolAddress: '0xfghi...jklm',
      marketAuthority: '0x234b...5cde',
    },
  ];

  // Load market data (mock or real)
  useEffect(() => {
    const loadMarket = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Check if it's a mock market first
        const mockMarkets = getMockMarkets();
        const mockMarket = mockMarkets.find(m => m.id === marketId);
        
        if (mockMarket) {
          // It's a mock market, use mock data
          setMarket(mockMarket);
        } else {
          // It's potentially a real market, try to load from contract
          try {
            // For real markets, we need to load from contract
            // Since we don't have getMarketInfo by ID, we'll load all markets and find the one
            const realMarkets = await getAllMarkets();

            const realMarket = realMarkets.find(m => m.id === marketId);
            if (realMarket) {
              setMarket(realMarket);
            } else {
              setError('Market not found');
            }
          } catch (contractError) {
            console.error('Error loading real market:', contractError);
            setError('Could not load market from contract');
          }
        }
      } catch (error) {
        console.error('Error loading market:', error);
        setError('Failed to load market');
      } finally {
        setIsLoading(false);
      }
    };

    loadMarket();
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

  // Check if user can resolve this market
  const canResolve = connected && account && market && !market.resolved && (
    // Market creator can resolve
    market.creator === account.address.toString() ||
    // For demo purposes, allow any connected user to resolve mock markets
    market.id.startsWith('mock-')
  );

  const tabs = [
    { id: 'trade' as Tab, label: 'Trade', description: 'Buy YES or NO tokens', icon: TrendingUp },
    { id: 'liquidity' as Tab, label: 'Liquidity', description: 'Add or remove liquidity', icon: Droplets },
    { id: 'analytics' as Tab, label: 'Analytics', description: 'View market statistics', icon: BarChart3 },
    ...(canResolve ? [{ id: 'resolve' as Tab, label: 'Resolve', description: 'Resolve market outcome', icon: Shield }] : []),
    ...(market?.resolved ? [{ id: 'settle' as Tab, label: 'Settle', description: 'Claim your winnings', icon: Gift }] : []),
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
          <MarketPhaseIndicator 
            expiresAt={market.expiresAt}
            resolved={market.resolved}
          />
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
          {activeTab === 'analytics' && <AnalyticsTab market={market} />}
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