'use client';
import React, { useState } from 'react';
import { useWallet, groupAndSortWallets } from "@aptos-labs/wallet-adapter-react";
import { Wallet, ChevronDown, Copy, ExternalLink, LogOut, Zap } from 'lucide-react';

export function ConnectWalletButton() {
  const { connect, disconnect, account, connected, wallets = [], notDetectedWallets = [] } = useWallet();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showWalletSelector, setShowWalletSelector] = useState(false);

  // Group and sort wallets to separate different types
  const { aptosConnectWallets, availableWallets, installableWallets } = groupAndSortWallets([
    ...wallets,
    ...notDetectedWallets
  ]);

  // Prioritize extension wallets (Petra, Martian, etc.) over social login
  const displayWallets = [...availableWallets, ...installableWallets, ...aptosConnectWallets];

  const getWalletDescription = (walletName: string) => {
    switch (walletName) {
      case 'Petra':
        return 'Popular Aptos wallet';
      case 'Martian':
        return 'Multi-chain wallet';
      case 'Nightly':
        return 'Developer-friendly wallet';
      case 'Continue with Google':
      case 'Continue with Apple':
        return 'Social login wallet';
      default:
        return 'Secure wallet option';
    }
  };

  const copyAddress = () => {
    if (account?.address) {
      navigator.clipboard.writeText(account.address.toString());
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (connected && account) {
    return (
      <div className="relative">
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="group relative px-4 py-2.5 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 hover:from-cyan-500/20 hover:to-blue-500/20 border border-cyan-400/30 hover:border-cyan-400/50 rounded-xl backdrop-blur-sm transition-all duration-300 flex items-center space-x-3 hover:shadow-lg hover:shadow-cyan-500/20"
        >
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-lg blur-sm opacity-75 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center">
              <Wallet className="w-4 h-4 text-white" />
            </div>
          </div>
          <div className="flex flex-col items-start">
            <span className="text-xs text-gray-400 font-medium">Connected</span>
            <span className="text-sm text-white font-mono">{formatAddress(account.address.toString())}</span>
          </div>
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {isDropdownOpen && (
          <div className="absolute top-full right-0 mt-2 w-64 bg-black/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl shadow-black/50 z-50">
            <div className="p-4 border-b border-white/5">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm text-white font-medium">Wallet Connected</p>
                  <p className="text-xs text-gray-400">Ready for transactions</p>
                </div>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400 font-mono">{account.address.toString()}</span>
                  <button
                    onClick={copyAddress}
                    className="p-1 hover:bg-white/10 rounded transition-colors duration-200"
                  >
                    <Copy className="w-3 h-3 text-gray-400 hover:text-white" />
                  </button>
                </div>
              </div>
            </div>
            <div className="p-2">
              <button
                onClick={() => {
                  disconnect();
                  setIsDropdownOpen(false);
                }}
                className="w-full flex items-center space-x-3 px-3 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all duration-200"
              >
                <LogOut className="w-4 h-4" />
                <span className="text-sm">Disconnect</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowWalletSelector(!showWalletSelector)}
        className="group relative px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 rounded-xl font-medium text-white transition-all duration-300 flex items-center space-x-2 hover:shadow-lg hover:shadow-cyan-500/50 hover:scale-105 transform"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/20 to-blue-400/20 rounded-xl blur-lg opacity-75 group-hover:opacity-100 transition-opacity duration-300"></div>
        <div className="relative flex items-center space-x-2">
          <Zap className="w-4 h-4 group-hover:rotate-12 transition-transform duration-300" />
          <span>Connect Wallet</span>
        </div>
      </button>

      {showWalletSelector && (
        <div className="absolute top-full right-0 mt-2 w-72 bg-black/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl shadow-black/50 z-50">
          <div className="p-4 border-b border-white/5">
            <h3 className="text-lg font-semibold text-white mb-1">Connect Wallet</h3>
            <p className="text-sm text-gray-400">Choose your preferred wallet to connect</p>
          </div>
          <div className="p-2 space-y-1">
            {displayWallets.map((wallet) => (
              <button
                key={wallet.name}
                onClick={() => {
                  connect(wallet.name);
                  setShowWalletSelector(false);
                }}
                className="w-full flex items-center space-x-3 px-4 py-3 hover:bg-white/5 rounded-lg transition-all duration-200 group/wallet"
              >
                <div className="w-10 h-10 bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg flex items-center justify-center group-hover/wallet:from-cyan-500/20 group-hover/wallet:to-blue-500/20 transition-all duration-200">
                  {wallet.icon ? (
                    <img src={wallet.icon} alt={wallet.name} className="w-6 h-6 rounded" />
                  ) : (
                    <Wallet className="w-5 h-5 text-gray-400 group-hover/wallet:text-cyan-400" />
                  )}
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-white group-hover/wallet:text-cyan-400 transition-colors duration-200">
                    {wallet.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {getWalletDescription(wallet.name)}
                  </p>
                </div>
                <ExternalLink className="w-4 h-4 text-gray-500 group-hover/wallet:text-cyan-400 transition-colors duration-200" />
              </button>
            ))}
          </div>
          <div className="p-4 border-t border-white/5">
            <p className="text-xs text-gray-500 text-center">
              Don't have a wallet? Download from the official store
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export function MobileConnectWalletButton() {
  const { connect, disconnect, account, connected, wallets = [], notDetectedWallets = [] } = useWallet();
  const [showWalletSelector, setShowWalletSelector] = useState(false);

  // Group and sort wallets for mobile
  const { aptosConnectWallets, availableWallets, installableWallets } = groupAndSortWallets([
    ...wallets,
    ...notDetectedWallets
  ]);

  // Prioritize extension wallets over social login for mobile too
  const displayWallets = [...availableWallets, ...installableWallets, ...aptosConnectWallets];

  const getWalletDescription = (walletName: string) => {
    switch (walletName) {
      case 'Petra':
        return 'Popular Aptos wallet';
      case 'Martian':
        return 'Multi-chain wallet';
      case 'Nightly':
        return 'Developer-friendly wallet';
      default:
        return 'Secure wallet option';
    }
  };

  if (connected && account) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm text-white font-medium">Connected</p>
              <p className="text-xs text-gray-400 font-mono">{account.address.toString().slice(0, 8)}...{account.address.toString().slice(-6)}</p>
            </div>
          </div>
        </div>
        <button
          onClick={disconnect}
          className="w-full flex items-center justify-center space-x-2 px-4 py-3 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-all duration-200"
        >
          <LogOut className="w-4 h-4" />
          <span>Disconnect Wallet</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        onClick={() => setShowWalletSelector(!showWalletSelector)}
        className="w-full px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 rounded-xl font-medium text-white transition-all duration-300 flex items-center justify-center space-x-2"
      >
        <Zap className="w-4 h-4" />
        <span>Connect Wallet</span>
      </button>

      {showWalletSelector && (
        <div className="space-y-2">
          {displayWallets.map((wallet) => (
            <button
              key={wallet.name}
              onClick={() => {
                connect(wallet.name);
                setShowWalletSelector(false);
              }}
              className="w-full flex items-center space-x-3 px-4 py-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all duration-200"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg flex items-center justify-center">
                {wallet.icon ? (
                  <img src={wallet.icon} alt={wallet.name} className="w-5 h-5 rounded" />
                ) : (
                  <Wallet className="w-4 h-4 text-gray-400" />
                )}
              </div>
              <div className="flex-1 text-left">
                <span className="text-sm text-white">{wallet.name}</span>
                <p className="text-xs text-gray-500">{getWalletDescription(wallet.name)}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
