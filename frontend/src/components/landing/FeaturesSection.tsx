// components/landing/FeaturesSection.tsx
'use client';
import { Shield, Zap, TrendingUp, BarChart3, Clock, Users, ArrowRight, Sparkles, Star, Rocket } from 'lucide-react';
import { motion } from 'framer-motion';

export default function FeaturesSection() {
  const features = [
    {
      icon: <Shield className="w-6 h-6" />,
      title: 'Uniform LVR',
      description: 'Consistent losses for LPs regardless of price, making risk predictable and manageable',
      gradient: 'from-red-500 to-rose-500'
    },
    {
      icon: <TrendingUp className="w-6 h-6" />,
      title: 'Better Liquidity',
      description: 'Concentrated around 50% probability where most trading happens, reducing slippage',
      gradient: 'from-emerald-500 to-teal-500'
    },
    {
      icon: <Clock className="w-6 h-6" />,
      title: 'Time-Aware',
      description: 'Dynamic variant adjusts liquidity over time to maintain constant expected LVR',
      gradient: 'from-cyan-500 to-blue-500'
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: 'Gas Optimized',
      description: 'Efficient approximations for normal distribution functions minimize computation costs',
      gradient: 'from-violet-500 to-purple-500'
    },
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: 'Full Analytics',
      description: 'Track LVR, pool value, trading volume, and compare performance vs alternatives',
      gradient: 'from-amber-500 to-yellow-500'
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: 'LP-First Design',
      description: 'Mathematical optimization ensures liquidity providers get fair, predictable returns',
      gradient: 'from-indigo-500 to-purple-500'
    }
  ];

  return (
    <section className="relative py-32 px-6">
      {/* Enhanced Background */}
      <div className="absolute inset-0 bg-black"></div>
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/30 via-black to-black"></div>
      
      {/* Animated Background Elements */}
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

      {/* Floating Icons */}
      <motion.div
        className="absolute top-32 left-20 text-cyan-400/30"
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
        className="absolute top-60 right-32 text-purple-400/30"
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
        <Rocket className="w-5 h-5" />
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
              className="bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 text-transparent bg-clip-text relative"
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
              Built for Performance
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
            Every feature designed with mathematical precision and real-world usability
          </motion.p>
        </motion.div>

        {/* Enhanced Features Grid */}
        <motion.div 
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          viewport={{ once: true }}
        >
          {features.map((feature, idx) => (
            <motion.div
              key={idx}
              className="group relative"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.8 + idx * 0.1 }}
              viewport={{ once: true }}
              whileHover={{ y: -10 }}
            >
              <motion.div 
                className={`absolute inset-0 bg-gradient-to-r ${feature.gradient} rounded-3xl blur-xl opacity-0 group-hover:opacity-20 transition-opacity duration-500`}
                whileHover={{ scale: 1.05 }}
              />
              <motion.div 
                className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8 h-full transition-all duration-300 group-hover:border-white/20 group-hover:bg-white/10"
                whileHover={{ 
                  scale: 1.02,
                  boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)"
                }}
              >
                <motion.div 
                  className={`inline-flex p-3 rounded-2xl bg-gradient-to-r ${feature.gradient} mb-6`}
                  whileHover={{ 
                    rotate: [0, -10, 10, 0],
                    scale: 1.1 
                  }}
                  transition={{ duration: 0.3 }}
                >
                  {feature.icon}
                </motion.div>
                <motion.h3 
                  className="text-2xl font-bold mb-4 text-white font-[family-name:var(--font-geist-mono)]"
                  whileHover={{ x: 5 }}
                  transition={{ duration: 0.2 }}
                >
                  {feature.title}
                </motion.h3>
                <motion.p 
                  className="text-gray-400 leading-relaxed"
                  whileHover={{ color: "#d1d5db" }}
                  transition={{ duration: 0.2 }}
                >
                  {feature.description}
                </motion.p>
              </motion.div>
            </motion.div>
          ))}
        </motion.div>

        {/* Enhanced CTA Section */}
        <motion.div 
          className="mt-20 text-center"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.4 }}
          viewport={{ once: true }}
        >
          <div className="relative inline-block">
            <motion.div 
              className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-3xl blur-2xl"
              animate={{
                scale: [1, 1.05, 1],
                opacity: [0.5, 0.8, 0.5],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
            <motion.div 
              className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-12"
              whileHover={{ 
                scale: 1.02,
                borderColor: "rgba(255, 255, 255, 0.2)"
              }}
              transition={{ duration: 0.3 }}
            >
              <motion.h3 
                className="text-3xl font-bold mb-4 text-white font-[family-name:var(--font-geist-mono)] relative"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 1.6 }}
                viewport={{ once: true }}
              >
                Ready to experience the future of prediction markets?
                <motion.div
                  className="absolute -top-2 -right-8"
                  animate={{
                    rotate: [0, 15, -15, 0],
                    scale: [1, 1.2, 1],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                >
                  <Sparkles className="w-6 h-6 text-cyan-400" />
                </motion.div>
              </motion.h3>
              <motion.p 
                className="text-gray-400 mb-8 max-w-2xl mx-auto"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 1.8 }}
                viewport={{ once: true }}
              >
                Join liquidity providers and traders already benefiting from mathematically optimal market making
              </motion.p>
              <motion.div 
                className="flex flex-col sm:flex-row items-center justify-center gap-4"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 2.0 }}
                viewport={{ once: true }}
              >
                <motion.button 
                  className="group relative px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl font-semibold text-white transition-all duration-300 overflow-hidden"
                  whileHover={{ 
                    scale: 1.05, 
                    boxShadow: "0 25px 50px -12px rgba(6, 182, 212, 0.5)" 
                  }}
                  whileTap={{ scale: 0.95 }}
                >
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent"
                    initial={{ x: '-100%' }}
                    whileHover={{ x: '100%' }}
                    transition={{ duration: 0.6 }}
                  />
                  <span className="relative z-10 flex items-center space-x-2">
                    <Rocket className="w-5 h-5" />
                    <span>Launch App</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </span>
                </motion.button>
                <motion.button 
                  className="px-8 py-4 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl font-semibold text-white transition-all duration-300"
                  whileHover={{ 
                    scale: 1.02,
                    backgroundColor: "rgba(255, 255, 255, 0.1)",
                    borderColor: "rgba(255, 255, 255, 0.2)"
                  }}
                  whileTap={{ scale: 0.98 }}
                >
                  Read Documentation
                </motion.button>
              </motion.div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}