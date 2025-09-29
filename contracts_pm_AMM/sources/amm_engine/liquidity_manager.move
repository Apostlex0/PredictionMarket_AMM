module pm_amm::liquidity_manager {
    use pm_amm::fixed_point::{Self, FixedPoint128};

    const E_INSUFFICIENT_LIQUIDITY: u64 = 700;
    const E_INVALID_LP_AMOUNT: u64 = 701;
    const E_UNBALANCED_LIQUIDITY: u64 = 702;
    const E_POOL_EXPIRED: u64 = 703;
    const E_MINIMUM_LIQUIDITY: u64 = 704;
    const E_ZERO_LIQUIDITY: u64 = 705;

    // ===== Result Structs (unchanged layout) =====

    public struct LiquidityResult has copy, drop {
        token_x_amount: u64,
        token_y_amount: u64,
        lp_tokens_minted: u128,
        new_liquidity_L: FixedPoint128,
    }

    public struct RemoveLiquidityResult has copy, drop {
        token_x_amount: u64,
        token_y_amount: u64,
        lp_tokens_burned: u128,
        new_liquidity_L: FixedPoint128,
    }
}