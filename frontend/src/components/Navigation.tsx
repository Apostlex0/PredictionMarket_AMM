// components/Navigation.tsx
'use client'
import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, Menu, X, TrendingUp, Droplets, Plus, BarChart3 } from 'lucide-react';
import { ConnectWalletButton, MobileConnectWalletButton } from '@/components/ui/ConnectWalletButton';

const Navigation: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();

  const navItems = [
    { href: '/markets', label: 'Markets', icon: <TrendingUp className="w-4 h-4" /> },
    { href: '/swap', label: 'Trade', icon: <Activity className="w-4 h-4" /> },
    { href: '/liquidity', label: 'Liquidity', icon: <Droplets className="w-4 h-4" /> },
    { href: '/create', label: 'Create', icon: <Plus className="w-4 h-4" /> },
    { href: '/analytics', label: 'Analytics', icon: <BarChart3 className="w-4 h-4" /> },
  ];

  const isActive = (href: string) => pathname === href;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4 backdrop-blur-xl bg-black/30 border-b border-white/5">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-3 group cursor-pointer">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-2xl blur-md opacity-75 group-hover:opacity-100 transition-all duration-300"></div>
            <div className="relative w-11 h-11 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center transform group-hover:scale-110 transition-all duration-300 group-hover:shadow-lg group-hover:shadow-cyan-500/50">
              <Activity className="w-6 h-6 text-white group-hover:rotate-12 transition-transform duration-300" />
            </div>
          </div>
          <span className="text-2xl font-bold font-[family-name:var(--font-geist-mono)] bg-gradient-to-r from-cyan-400 to-blue-400 text-transparent bg-clip-text group-hover:from-cyan-300 group-hover:to-blue-300 transition-all duration-300">
            pm-AMM
          </span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center space-x-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`relative px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 flex items-center space-x-2 group/nav ${isActive(item.href)
                  ? 'text-white bg-white/10 backdrop-blur-sm border border-white/20'
                  : 'text-gray-400 hover:text-white hover:bg-gradient-to-r hover:from-cyan-500/10 hover:to-blue-500/10 hover:border hover:border-cyan-400/30 hover:shadow-lg hover:shadow-cyan-500/20'
                }`}
            >
              <span className="group-hover/nav:scale-110 transition-transform duration-200">{item.icon}</span>
              <span className="group-hover/nav:translate-x-1 transition-transform duration-200">{item.label}</span>
              {isActive(item.href) && (
                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-cyan-400 to-blue-500 animate-pulse"></div>
              )}
            </Link>
          ))}
        </div>

        {/* Desktop Actions */}
        <div className="hidden md:flex items-center space-x-4">
          <ConnectWalletButton />
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-all duration-300 backdrop-blur-sm"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Navigation */}
      {isMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-black/95 backdrop-blur-xl border-b border-white/5">
          <div className="px-6 py-6 space-y-3">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 ${isActive(item.href)
                  ? 'text-white bg-white/10'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                onClick={() => setIsMenuOpen(false)}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            ))}

            <div className="pt-4 border-t border-white/5">
              <MobileConnectWalletButton />
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navigation;