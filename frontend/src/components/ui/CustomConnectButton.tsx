// components/CustomConnectButton.tsx
'use client';
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { CheckCircle, Wallet } from 'lucide-react';

export function CustomConnectButton() {
  const { connected, account, connect, wallets } = useWallet();

  if (connected && account) {
    return (
      <div className="group relative px-6 py-3 bg-gradient-to-r from-green-500/10 to-emerald-500/10 backdrop-blur-sm border border-green-400/30 rounded-xl font-semibold text-white transition-all duration-300 hover:bg-gradient-to-r hover:from-green-500/20 hover:to-emerald-500/20 hover:border-green-400/50 hover:scale-105 hover:shadow-lg hover:shadow-green-500/20">
        <div className="flex items-center space-x-2">
          <CheckCircle className="w-4 h-4 text-green-400" />
          <span className="text-green-300">
            {account.address.toString().slice(0, 6)}...{account.address.toString().slice(-4)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => {
        if (wallets?.[0]) {
          connect(wallets[0].name);
        }
      }}
      className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white rounded-xl font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-cyan-500/20"
    >
      <div className="flex items-center space-x-2">
        <Wallet className="w-4 h-4" />
        <span>Connect Wallet</span>
      </div>
    </button>
  );
}

export function MobileCustomConnectButton() {
  const { connected, account, connect, wallets } = useWallet();

  if (connected && account) {
    return (
      <div className="group relative w-full px-6 py-3 bg-gradient-to-r from-green-500/10 to-emerald-500/10 backdrop-blur-sm border border-green-400/30 rounded-xl font-semibold text-white transition-all duration-300 hover:bg-gradient-to-r hover:from-green-500/20 hover:to-emerald-500/20 hover:border-green-400/50">
        <div className="flex items-center space-x-2">
          <CheckCircle className="w-4 h-4 text-green-400" />
          <span className="text-green-300">
            {account.address.toString().slice(0, 6)}...{account.address.toString().slice(-4)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => {
        if (wallets?.[0]) {
          connect(wallets[0].name);
        }
      }}
      className="w-full px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white rounded-xl font-semibold transition-all duration-300"
    >
      <div className="flex items-center justify-center space-x-2">
        <Wallet className="w-4 h-4" />
        <span>Connect Wallet</span>
      </div>
    </button>
  );
}