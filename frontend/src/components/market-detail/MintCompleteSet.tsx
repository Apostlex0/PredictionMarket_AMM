// src/components/market-detail/MintCompleteSet.tsx
'use client';
import { useState } from 'react';
import { Coins, Info } from 'lucide-react';

interface Market {
  id: string;
  yesTokenAddress: string;
  noTokenAddress: string;
}

export default function MintCompleteSet({ market }: { market: Market }) {
  const [amount, setAmount] = useState('');

  return (
    <div className="relative">
      <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10 rounded-3xl blur-2xl"></div>
      <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8">
        <div className="flex items-center space-x-3 mb-6">
          <Coins className="w-6 h-6 text-cyan-400" />
          <h3 className="text-2xl font-bold font-[family-name:var(--font-geist-mono)]">
            Mint Complete Set
          </h3>
        </div>

        {/* Explanation */}
        <div className="mb-6 p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl">
          <p className="text-sm text-gray-300 leading-relaxed">
            Pay <span className="font-semibold text-white">$1</span> to receive <span className="font-semibold text-white">1 YES</span> token + <span className="font-semibold text-white">1 NO</span> token. You can then trade one side or hold both.
          </p>
        </div>

        {/* Amount Input */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Amount to Mint (USD)</span>
            <span className="text-sm text-gray-400">Wallet: $0.00</span>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="bg-transparent text-3xl font-bold text-white outline-none w-full"
              />
              <div className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl font-bold">
                USD
              </div>
            </div>
          </div>
        </div>

        {/* Output Display */}
        <div className="mb-6 p-4 bg-white/5 rounded-2xl">
          <div className="text-sm text-gray-400 mb-3">You will receive:</div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-xl">
              <div className="text-2xl font-bold text-white mb-1">{amount || '0.00'}</div>
              <div className="text-sm text-green-400">YES tokens</div>
            </div>
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
              <div className="text-2xl font-bold text-white mb-1">{amount || '0.00'}</div>
              <div className="text-sm text-red-400">NO tokens</div>
            </div>
          </div>
        </div>

        {/* Mint Button */}
        <button className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 rounded-xl font-bold text-white transition-all duration-300 hover:scale-105">
          Mint Complete Set
        </button>

        {/* Info */}
        <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-start space-x-2">
          <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-gray-400">
            Complete sets ensure YES + NO always equals $1. After resolution, winning tokens redeem for $1 each.
          </p>
        </div>
      </div>
    </div>
  );
}