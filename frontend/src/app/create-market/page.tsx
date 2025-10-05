// src/app/create-market/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import {
  Plus,
  Info,
  AlertCircle,
  Calendar,
  DollarSign,
  Percent,
  FileText,
  Tag,
  Globe,
  Zap,
  Sparkles,
  Target,
  Shield
} from 'lucide-react';
import Navigation from '@/components/Navigation';
import { CONTRACT_ADDRESS, probabilityToU128, liquidityToU128 } from '@/lib/aptos_service';

interface MarketFormData {
  question: string;
  description: string;
  category: string;
  expirationDays: number;
  initialProbability: number;
  initialLiquidity: number;
  feeRate: number;
  resolutionSource: string;
  isDynamic: boolean;
}

const CATEGORIES = [
  'Politics', 'Sports', 'Technology', 'Economics', 'Entertainment',
  'Science', 'Crypto', 'Weather', 'Social', 'Other'
];

export default function CreateMarketPage() {
  const router = useRouter();
  const { account, connected, signAndSubmitTransaction } = useWallet();

  // Form state
  const [formData, setFormData] = useState<MarketFormData>({
    question: '',
    description: '',
    category: 'Politics',
    expirationDays: 30,
    initialProbability: 50,
    initialLiquidity: 10000,
    feeRate: 0.3,
    resolutionSource: '',
    isDynamic: true,
  });

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  // Form validation
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.question.trim()) {
      errors.question = 'Question is required';
    } else if (formData.question.length < 10) {
      errors.question = 'Question must be at least 10 characters';
    } else if (formData.question.length > 200) {
      errors.question = 'Question must be less than 200 characters';
    }

    if (!formData.description.trim()) {
      errors.description = 'Description is required';
    } else if (formData.description.length < 20) {
      errors.description = 'Description must be at least 20 characters';
    }

    if (formData.expirationDays < 1) {
      errors.expirationDays = 'Expiration must be at least 1 day';
    } else if (formData.expirationDays > 365) {
      errors.expirationDays = 'Expiration cannot exceed 365 days';
    }

    if (formData.initialProbability < 1 || formData.initialProbability > 99) {
      errors.initialProbability = 'Initial probability must be between 1% and 99%';
    }

    if (formData.initialLiquidity < 10) {
      errors.initialLiquidity = 'Initial liquidity must be at least $10';
    } else if (formData.initialLiquidity > 1000000000) {
      errors.initialLiquidity = 'Initial liquidity cannot exceed 10 APT';
    }

    if (formData.feeRate < 0.1 || formData.feeRate > 5) {
      errors.feeRate = 'Fee rate must be between 0.1% and 5%';
    }

    if (!formData.resolutionSource.trim()) {
      errors.resolutionSource = 'Resolution source is required';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!connected || !account) {
      setError('Please connect your wallet to create a market');
      return;
    }

    if (!validateForm()) {
      setError('Please fix the validation errors');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      console.log('Creating market with form data:', formData);

      // Convert human values to u128 using proper conversion functions
      const probabilityU128 = probabilityToU128(formData.initialProbability);
      const liquidityU128 = liquidityToU128(formData.initialLiquidity);

      console.log('Converted values:', { probabilityU128, liquidityU128 });

      // Submit transaction directly via wallet
      const response = await signAndSubmitTransaction({
        sender: account.address,
        data: {
          function: `${CONTRACT_ADDRESS}::pm_amm::create_prediction_market`,
          typeArguments: [
            '0x1::string::String',
            '0x1::string::String',
            '0x1::aptos_coin::AptosCoin'
          ],
          functionArguments: [
            Array.from(new TextEncoder().encode(formData.question)),
            Array.from(new TextEncoder().encode(formData.description)),
            Array.from(new TextEncoder().encode(formData.category)),
            formData.expirationDays * 24 * 60 * 60, // Convert days to seconds
            probabilityU128, // u128 FixedPoint128
            liquidityU128, // u128 FixedPoint128
            Math.floor(formData.feeRate * 100), // Basis points (u16)
            Array.from(new TextEncoder().encode(formData.resolutionSource)),
            formData.isDynamic,
          ],
        },
      });

      console.log('Transaction response:', response);
      setSuccessMessage('Market created successfully! Redirecting...');

      // Redirect to markets page after success
      setTimeout(() => {
        router.push('/markets');
      }, 2000);

    } catch (err: unknown) {
      console.error('Error creating market:', err);

      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to create market. Please check console for details.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle input changes
  const handleInputChange = (field: keyof MarketFormData, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // Clear messages after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-black text-white pt-24 pb-16 px-6">
        {/* Background Effects */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <motion.div
            className="absolute top-20 left-1/4 w-96 h-96 bg-gradient-to-r from-cyan-500/5 to-blue-500/5 rounded-full blur-3xl"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.2, 0.4, 0.2],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
          <motion.div
            className="absolute bottom-20 right-1/4 w-96 h-96 bg-gradient-to-r from-pink-500/5 to-purple-500/5 rounded-full blur-3xl"
            animate={{
              scale: [1.2, 1, 1.2],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{
              duration: 6,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto">
          {/* Header */}
          <motion.div
            className="mb-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <motion.h1
              className="text-5xl md:text-6xl font-bold mb-4 font-[family-name:var(--font-geist-mono)]"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, delay: 0.2 }}
            >
              <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 text-transparent bg-clip-text">
                <Plus className="w-12 h-12 text-cyan-400 inline-block mr-4 mb-2" />
                Create Market
              </span>
            </motion.h1>
            <motion.p
              className="text-xl text-gray-400 flex items-center gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              <Zap className="w-5 h-5 text-cyan-400" />
              Launch your own prediction market with PM-AMM technology
            </motion.p>
          </motion.div>

          {/* Main Form Container */}
          <motion.div
            className="relative"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/8 to-blue-500/8 rounded-2xl blur-2xl"></div>
            <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8">

            {/* Wallet Connection Status */}
            {!connected && (
              <motion.div
                className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="flex items-center space-x-3">
                  <AlertCircle className="w-5 h-5 text-yellow-400" />
                  <p className="text-yellow-300">Please connect your wallet to create a market</p>
                </div>
              </motion.div>
            )}

            {/* Success Message */}
            {successMessage && (
              <motion.div
                className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-xl flex items-center space-x-3"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Sparkles className="w-5 h-5 text-green-400" />
                <span className="text-sm text-green-300">{successMessage}</span>
              </motion.div>
            )}

            {/* Error Message */}
            {error && (
              <motion.div
                className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center space-x-3"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <AlertCircle className="w-5 h-5 text-red-400" />
                <span className="text-sm text-red-300">{error}</span>
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Question */}
              <div>
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-300 mb-3">
                  <FileText className="w-4 h-4 text-cyan-400" />
                  <span>Market Question</span>
                </label>
                <input
                  type="text"
                  value={formData.question}
                  onChange={(e) => handleInputChange('question', e.target.value)}
                  placeholder="Will Bitcoin reach $100,000 by the end of 2024?"
                  className="w-full px-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 focus:shadow-lg focus:shadow-cyan-500/20 transition-all duration-300"
                  maxLength={200}
                />
                <div className="flex justify-between items-center mt-2">
                  <span className="text-xs text-gray-500">{formData.question.length}/200 characters</span>
                  {validationErrors.question && (
                    <span className="text-xs text-red-400">{validationErrors.question}</span>
                  )}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-300 mb-3">
                  <Info className="w-4 h-4 text-cyan-400" />
                  <span>Description</span>
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Provide detailed context about the market conditions, resolution criteria, and any relevant information..."
                  className="w-full px-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 focus:shadow-lg focus:shadow-cyan-500/20 transition-all duration-300 resize-none"
                  rows={4}
                />
                {validationErrors.description && (
                  <span className="text-xs text-red-400 mt-2 block">{validationErrors.description}</span>
                )}
              </div>

              {/* Category and Expiration */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="flex items-center space-x-2 text-sm font-medium text-gray-300 mb-3">
                    <Tag className="w-4 h-4 text-cyan-400" />
                    <span>Category</span>
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                      className="w-full px-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white hover:bg-white/10 hover:border-cyan-400/30 focus:outline-none focus:border-cyan-500/50 transition-all duration-300 flex items-center justify-between"
                    >
                      <span>{formData.category}</span>
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {showCategoryDropdown && (
                      <div className="absolute top-full mt-2 left-0 right-0 bg-black/90 backdrop-blur-xl border border-white/10 rounded-2xl p-2 z-50 shadow-2xl">
                        {CATEGORIES.map((category) => (
                          <button
                            key={category}
                            type="button"
                            onClick={() => {
                              handleInputChange('category', category);
                              setShowCategoryDropdown(false);
                            }}
                            className={`w-full flex items-center px-4 py-3 rounded-xl transition-all duration-200 text-left ${
                              formData.category === category
                                ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 text-white'
                                : 'hover:bg-white/5 text-gray-300 hover:text-white'
                            }`}
                          >
                            {category}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="flex items-center space-x-2 text-sm font-medium text-gray-300 mb-3">
                    <Calendar className="w-4 h-4 text-cyan-400" />
                    <span>Expiration (Days)</span>
                  </label>
                  <input
                    type="number"
                    value={formData.expirationDays}
                    onChange={(e) => handleInputChange('expirationDays', parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white focus:outline-none focus:border-cyan-500/50 transition-all duration-300"
                    min="1"
                    max="365"
                  />
                  {validationErrors.expirationDays && (
                    <span className="text-xs text-red-400 mt-2 block">{validationErrors.expirationDays}</span>
                  )}
                </div>
              </div>

              {/* Initial Probability and Liquidity */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="flex items-center space-x-2 text-sm font-medium text-gray-300 mb-3">
                    <Target className="w-4 h-4 text-cyan-400" />
                    <span>Initial Probability (%)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={formData.initialProbability}
                      onChange={(e) => handleInputChange('initialProbability', parseFloat(e.target.value) || 0)}
                      className="w-full px-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white text-2xl font-bold focus:outline-none focus:border-cyan-500/50 transition-all duration-300"
                      min="1"
                      max="99"
                      step="0.1"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 px-3 py-1 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg font-bold text-sm">
                      %
                    </div>
                  </div>
                  {validationErrors.initialProbability && (
                    <span className="text-xs text-red-400 mt-2 block">{validationErrors.initialProbability}</span>
                  )}
                </div>

                <div>
                  <label className="flex items-center space-x-2 text-sm font-medium text-gray-300 mb-3">
                    <DollarSign className="w-4 h-4 text-cyan-400" />
                    <span>Initial Liquidity (Octa)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={formData.initialLiquidity}
                      onChange={(e) => handleInputChange('initialLiquidity', parseFloat(e.target.value) || 0)}
                      className="w-full px-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white text-2xl font-bold focus:outline-none focus:border-cyan-500/50 transition-all duration-300"
                      min="10"
                      max="1000000000"
                      step="10"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 px-3 py-1 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg font-bold text-sm">
                      Octa
                    </div>
                  </div>
                  {validationErrors.initialLiquidity && (
                    <span className="text-xs text-red-400 mt-2 block">{validationErrors.initialLiquidity}</span>
                  )}
                </div>
              </div>

              {/* Fee Rate and Resolution Source */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="flex items-center space-x-2 text-sm font-medium text-gray-300 mb-3">
                    <Percent className="w-4 h-4 text-cyan-400" />
                    <span>Fee Rate (%)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={formData.feeRate}
                      onChange={(e) => handleInputChange('feeRate', parseFloat(e.target.value) || 0)}
                      className="w-full px-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white text-2xl font-bold focus:outline-none focus:border-cyan-500/50 transition-all duration-300"
                      min="0.1"
                      max="5"
                      step="0.1"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 px-3 py-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg font-bold text-sm">
                      %
                    </div>
                  </div>
                  {validationErrors.feeRate && (
                    <span className="text-xs text-red-400 mt-2 block">{validationErrors.feeRate}</span>
                  )}
                </div>

                <div>
                  <label className="flex items-center space-x-2 text-sm font-medium text-gray-300 mb-3">
                    <Globe className="w-4 h-4 text-cyan-400" />
                    <span>Resolution Source</span>
                  </label>
                  <input
                    type="text"
                    value={formData.resolutionSource}
                    onChange={(e) => handleInputChange('resolutionSource', e.target.value)}
                    placeholder="CoinGecko, Reuters, Official Website..."
                    className="w-full px-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white focus:outline-none focus:border-cyan-500/50 transition-all duration-300 placeholder-gray-500"
                  />
                  {validationErrors.resolutionSource && (
                    <span className="text-xs text-red-400 mt-2 block">{validationErrors.resolutionSource}</span>
                  )}
                </div>
              </div>

              {/* Dynamic Pool Toggle */}
              <div>
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-300 mb-3">
                  <Shield className="w-4 h-4" />
                  <span>Pool Type</span>
                </label>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                          formData.isDynamic ? 'bg-gradient-to-r from-cyan-500 to-blue-500' : 'bg-gray-600'
                        }`}>
                          {formData.isDynamic && <Shield className="w-4 h-4 text-white" />}
                        </div>
                        <span className="text-lg font-semibold text-white">
                          {formData.isDynamic ? 'Dynamic Pool (Recommended)' : 'Static Pool'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400">
                        {formData.isDynamic
                          ? 'Provides automatic loss protection through time-based withdrawals'
                          : 'Traditional constant liquidity pool'
                        }
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleInputChange('isDynamic', !formData.isDynamic)}
                      className={`relative w-14 h-8 rounded-full transition-colors duration-300 ${
                        formData.isDynamic ? 'bg-gradient-to-r from-cyan-500 to-blue-500' : 'bg-gray-600'
                      }`}
                    >
                      <div className={`absolute w-6 h-6 bg-white rounded-full top-1 transition-transform duration-300 ${
                        formData.isDynamic ? 'translate-x-7' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={!connected || isSubmitting}
                className={`relative w-full px-8 py-4 font-semibold text-white transition-all duration-300 overflow-hidden rounded-xl ${
                  !connected || isSubmitting
                    ? 'bg-gray-600 cursor-not-allowed'
                    : 'bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 hover:shadow-lg hover:shadow-cyan-500/50'
                }`}
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Creating Market...
                    </>
                  ) : !connected ? (
                    <>
                      <Zap className="w-5 h-5" />
                      Connect Wallet
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Create Market
                    </>
                  )}
                </span>
              </button>
            </form>

            {/* Info Footer */}
            <div className="mt-8 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-start space-x-3">
              <Info className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-gray-300">
                <div className="font-semibold text-blue-400 mb-1">Market Creation Fee</div>
                <div>
                  Creating a market requires a transaction fee paid in APT. Your market will be live immediately after creation.
                </div>
              </div>
            </div>
          </div>
        </motion.div>
        </div>
      </main>
    </>
  );
}
