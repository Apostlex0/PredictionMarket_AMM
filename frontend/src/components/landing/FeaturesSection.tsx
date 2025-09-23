// components/landing/FeaturesSection.tsx
'use client';
import { Shield, Zap, TrendingUp, BarChart3, Clock, Users } from 'lucide-react';

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
      {/* Background */}
      <div className="absolute inset-0 bg-black"></div>
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/30 via-black to-black"></div>

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-20">
          <h2 className="text-5xl md:text-6xl font-bold mb-6 font-[family-name:var(--font-geist-mono)]">
            <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 text-transparent bg-clip-text">
              Built for Performance
            </span>
          </h2>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            Every feature designed with mathematical precision and real-world usability
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, idx) => (
            <div
              key={idx}
              className="group relative"
            >
              <div className={`absolute inset-0 bg-gradient-to-r ${feature.gradient} rounded-3xl blur-xl opacity-0 group-hover:opacity-20 transition-opacity duration-500`}></div>
              <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8 h-full transition-all duration-300 group-hover:border-white/20 group-hover:bg-white/10">
                <div className={`inline-flex p-3 rounded-2xl bg-gradient-to-r ${feature.gradient} mb-6`}>
                  {feature.icon}
                </div>
                <h3 className="text-2xl font-bold mb-4 text-white font-[family-name:var(--font-geist-mono)]">
                  {feature.title}
                </h3>
                <p className="text-gray-400 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA Section */}
        <div className="mt-20 text-center">
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-3xl blur-2xl"></div>
            <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-12">
              <h3 className="text-3xl font-bold mb-4 text-white font-[family-name:var(--font-geist-mono)]">
                Ready to experience the future of prediction markets?
              </h3>
              <p className="text-gray-400 mb-8 max-w-2xl mx-auto">
                Join liquidity providers and traders already benefiting from mathematically optimal market making
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl font-semibold text-white transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-cyan-500/50">
                  Launch App
                </button>
                <button className="px-8 py-4 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl font-semibold text-white transition-all duration-300 hover:bg-white/10">
                  Read Documentation
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}