// components/landing/HeroSection.tsx
'use client';
import dynamic from 'next/dynamic';
import { ArrowRight, Sparkles } from 'lucide-react';
import Link from 'next/link';

const Spline = dynamic(() => import('@splinetool/react-spline').then(mod => ({ default: mod.default })), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center">
      <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
    </div>
  ),
});

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background gradient effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-black via-purple-950/20 to-black"></div>
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>

      {/* Spline 3D Scene */}
      <div className="absolute inset-0 z-0">
        <Spline scene="https://prod.spline.design/VCESs0bnTw5nEpLh/scene.splinecode" />
      </div>

      {/* Content Overlay - positioned at bottom */}
      <div className="absolute bottom-32 left-0 right-0 z-10 text-center px-6">

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/markets">
            <button className="group relative px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-cyan-500/50">
              <span className="relative z-10 flex items-center space-x-2">
                <span>Start Trading</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>
            </button>
          </Link>

          <Link href="#learn-more">
            <button className="px-8 py-4 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl font-semibold text-white transition-all duration-300 hover:bg-white/10 hover:border-white/20">
              Learn How It Works
            </button>
          </Link>
        </div>

        {/* Stats Bar */}
        <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
          {[
            { label: 'Total Volume', value: '$2.4M' },
            { label: 'Active Markets', value: '127' },
            { label: 'Liquidity Providers', value: '1,834' },
            { label: 'Avg. LVR Reduction', value: '47%' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-3xl font-bold bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-400 text-transparent bg-clip-text mb-2">
                {stat.value}
              </div>
              <div className="text-sm text-gray-500">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
        <div className="w-6 h-10 border-2 border-white/20 rounded-full flex justify-center p-2">
          <div className="w-1 h-3 bg-gradient-to-b from-purple-500 to-cyan-500 rounded-full animate-bounce"></div>
        </div>
      </div>
    </section>
  );
}