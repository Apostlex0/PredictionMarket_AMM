// components/landing/ProblemSection.tsx
'use client';
import { AlertTriangle, TrendingDown, Zap } from 'lucide-react';

export default function ProblemSection() {
  return (
    <section id="learn-more" className="relative py-32 px-6">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-black via-slate-950/20 to-black"></div>

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-20">
          <h2 className="text-5xl md:text-6xl font-bold mb-6 font-[family-name:var(--font-geist-mono)]">
            <span className="bg-gradient-to-r from-white to-gray-400 text-transparent bg-clip-text">
              Why Prediction Markets Need
            </span>
            <br />
            <span className="bg-gradient-to-r from-cyan-400 to-blue-400 text-transparent bg-clip-text">
              A Custom AMM
            </span>
          </h2>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            Traditional AMMs like Uniswap&apos;s CPMM weren&apos;t built for outcome tokens. Here&apos;s why that&apos;s a problem.
          </p>
        </div>

        {/* Problem Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-20">
          <ProblemCard
            icon={<TrendingDown className="w-8 h-8" />}
            title="Inconsistent Liquidity"
            description="CPMM provides poor liquidity at extreme probabilities (near 0% or 100%), exactly when prediction markets need it most."
            stat="3-5x"
            statLabel="worse slippage"
          />
          <ProblemCard
            icon={<AlertTriangle className="w-8 h-8" />}
            title="Unfair LP Losses"
            description="Loss-vs-rebalancing (LVR) spikes dramatically as expiration approaches and at edge prices, punishing liquidity providers unpredictably."
            stat="10x"
            statLabel="LVR increase near expiry"
          />
          <ProblemCard
            icon={<Zap className="w-8 h-8" />}
            title="Time-Decay Volatility"
            description="Outcome token volatility depends on both price AND time remaining. Traditional AMMs ignore this critical factor."
            stat="∞"
            statLabel="volatility at edges"
          />
        </div>

        {/* Solution Preview */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-3xl blur-xl"></div>
          <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-12">
            <div className="text-center mb-8">
              <h3 className="text-3xl font-bold mb-4 font-[family-name:var(--font-geist-mono)] bg-gradient-to-r from-cyan-400 to-blue-400 text-transparent bg-clip-text">
                Enter: Uniform AMM for Gaussian Score Dynamics
              </h3>
              <p className="text-gray-400 text-lg">
                <span className="text-gray-400">•</span>
                pm-AMM uses mathematical optimization to ensure consistent LVR across all prices and times
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h4 className="text-xl font-semibold text-white">The Innovation</h4>
                <ul className="space-y-3 text-gray-400">
                  <li className="flex items-start space-x-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2"></div>
                    <span>Models prediction markets as bets on Brownian motion (random walks)</span>
                  </li>
                  <li className="flex items-start space-x-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-2"></div>
                    <span>Derives optimal reserves using the normal distribution (Φ, φ functions)</span>
                  </li>
                  <li className="flex items-start space-x-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-2"></div>
                    <span>Achieves uniform LVR: losses proportional to pool value at any price</span>
                  </li>
                </ul>
              </div>

              <div className="space-y-4">
                <h4 className="text-xl font-semibold text-white">The Result</h4>
                <ul className="space-y-3 text-gray-400">
                  <li className="flex items-start space-x-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2"></div>
                    <span>47% reduction in average LP losses vs CPMM</span>
                  </li>
                  <li className="flex items-start space-x-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-2"></div>
                    <span>Better liquidity at extreme probabilities (0.01 and 0.99)</span>
                  </li>
                  <li className="flex items-start space-x-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-2"></div>
                    <span>Predictable costs for liquidity providers</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProblemCard({ icon, title, description, stat, statLabel }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  stat: string;
  statLabel: string;
}) {
  return (
    <div className="relative group">
      <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
      <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 h-full transition-all duration-300 group-hover:border-white/20">
        <div className="text-red-400 mb-4">
          {icon}
        </div>
        <h3 className="text-2xl font-bold mb-4 text-white font-[family-name:var(--font-geist-mono)]">
          {title}
        </h3>
        <p className="text-gray-400 mb-6 leading-relaxed">
          {description}
        </p>
        <div className="pt-6 border-t border-white/10">
          <div className="text-4xl font-bold bg-gradient-to-r from-red-400 to-red-300 text-transparent bg-clip-text mb-1">
            {stat}
          </div>
          <div className="text-sm text-gray-500">
            {statLabel}
          </div>
        </div>
      </div>
    </div>
  );
}