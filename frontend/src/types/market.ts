// src/types/market.ts
export interface Market {
    id: string;
    question: string;
    description?: string;
    category: string;
    probability: number;
    volume: number;
    liquidity: number;
    expiresAt: Date;
    createdAt: Date;
    totalTraders: number;
    resolved: boolean;
    outcome?: boolean; // true = YES won, false = NO won
    creator: string;
    yesTokenAddress: string;
    noTokenAddress: string;
    poolAddress: string;
  }
  
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