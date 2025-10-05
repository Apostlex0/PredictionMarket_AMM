// src/app/markets/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { Search, Filter, TrendingUp, Clock, DollarSign, Sparkles, Zap, Activity, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import Navigation from '@/components/Navigation';
import MarketCard from '@/components/markets/MarketCard';
import MarketFilters from '@/components/markets/MarketFilters';
import { getAllMarkets } from '@/lib/aptos_service';
import { Market, MarketSortBy } from '@/types/market';

export default function MarketsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState<MarketSortBy>('volume');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  
  // Market data state
  const [allMarkets, setAllMarkets] = useState<Market[]>([]);
  const [isLoadingRealMarkets, setIsLoadingRealMarkets] = useState(true);
  const [realMarketsError, setRealMarketsError] = useState<string | null>(null);

  const sortOptions = [
    { id: 'volume', label: 'Highest Volume', icon: '📈', description: 'Sort by trading volume' },
    { id: 'liquidity', label: 'Most Liquidity', icon: '💧', description: 'Sort by available liquidity' },
    { id: 'ending-soon', label: 'Ending Soon', icon: '⏰', description: 'Markets closing soon' },
    { id: 'newest', label: 'Newest', icon: '✨', description: 'Recently created markets' },
  ];

  const selectedSortOption = sortOptions.find(option => option.id === sortBy) || sortOptions[0];

  // Mock markets for presentation (always shown as filler)
  const getMockMarkets = (): Market[] => [
    {
      id: 'mock-1',
      question: 'Will Bitcoin reach $100,000 by end of 2024?',
      description: 'Demo market for presentation purposes',
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
      description: 'Demo market for presentation purposes',
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
      description: 'Demo market for presentation purposes',
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
      description: 'Demo market for presentation purposes',
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
      description: 'Demo market for presentation purposes',
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
      description: 'Demo market for presentation purposes',
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

  // Load real markets from contract
  useEffect(() => {
    const loadRealMarkets = async () => {
      try {
        setIsLoadingRealMarkets(true);
        setRealMarketsError(null);
        
        // Get mock markets first (always available)
        const mockMarkets = getMockMarkets();
        
        try {
          // Try to load real markets from contract
          const realMarkets = await getAllMarkets();

          console.log('Loaded real markets:', realMarkets);

          // Combine mock markets + real markets
          setAllMarkets([...mockMarkets, ...realMarkets]);
        } catch (contractError) {
          console.warn('Could not load real markets from contract:', contractError);
          // Fall back to just mock markets if contract fails
          setAllMarkets(mockMarkets);
          setRealMarketsError('Could not load real markets from contract');
        }
      } catch (error) {
        console.error('Error loading markets:', error);
        // Fallback to mock markets only
        setAllMarkets(getMockMarkets());
        setRealMarketsError('Failed to load markets');
      } finally {
        setIsLoadingRealMarkets(false);
      }
    };

    loadRealMarkets();
  }, []);

  // Filter and sort markets
  const filteredMarkets = allMarkets.filter(market => {
    const matchesSearch = market.question.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || market.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Sort markets
  const sortedMarkets = [...filteredMarkets].sort((a, b) => {
    switch (sortBy) {
      case 'volume':
        return b.totalVolume - a.totalVolume;
      case 'liquidity':
        return b.liquidity - a.liquidity;
      case 'ending-soon':
        return a.expiresAt.getTime() - b.expiresAt.getTime();
      case 'newest':
        return b.createdAt.getTime() - a.createdAt.getTime();
      default:
        return 0;
    }
  });


  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-black text-white pt-24 pb-16 px-6">
        {/* Enhanced Background Effects */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <motion.div 
            className="absolute top-20 left-1/4 w-96 h-96 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-full blur-3xl"
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
            className="absolute bottom-20 right-1/4 w-96 h-96 bg-gradient-to-r from-pink-500/10 to-purple-500/10 rounded-full blur-3xl"
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
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-emerald-500/5 to-teal-500/5 rounded-full blur-3xl"
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
          {/* Header */}
          <motion.div 
            className="mb-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <motion.h1 
              className="text-5xl md:text-6xl font-bold mb-4 font-[family-name:var(--font-geist-mono)] relative"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, delay: 0.2 }}
            >
              <motion.span 
                className="bg-gradient-to-r from-cyan-400 via-blue-400 via-purple-400 to-pink-400 text-transparent bg-clip-text relative"
                animate={{
                  backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
                }}
                transition={{
                  duration: 5,
                  repeat: Infinity,
                  ease: "linear"
                }}
                style={{
                  backgroundSize: '200% 200%'
                }}
              >
                Prediction Markets
                <motion.div
                  className="absolute top-2 -right-12"
                  animate={{
                    rotate: [0, 360],
                    scale: [1, 1.2, 1],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                  }}
                >
                  <Sparkles className="w-5 h-5 text-cyan-400" />
                </motion.div>
              </motion.span>
            </motion.h1>
            <motion.p 
              className="text-xl text-gray-400 flex items-center gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              <Zap className="w-5 h-5 text-cyan-400" />
              Trade on the outcome of real-world events with optimal liquidity
            </motion.p>
          </motion.div>

          {/* Enhanced Stats Bar */}
          <motion.div 
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
          >
            <StatCard
              icon={<TrendingUp className="w-5 h-5" />}
              label="24h Volume"
              value="$2.4M"
              change={"+12.5%"}
            />
            <StatCard
              icon={<DollarSign className="w-5 h-5" />}
              label="Total Liquidity"
              value="$8.7M"
              change={"+5.2%"}
            />
            <StatCard
              icon={<Activity className="w-5 h-5" />}
              label="Active Markets"
              value="127"
              change={"+8"}
            />
            <StatCard
              icon={<Zap className="w-5 h-5" />}
              label="Total Traders"
              value="12.3K"
              change={"+18.7%"}
            />
          </motion.div>

          {/* Enhanced Search and Filters */}
          <motion.div 
            className="flex flex-col md:flex-row gap-4 mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
          >
            {/* Search Bar with Neon Effect */}
            <div className="flex-1 relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-cyan-400 group-focus-within:text-cyan-300 transition-colors" />
              <input
                type="text"
                placeholder="Search markets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 focus:shadow-lg focus:shadow-cyan-500/20 transition-all duration-300"
              />
            </div>

            {/* Custom Sort Dropdown */}
            <div className="relative">
              <motion.button
                onClick={() => setShowSortDropdown(!showSortDropdown)}
                className="px-6 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white hover:bg-white/10 hover:border-cyan-400/30 focus:outline-none focus:border-cyan-500/50 focus:shadow-lg focus:shadow-cyan-500/20 transition-all duration-300 flex items-center space-x-3 min-w-[200px]"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <span className="text-lg">{selectedSortOption.icon}</span>
                <div className="flex-1 text-left">
                  <div className="text-sm font-medium">{selectedSortOption.label}</div>
                </div>
                <motion.div
                  animate={{ rotate: showSortDropdown ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </motion.div>
              </motion.button>

              {/* Dropdown Menu */}
              {showSortDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="absolute top-full mt-2 left-0 right-0 bg-black/90 backdrop-blur-xl border border-white/10 rounded-2xl p-2 z-50 shadow-2xl shadow-cyan-500/10"
                >
                  {sortOptions.map((option) => (
                    <motion.button
                      key={option.id}
                      onClick={() => {
                        setSortBy(option.id as MarketSortBy);
                        setShowSortDropdown(false);
                      }}
                      className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                        sortBy === option.id
                          ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 text-white'
                          : 'hover:bg-white/5 text-gray-300 hover:text-white'
                      }`}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <span className="text-lg">{option.icon}</span>
                      <div className="flex-1 text-left">
                        <div className="text-sm font-medium">{option.label}</div>
                        <div className="text-xs text-gray-500">{option.description}</div>
                      </div>
                      {sortBy === option.id && (
                        <div className="w-2 h-2 bg-cyan-400 rounded-full"></div>
                      )}
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </div>

            {/* Enhanced Filter Button */}
            <motion.button 
              className="px-6 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white hover:bg-white/10 hover:border-pink-500/50 hover:shadow-lg hover:shadow-pink-500/20 transition-all duration-300 flex items-center space-x-2 group"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Filter className="w-5 h-5 group-hover:text-pink-400 transition-colors" />
              <span>Filters</span>
            </motion.button>
          </motion.div>

          {/* Category Tabs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.0 }}
          >
            <MarketFilters
              selectedCategory={selectedCategory}
              onCategoryChange={setSelectedCategory}
            />
          </motion.div>

          {/* Loading State */}
          {isLoadingRealMarkets && (
            <motion.div 
              className="flex items-center justify-center py-12"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mr-3" />
              <span className="text-gray-400">Loading real markets from contract...</span>
            </motion.div>
          )}

          {/* Error Message */}
          {realMarketsError && (
            <motion.div 
              className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex items-center space-x-3">
                <Loader2 className="w-5 h-5 text-yellow-400" />
                <div>
                  <div className="font-semibold text-yellow-400 mb-1">Contract Connection Issue</div>
                  <div className="text-sm text-yellow-300">
                    {realMarketsError}. Showing demo markets only.
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Markets Grid with Staggered Animation */}
          <motion.div 
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 1.2 }}
          >
            {sortedMarkets.map((market: Market, index: number) => (
              <motion.div
                key={market.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 1.4 + index * 0.1 }}
              >
                <MarketCard market={market} />
              </motion.div>
            ))}
          </motion.div>

          {/* Enhanced Load More Button */}
          <motion.div 
            className="mt-12 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 1.8 }}
          >
            <motion.button 
              className="relative px-8 py-4 bg-gradient-to-r from-cyan-500 via-blue-500 via-purple-500 to-pink-500 rounded-xl font-semibold text-white transition-all duration-300 hover:scale-105 group overflow-hidden"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-600 via-blue-600 via-purple-600 to-pink-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/50 to-pink-500/50 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <span className="relative z-10 flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                Load More Markets
              </span>
            </motion.button>
          </motion.div>
        </div>
      </main>
    </>
  );
}

// Enhanced Stat Card Component with Clean Hover Effects
function StatCard({ icon, label, value, change }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  change: string;
}) {
  const isPositive = change.startsWith('+');
  
  return (
    <motion.div 
      className="relative group"
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/8 to-blue-500/8 rounded-2xl blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
      <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 transition-all duration-300 group-hover:border-cyan-400/40 group-hover:bg-white/8 group-hover:shadow-xl group-hover:shadow-cyan-500/5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-gray-400 group-hover:text-cyan-400 transition-colors duration-300">{icon}</div>
          <span className={`text-sm font-medium ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            {change}
          </span>
        </div>
        <div className="text-2xl font-bold text-white mb-1 group-hover:text-cyan-100 transition-colors duration-300">
          {value}
        </div>
        <div className="text-sm text-gray-500 group-hover:text-gray-400 transition-colors duration-300">{label}</div>
      </div>
    </motion.div>
  );
}