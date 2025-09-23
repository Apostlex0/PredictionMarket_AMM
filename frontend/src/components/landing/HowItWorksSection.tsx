// components/landing/HowItWorksSection.tsx
'use client';
import { useState } from 'react';
import { CheckCircle2, ArrowRight } from 'lucide-react';

export default function HowItWorksSection() {
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    {
      title: 'Model the Prediction Market',
      subtitle: 'Gaussian Score Dynamics',
      description: 'We model the prediction market as a bet on whether an underlying Brownian motion (random walk) ends above zero at expiration time T.',
      formula: 'dZ_t = σ dB_t',
      explanation: 'The score process Z follows a random walk with volatility σ. Think: basketball score differential, vote margin, or price movements.',
      visual: 'brownian'
    },
    {
      title: 'Convert Score to Price',
      subtitle: 'Normal Distribution CDF',
      description: 'The token price equals the probability that the final score is positive, calculated using the normal distribution.',
      formula: 'P_t = Φ(Z_t / σ√(T-t))',
      explanation: 'Φ is the standard normal CDF. This creates time-dependent volatility: price changes faster near expiration and near 50% probability.',
      visual: 'cdf'
    },
    {
      title: 'Derive Optimal Reserves',
      subtitle: 'Uniform LVR Condition',
      description: 'We solve for AMM reserves that make loss-vs-rebalancing (LVR) uniform across all prices - proportional to pool value.',
      formula: "V''(P) = -2β V(P) / φ(Φ⁻¹(P))²",
      explanation: 'This differential equation ensures the AMM loses money at a consistent rate regardless of current probability.',
      visual: 'equation'
    },
    {
      title: 'The pm-AMM Invariant',
      subtitle: 'Implementation Formula',
      description: 'The solution gives us the core invariant that defines how reserves (x,y) must relate for optimal trading.',
      formula: '(y-x)Φ((y-x)/L) + Lφ((y-x)/L) - y = 0',
      explanation: 'This elegant formula uses the normal PDF (φ) and CDF (Φ) to create the perfect liquidity distribution for prediction markets.',
      visual: 'invariant'
    },
    {
      title: 'Dynamic Adjustment',
      subtitle: 'Time-Aware Liquidity',
      description: 'For even better performance, we adjust liquidity over time to keep expected LVR constant throughout the market lifetime.',
      formula: 'L_t = L_0 √(T-t)',
      explanation: 'Liquidity decreases as √(T-t), preventing LVR from exploding near expiration while maintaining uniform losses.',
      visual: 'dynamic'
    }
  ];

  return (
    <section className="relative py-32 px-6">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-black via-slate-950/20 to-black"></div>

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-20">
          <h2 className="text-5xl md:text-6xl font-bold mb-6 font-[family-name:var(--font-geist-mono)]">
            <span className="bg-gradient-to-r from-white to-gray-400 text-transparent bg-clip-text">
              How
            </span>
            {' '}
            <span className="bg-gradient-to-r from-cyan-400 to-blue-400 text-transparent bg-clip-text">
              It Works
            </span>
          </h2>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            From mathematical theory to working implementation in 5 steps
          </p>
        </div>

        {/* Steps Navigation */}
        <div className="flex flex-wrap justify-center gap-3 mb-16">
          {steps.map((step, idx) => (
            <button
              key={idx}
              onClick={() => setActiveStep(idx)}
              className={`relative group px-6 py-3 rounded-xl transition-all duration-300 ${activeStep === idx
                  ? 'bg-white/10 backdrop-blur-sm border border-white/20'
                  : 'bg-white/5 backdrop-blur-sm border border-white/5 hover:border-white/10'
                }`}
            >
              <div className="flex items-center space-x-3">
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold font-[family-name:var(--font-geist-mono)] ${activeStep === idx
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white'
                    : activeStep > idx
                      ? 'bg-cyan-500/20 text-cyan-400'
                      : 'bg-white/5 text-gray-500'
                  }`}>
                  {activeStep > idx ? <CheckCircle2 className="w-5 h-5" /> : idx + 1}
                </div>
                <span className="hidden sm:block text-sm font-medium text-gray-300">
                  {step.title}
                </span>
              </div>
              {activeStep === idx && (
                <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full"></div>
              )}
            </button>
          ))}
        </div>

        {/* Active Step Content */}
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Explanation */}
          <div className="space-y-6">
            <div className="inline-block px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30">
              <span className="text-sm font-medium text-cyan-300 font-[family-name:var(--font-geist-mono)]">
                Step {activeStep + 1} of {steps.length}
              </span>
            </div>

            <h3 className="text-4xl font-bold text-white font-[family-name:var(--font-geist-mono)]">
              {steps[activeStep].title}
            </h3>

            <p className="text-lg text-blue-300 font-medium">
              {steps[activeStep].subtitle}
            </p>

            <p className="text-lg text-gray-400 leading-relaxed">
              {steps[activeStep].description}
            </p>

            {/* Formula Display */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-2xl blur-xl"></div>
              <div className="relative bg-black/50 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
                <div className="text-sm text-gray-500 mb-2 font-[family-name:var(--font-geist-mono)]">
                  Mathematical Formula:
                </div>
                <div className="text-2xl text-center text-white font-mono py-4 overflow-x-auto">
                  {steps[activeStep].formula}
                </div>
              </div>
            </div>

            <p className="text-gray-400 leading-relaxed">
              {steps[activeStep].explanation}
            </p>

            {/* Navigation Buttons */}
            <div className="flex items-center space-x-4 pt-4">
              {activeStep > 0 && (
                <button
                  onClick={() => setActiveStep(activeStep - 1)}
                  className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl transition-all duration-300 text-gray-300 hover:text-white"
                >
                  Previous
                </button>
              )}
              {activeStep < steps.length - 1 && (
                <button
                  onClick={() => setActiveStep(activeStep + 1)}
                  className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 rounded-xl transition-all duration-300 text-white font-medium flex items-center space-x-2"
                >
                  <span>Next Step</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Right: Visualization */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-3xl blur-2xl"></div>
            <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8 h-[500px]">
              <StepVisualization type={steps[activeStep].visual as 'brownian' | 'cdf' | 'equation' | 'invariant' | 'dynamic'} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// Visualization component for each step
function StepVisualization({ type }: { type: 'brownian' | 'cdf' | 'equation' | 'invariant' | 'dynamic' }) {
  const visualizations = {
    brownian: (
      <div className="w-full h-full flex flex-col items-center justify-center space-y-4">
        <svg viewBox="0 0 400 300" className="w-full h-full">
          {/* Random walk path */}
          <path
            d="M 50 150 L 80 140 L 110 160 L 140 145 L 170 170 L 200 155 L 230 180 L 260 165 L 290 150 L 320 175 L 350 160"
            fill="none"
            stroke="url(#walk-gradient)"
            strokeWidth="3"
            className="animate-draw"
          />
          {/* Zero line */}
          <line x1="50" y1="150" x2="350" y2="150" stroke="#4b5563" strokeWidth="1" strokeDasharray="5,5" />
          {/* Labels */}
          <text x="200" y="280" fill="#9CA3AF" fontSize="14" textAnchor="middle">Time</text>
          <text x="30" y="155" fill="#9CA3AF" fontSize="14">Z=0</text>

          <defs>
            <linearGradient id="walk-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
          </defs>
        </svg>
        <p className="text-sm text-gray-400 text-center">Brownian motion (random walk) representing the score differential</p>
      </div>
    ),
    cdf: (
      <div className="w-full h-full flex flex-col items-center justify-center space-y-4">
        <svg viewBox="0 0 400 300" className="w-full h-full">
          {/* S-curve for CDF */}
          <path
            d="M 50 250 Q 100 240, 150 180 Q 200 100, 250 60 Q 300 30, 350 20"
            fill="none"
            stroke="url(#cdf-gradient)"
            strokeWidth="4"
            className="animate-draw"
          />
          {/* Axes */}
          <line x1="50" y1="270" x2="350" y2="270" stroke="#374151" strokeWidth="2" />
          <line x1="50" y1="30" x2="50" y2="270" stroke="#374151" strokeWidth="2" />
          {/* Labels */}
          <text x="200" y="295" fill="#9CA3AF" fontSize="14" textAnchor="middle">Score (Z)</text>
          <text x="25" y="150" fill="#9CA3AF" fontSize="14">P</text>

          <defs>
            <linearGradient id="cdf-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
        </svg>
        <p className="text-sm text-gray-400 text-center">Normal CDF converts score to probability (0 to 1)</p>
      </div>
    ),
    equation: (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center space-y-6">
          <div className="text-3xl font-mono text-white">
            LVR<sub className="text-xl">t</sub> = α · V<sub className="text-xl">t</sub>
          </div>
          <div className="h-px w-32 mx-auto bg-gradient-to-r from-cyan-500 to-blue-500"></div>
          <div className="text-lg text-gray-400">
            Uniform Loss-vs-Rebalancing
          </div>
          <div className="text-sm text-gray-500 max-w-xs mx-auto">
            Loss rate proportional to pool value at all prices and times
          </div>
        </div>
      </div>
    ),
    invariant: (
      <div className="w-full h-full flex flex-col items-center justify-center space-y-6">
        <div className="text-center space-y-4">
          <div className="text-2xl font-mono text-white break-words px-4">
            (y-x)Φ((y-x)/L) + Lφ((y-x)/L) - y = 0
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm text-gray-400">
            <div className="bg-white/5 rounded-lg p-3">
              <div className="text-cyan-400 font-semibold mb-1">Φ (Phi)</div>
              <div>Normal CDF</div>
            </div>
            <div className="bg-white/5 rounded-lg p-3">
              <div className="text-blue-400 font-semibold mb-1">φ (phi)</div>
              <div>Normal PDF</div>
            </div>
            <div className="bg-white/5 rounded-lg p-3">
              <div className="text-purple-400 font-semibold mb-1">x, y</div>
              <div>Token reserves</div>
            </div>
            <div className="bg-white/5 rounded-lg p-3">
              <div className="text-cyan-300 font-semibold mb-1">L</div>
              <div>Liquidity param</div>
            </div>
          </div>
        </div>
      </div>
    ),
    dynamic: (
      <div className="w-full h-full flex flex-col items-center justify-center space-y-4">
        <svg viewBox="0 0 400 300" className="w-full h-full">
          {/* Declining liquidity curve */}
          <path
            d="M 50 100 Q 150 120, 250 180 L 350 260"
            fill="none"
            stroke="url(#time-gradient)"
            strokeWidth="4"
            className="animate-draw"
          />
          {/* Time axis */}
          <line x1="50" y1="280" x2="350" y2="280" stroke="#374151" strokeWidth="2" />
          {/* Labels */}
          <text x="200" y="295" fill="#9CA3AF" fontSize="14" textAnchor="middle">Time to Expiration</text>
          <text x="25" y="150" fill="#9CA3AF" fontSize="14">L</text>
          <text x="60" y="90" fill="#06b6d4" fontSize="12">L₀</text>
          <text x="340" y="270" fill="#8b5cf6" fontSize="12">0</text>

          <defs>
            <linearGradient id="time-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
        </svg>
        <p className="text-sm text-gray-400 text-center">Liquidity decreases as √(T-t) to maintain constant expected LVR</p>
      </div>
    )
  };

  return visualizations[type];
}