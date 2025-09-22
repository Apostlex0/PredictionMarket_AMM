// components/ui/Button.tsx
import React from 'react';
import { cn } from '@/components/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'default',
  size = 'md',
  className,
  children,
  ...props
}) => {
  const baseStyles = 'font-medium transition-all duration-300 rounded-xl font-[family-name:var(--font-geist-mono)]';
  
  const variants = {
    default: 'bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 text-white hover:opacity-90',
    outline: 'bg-white/5 border border-white/10 hover:bg-white/10 text-white',
    ghost: 'bg-transparent hover:bg-white/5 text-white',
  };

  const sizes = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  };

  return (
    <button
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </button>
  );
};