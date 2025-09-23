// src/components/markets/MarketFilters.tsx
'use client';
import { motion } from 'framer-motion';
import { Globe, Bitcoin, Cpu, Trophy, Building, Film, Microscope } from 'lucide-react';

const categories = [
  { id: 'all', label: 'All Markets', icon: Globe, gradient: 'from-gray-400 to-gray-600' },
  { id: 'crypto', label: 'Crypto', icon: Bitcoin, gradient: 'from-cyan-400 to-blue-500' },
  { id: 'technology', label: 'Technology', icon: Cpu, gradient: 'from-blue-400 to-purple-500' },
  { id: 'sports', label: 'Sports', icon: Trophy, gradient: 'from-emerald-400 to-teal-500' },
  { id: 'politics', label: 'Politics', icon: Building, gradient: 'from-pink-400 to-rose-500' },
  { id: 'entertainment', label: 'Entertainment', icon: Film, gradient: 'from-purple-400 to-violet-500' },
  { id: 'science', label: 'Science', icon: Microscope, gradient: 'from-teal-400 to-emerald-500' },
];

export default function MarketFilters({
  selectedCategory,
  onCategoryChange,
}: {
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
}) {
  return (
    <div className="flex overflow-x-auto pb-4 gap-3 scrollbar-hide">
      {categories.map((category, index) => {
        const IconComponent = category.icon;
        const isSelected = selectedCategory === category.id;
        
        return (
          <motion.button
            key={category.id}
            onClick={() => onCategoryChange(category.id)}
            className={`flex-shrink-0 px-6 py-3 rounded-xl font-medium transition-all duration-300 relative group ${
              isSelected
                ? `bg-gradient-to-r ${category.gradient} text-white shadow-lg`
                : 'bg-white/5 backdrop-blur-sm border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 hover:border-white/20'
            }`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
          >
            {/* Glow effect for selected category */}
            {isSelected && (
              <motion.div
                className={`absolute inset-0 bg-gradient-to-r ${category.gradient} rounded-xl blur-lg opacity-50`}
                animate={{
                  scale: [1, 1.1, 1],
                  opacity: [0.3, 0.6, 0.3],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
            )}
            
            {/* Content */}
            <div className="relative flex items-center space-x-2">
              <motion.div
                animate={isSelected ? {
                  rotate: [0, 10, -10, 0],
                } : {}}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                }}
              >
                <IconComponent className="w-4 h-4" />
              </motion.div>
              <span>{category.label}</span>
            </div>

            {/* Hover glow for non-selected items */}
            {!isSelected && (
              <motion.div
                className={`absolute inset-0 bg-gradient-to-r ${category.gradient} rounded-xl blur-lg opacity-0 group-hover:opacity-30 transition-opacity duration-300`}
              />
            )}
          </motion.button>
        );
      })}
    </div>
  );
}