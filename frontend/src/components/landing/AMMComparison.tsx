// components/landing/AMMComparison.tsx
'use client';
import { useState } from 'react';
import { Activity, TrendingUp, Waves } from 'lucide-react';

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
        'Concentrates liquidity at 50%',
        'Less liquidity at extremes',
        'Uniform loss rate',
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
        'Equal liquidity distribution',
        'Poor at extreme probabilities',
        'High LVR at edges',
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
        'Concentrated at edges',
        'Opposite of what we need',
        'Inefficient for prediction markets',
        'Legacy design'
      ]
    }
  ];

  return (
    <section className="relative py-32 px-6 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-black"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-cyan-500/5 rounded-full blur-3xl"></div>

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-5xl md:text-6xl font-bold mb-6 font-[family-name:var(--font-geist-mono)]">
            <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 text-transparent bg-clip-text">
              Liquidity Distribution
            </span>
            <br />
            <span className="bg-gradient-to-r from-white to-gray-400 text-transparent bg-clip-text">
              Comparison
            </span>
          </h2>
          <p className="text-xl text-gray-400">
            See how pm-AMM optimally allocates liquidity compared to alternatives
          </p>
        </div>

        {/* AMM Selector */}
        <div className="flex flex-wrap justify-center gap-4 mb-16">
          {amms.map((amm) => (
            <button
              key={amm.id}
              onClick={() => setSelectedAMM(amm.id)}
              className={`relative group px-6 py-4 rounded-2xl transition-all duration-300 ${selectedAMM === amm.id
                  ? 'bg-white/10 backdrop-blur-sm border border-white/20'
                  : 'bg-white/5 backdrop-blur-sm border border-white/5 hover:border-white/10'
                }`}
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
            </button>
          ))}
        </div>

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
          <div className="space-y-6">
            {amms.find(a => a.id === selectedAMM)?.features.map((feature, idx) => (
              <div
                key={idx}
                className="flex items-start space-x-4 opacity-0 animate-fadeIn"
                style={{ animationDelay: `${idx * 100}ms`, animationFillMode: 'forwards' }}
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-r from-cyan-500/20 to-blue-500/20 flex items-center justify-center border border-white/10">
                  <div className="w-2 h-2 rounded-full bg-gradient-to-r from-cyan-400 to-blue-400"></div>
                </div>
                <div>
                  <p className="text-lg text-gray-300">{feature}</p>
                </div>
              </div>
            ))}

            <div className="pt-6 border-t border-white/10">
              <p className="text-sm text-gray-500 leading-relaxed">
                {selectedAMM === 'pm-amm' &&
                  "The pm-AMM curve is derived from the normal distribution CDF (Φ) and PDF (φ), creating optimal liquidity distribution for prediction markets based on Gaussian score dynamics."
                }
                {selectedAMM === 'cpmm' &&
                  "The constant product formula (x·y=k) distributes liquidity equally at all price levels, which is suboptimal for bounded outcome tokens that behave differently than typical assets."
                }
                {selectedAMM === 'lmsr' &&
                  "LMSR was designed for prediction markets but concentrates liquidity at wrong locations - it provides more depth at extremes when we actually need it at 50%."
                }
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// Simplified curve visualization component
function CurveVisualization({ ammType }: { ammType: 'pm-amm' | 'cpmm' | 'lmsr' }) {
  return (
    <div className="w-full h-full relative">
      <svg viewBox="0 0 400 300" className="w-full h-full">
        {/* Axes */}
        <line x1="50" y1="250" x2="350" y2="250" stroke="#374151" strokeWidth="2" />
        <line x1="50" y1="50" x2="50" y2="250" stroke="#374151" strokeWidth="2" />

        {/* Labels */}
        <text x="200" y="280" fill="#9CA3AF" fontSize="12" textAnchor="middle">
          Price (Probability)
        </text>
        <text x="20" y="150" fill="#9CA3AF" fontSize="12" transform="rotate(-90, 20, 150)">
          Liquidity
        </text>

        {/* Draw curves based on AMM type */}
        {ammType === 'pm-amm' && (
          <path
            d="M 50 220 Q 200 100, 350 220"
            fill="none"
            stroke="url(#pm-gradient)"
            strokeWidth="4"
            className="animate-draw"
          />
        )}
        {ammType === 'cpmm' && (
          <path
            d="M 50 150 L 350 150"
            fill="none"
            stroke="url(#cpmm-gradient)"
            strokeWidth="4"
            className="animate-draw"
          />
        )}
        {ammType === 'lmsr' && (
          <path
            d="M 50 120 Q 200 200, 350 120"
            fill="none"
            stroke="url(#lmsr-gradient)"
            strokeWidth="4"
            className="animate-draw"
          />
        )}

        {/* Gradients */}
        <defs>
          <linearGradient id="pm-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="50%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
          <linearGradient id="cpmm-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
          <linearGradient id="lmsr-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}