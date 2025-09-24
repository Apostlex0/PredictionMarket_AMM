// src/lib/format.ts
export function formatCurrency(value: number): string {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
    return `$${value.toFixed(2)}`;
  }
  
  export function formatProbability(probability: number): string {
    return `${(probability * 100).toFixed(0)}%`;
  }
  
  export function formatNumber(value: number): string {
    return new Intl.NumberFormat('en-US').format(value);
  }
  
  export function formatAddress(address: string): string {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }