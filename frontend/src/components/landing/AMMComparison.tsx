// components/landing/AMMComparison.tsx
'use client';
import { useState } from 'react';
import { Activity, TrendingUp, Waves, Sparkles, Zap, Star } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AMMComparison() {
  const [selectedAMM, setSelectedAMM] = useState<'pm-amm' | 'cpmm' | 'lmsr'>('pm-amm');

  const amms = [
    {
      id: 'pm-amm' as const,
      name: 'pm-AMM',
      icon: <Waves className="w-5 h-5" />,
      description: 'Uniform LVR across all prices',
      color: 'from-cyan-500 via-blue-500 to-indigo-500',
      features: [
        'Uniform LVR across all prices',
        'Optimal loss distribution',
        'Consistent loss rate',
        'Time-aware (dynamic variant)'
      ]
    },
    {
      id: 'cpmm' as const,
      name: 'Constant Product (Uniswap)',
      icon: <TrendingUp className="w-5 h-5" />,
      description: 'x × y = k (traditional AMM)',
      color: 'from-red-500 to-rose-500',
      features: [
        'Non-uniform LVR distribution',
        'Poor at extreme probabilities',
        'Excessive LVR at edges',
        'No time awareness'
      ]
    },
    {
      id: 'lmsr' as const,
      name: 'LMSR (Hanson)',
      icon: <Activity className="w-5 h-5" />,
      description: 'Logarithmic market scoring rule',
      color: 'from-violet-500 to-purple-500',
      features: [
        'High LVR at wrong locations',
        'Opposite of optimal LVR pattern',
        'Inefficient loss distribution',
        'Legacy design'
      ]
    }
  ];

  return (
    <section className="relative py-32 px-6">
      {/* Enhanced Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-black via-slate-950/30 to-black"></div>
      
      {/* Animated Background Elements */}
      <motion.div 
        className="absolute top-20 left-1/4 w-96 h-96 bg-gradient-to-r from-cyan-500/8 to-blue-500/8 rounded-full blur-3xl"
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
        className="absolute bottom-40 right-1/3 w-96 h-96 bg-gradient-to-r from-purple-500/8 to-pink-500/8 rounded-full blur-3xl"
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

      {/* Floating Elements */}
      <motion.div
        className="absolute top-32 right-20 text-cyan-400/30"
        animate={{
          y: [0, -15, 0],
          rotate: [0, 180, 360],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      >
        <Star className="w-6 h-6" />
      </motion.div>
      <motion.div
        className="absolute bottom-60 left-16 text-purple-400/30"
        animate={{
          y: [0, 20, 0],
          x: [0, -10, 0],
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2
        }}
      >
        <Zap className="w-5 h-5" />
      </motion.div>

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Enhanced Header */}
        <motion.div 
          className="text-center mb-20"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <motion.h2 
            className="text-5xl md:text-6xl font-bold mb-6 font-[family-name:var(--font-geist-mono)] relative"
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.2 }}
            viewport={{ once: true }}
          >
            <motion.span 
              className="bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 text-transparent bg-clip-text relative"
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
              Why Morpheus?
              <motion.div
                className="absolute top-2 -right-12"
                animate={{
                  rotate: [0, 360],
                  scale: [1, 1.3, 1],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                }}
              >
                <Sparkles className="w-6 h-6 text-cyan-400" />
              </motion.div>
            </motion.span>
          </motion.h2>
          <motion.p 
            className="text-xl text-gray-400 max-w-3xl mx-auto"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            viewport={{ once: true }}
          >
            Compare our approach with traditional AMMs and see the mathematical advantage
          </motion.p>
        </motion.div>

        {/* Enhanced AMM Selector */}
        <motion.div 
          className="flex flex-wrap justify-center gap-4 mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          viewport={{ once: true }}
        >
          {amms.map((amm, index) => (
            <motion.button
              key={amm.id}
              onClick={() => setSelectedAMM(amm.id)}
              className={`relative group px-6 py-4 rounded-2xl transition-all duration-300 ${selectedAMM === amm.id
                  ? 'bg-white/10 backdrop-blur-sm border border-white/20'
                  : 'bg-white/5 backdrop-blur-sm border border-white/5 hover:border-white/10'
                }`}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.8 + index * 0.1 }}
              viewport={{ once: true }}
            >
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg bg-gradient-to-r ${amm.color}`}>
                  {amm.icon}
                </div>
                <div className="text-left">
                  <div className="font-semibold text-white font-[family-name:var(--font-geist-mono)]">
                    {amm.name}
                  </div>
                  <div className="text-sm text-gray-500">
                    {amm.description}
                  </div>
                </div>
              </div>
              {selectedAMM === amm.id && (
                <div className={`absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r ${amm.color} rounded-full`}></div>
              )}
            </motion.button>
          ))}
        </motion.div>

        {/* Visualization Area */}
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Curve Visualization */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-indigo-500/10 rounded-3xl blur-2xl"></div>
            <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8 h-[400px] flex items-center justify-center">
              <CurveVisualization ammType={selectedAMM} />
            </div>
          </div>

          {/* Details */}
          <motion.div 
            className="space-y-6"
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
          >
            {amms.find(a => a.id === selectedAMM)?.features.map((feature, idx) => (
              <motion.div
                key={idx}
                className="flex items-start space-x-4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: idx * 0.1 }}
              >
                <motion.div 
                  className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-r from-cyan-500/20 to-blue-500/20 flex items-center justify-center border border-white/10"
                  whileHover={{ scale: 1.1, rotate: 180 }}
                  transition={{ duration: 0.3 }}
                >
                  <motion.div 
                    className="w-2 h-2 rounded-full bg-gradient-to-r from-cyan-400 to-blue-400"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                </motion.div>
                <div>
                  <p className="text-lg text-gray-300">{feature}</p>
                </div>
              </motion.div>
            ))}

            <div className="pt-6 border-t border-white/10">
              <p className="text-sm text-gray-500 leading-relaxed">
                {selectedAMM === 'pm-amm' &&
                  "The pm-AMM achieves uniform Loss-vs-Rebalancing (LVR) across all prices, meaning the rate of loss to arbitrageurs is proportional to pool value regardless of current probability. This creates optimal risk distribution for prediction markets."
                }
                {selectedAMM === 'cpmm' &&
                  "The constant product formula (x·y=k) results in non-uniform LVR, with excessive losses at extreme probabilities. This makes it suboptimal for bounded outcome tokens that behave differently than typical assets."
                }
                {selectedAMM === 'lmsr' &&
                  "LMSR was designed for prediction markets but has high LVR at the wrong locations - it suffers more losses at extremes when the optimal pattern would be uniform LVR across all prices."
                }
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// Graph visualization component using actual images
function CurveVisualization({ ammType }: { ammType: 'pm-amm' | 'cpmm' | 'lmsr' }) {
  const getImagePath = () => {
    switch (ammType) {
      case 'pm-amm':
        return '/LVR_PM_AMM.jpeg';
      case 'cpmm':
        return '/LVR_CPMM.jpg';
      case 'lmsr':
        return '/LVR_LMSR.jpeg';
      default:
        return '/LVR_PM_AMM.jpeg';
    }
  };

  return (
    <div className="w-full h-full relative overflow-hidden rounded-2xl">
      <motion.img
        key={ammType}
        src={getImagePath()}
        alt={`${ammType.toUpperCase()} LVR vs Price Graph`}
        className="w-full h-full object-contain"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      />
    </div>
  );
}