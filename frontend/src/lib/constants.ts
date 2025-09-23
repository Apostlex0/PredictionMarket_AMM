// src/lib/constants.ts
export const CATEGORIES = [
    { id: 'all', label: 'All Markets', icon: '🌐' },
    { id: 'crypto', label: 'Crypto', icon: '₿' },
    { id: 'technology', label: 'Technology', icon: '🤖' },
    { id: 'sports', label: 'Sports', icon: '⚽' },
    { id: 'politics', label: 'Politics', icon: '🏛️' },
    { id: 'entertainment', label: 'Entertainment', icon: '🎬' },
    { id: 'science', label: 'Science', icon: '🔬' },
  ] as const;
  
  export const CATEGORY_COLORS: Record<string, string> = {
    crypto: 'from-orange-500 to-amber-500',
    technology: 'from-blue-500 to-cyan-500',
    sports: 'from-green-500 to-emerald-500',
    politics: 'from-red-500 to-pink-500',
    entertainment: 'from-purple-500 to-violet-500',
    science: 'from-teal-500 to-emerald-500',
  };