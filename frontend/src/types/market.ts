// src/types/market.ts

// Main Market interface that matches contract data
export interface Market {
  id: string;
  question: string;
  description: string;
  category: string;
  createdAt: Date;
  expiresAt: Date;
  resolved: boolean;
  outcome?: boolean; // true = YES won, false = NO won
  creator: string;
  
  // PM-AMM specific fields
  probability: number; // Converted from FixedPoint128 for UI display
  totalVolume: number; // Converted from string for UI display
  liquidity: number; // Calculated from reserves for UI display
  totalTraders: number; // Derived/calculated field
  isDynamic: boolean;
  liquidityPeriodEndsAt?: Date; // For dynamic pools
  feeRate: number; // basis points
  initialProbability: number; // Converted from FixedPoint128
  
  // Token addresses
  yesTokenAddress: string;
  noTokenAddress: string;
  lpTokenAddress: string;
  poolAddress: string;
  marketAuthority: string; // resource account address
}

// Note: ContractMarket type removed - using clean Market type directly
// If needed for contract parsing, define inline where used

export type MarketCategory = 
  | 'all'
  | 'crypto'
  | 'technology'
  | 'sports'
  | 'politics'
  | 'entertainment'
  | 'science';

export type MarketSortBy = 
  | 'volume'
  | 'liquidity'
  | 'ending-soon'
  | 'newest';

// Market phase for dynamic pools
export type MarketPhase = 
  | 'liquidity_period' // Dynamic pools only - LPs can add liquidity
  | 'trading' // Trading is active
  | 'expired' // Market has expired, awaiting resolution
  | 'resolved'; // Market has been resolved

// Helper function to determine market phase
export function getMarketPhase(market: Market): MarketPhase {
  const now = new Date();
  
  if (market.resolved) {
    return 'resolved';
  }
  
  if (now >= market.expiresAt) {
    return 'expired';
  }
  
  if (market.isDynamic && market.liquidityPeriodEndsAt && now < market.liquidityPeriodEndsAt) {
    return 'liquidity_period';
  }
  
  return 'trading';
}

// Trading pair information
export interface TradingPair {
  fromToken: 'YES' | 'NO';
  toToken: 'YES' | 'NO';
  fromTokenAddress: string;
  toTokenAddress: string;
}

// Liquidity position information
export interface LiquidityPosition {
  lpTokens: number;
  shareOfPool: number;
  yesTokenValue: number;
  noTokenValue: number;
  totalValue: number;
}

// Dynamic pool analytics
export interface DynamicPoolAnalytics {
  totalWealth: number;
  pendingWithdrawal: number;
  cumulativeWithdrawn: number;
  currentLoss: number;
  lossProtectionActive: boolean;
}