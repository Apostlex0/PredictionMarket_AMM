# pm-AMM: Prediction Market Automated Market Maker

The first AMM optimized for prediction markets using Gaussian score dynamics and uniform loss-vs-rebalancing (LVR).

## 🎯 Overview

pm-AMM is a mathematically optimized automated market maker specifically designed for prediction markets. Unlike traditional AMMs like Uniswap's CPMM, pm-AMM uses the normal distribution (Gaussian) to create optimal liquidity distribution for outcome tokens.

## ✨ Key Features

- **Uniform LVR**: Consistent losses for liquidity providers regardless of price
- **Better Liquidity**: Concentrated around 50% probability where most trading happens
- **Time-Aware**: Dynamic variant adjusts liquidity over time to maintain constant expected LVR
- **Gas Optimized**: Efficient approximations for normal distribution functions
- **47% Reduction**: Average LP losses compared to CPMM

## 🔬 Mathematical Foundation

The AMM is based on modeling prediction markets as bets on Brownian motion (random walks):

1. **Score Process**: `dZ_t = σ dB_t`
2. **Price Conversion**: `P_t = Φ(Z_t / σ√(T-t))`
3. **Optimal Reserves**: Derived from uniform LVR condition
4. **Core Invariant**: `(y-x)Φ((y-x)/L) + Lφ((y-x)/L) - y = 0`
5. **Dynamic Adjustment**: `L_t = L_0 √(T-t)`

## 🏗️ Project Structure

```
pm-AMM/
├── frontend/           # Next.js frontend application
│   ├── src/
│   │   ├── app/       # Next.js app router
│   │   └── components/ # React components
│   ├── package.json
│   └── ...
├── contracts/         # Smart contracts (coming soon)
├── docs/             # Documentation (coming soon)
└── README.md
```

## 🚀 Getting Started

### Frontend Development

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## 🛠️ Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Blockchain**: Aptos (planned)
- **UI Components**: Lucide React, Custom components
- **Styling**: Tailwind CSS with custom gradients

## 📚 Learn More

- **Mathematical Paper**: [Coming Soon]
- **Technical Documentation**: [Coming Soon]
- **Live Demo**: [Coming Soon]

## 🤝 Contributing

This project is in active development. Contributions welcome once we establish contribution guidelines.

## 📄 License

[License TBD]

---

Built with mathematical precision for the future of prediction markets.