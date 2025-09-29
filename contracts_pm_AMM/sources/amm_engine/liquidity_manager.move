module pm_amm::liquidity_manager {
    use pm_amm::fixed_point::{Self, FixedPoint128};

    const E_INSUFFICIENT_LIQUIDITY: u64 = 700;
    const E_INVALID_LP_AMOUNT: u64 = 701;
    const E_UNBALANCED_LIQUIDITY: u64 = 702;
    const E_POOL_EXPIRED: u64 = 703;
    const E_MINIMUM_LIQUIDITY: u64 = 704;
    const E_ZERO_LIQUIDITY: u64 = 705;

    // ===== Result Structs =====

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

    // ===== friend constructors =====

    public(friend) fun mk_liquidity_result(
        token_x_amount: u64,
        token_y_amount: u64,
        lp_tokens_minted: u128,
        new_liquidity_L: FixedPoint128,
    ): LiquidityResult {
        LiquidityResult {
            token_x_amount, token_y_amount, lp_tokens_minted, new_liquidity_L
        }
    }

    public(friend) fun mk_remove_liquidity_result(
        token_x_amount: u64,
        token_y_amount: u64,
        lp_tokens_burned: u128,
        new_liquidity_L: FixedPoint128,
    ): RemoveLiquidityResult {
        RemoveLiquidityResult {
            token_x_amount, token_y_amount, lp_tokens_burned, new_liquidity_L
        }
    }

    // ===== getters =====

    public fun get_liquidity_result_tokens(result: &LiquidityResult): (u64, u64) {
        (result.token_x_amount, result.token_y_amount)
    }
    public fun get_remove_liquidity_result_tokens(result: &RemoveLiquidityResult): (u64, u64) {
        (result.token_x_amount, result.token_y_amount)
    }
    public fun get_remove_liquidity_result_x(result: &RemoveLiquidityResult): u64 {
        result.token_x_amount
    }
    public fun get_remove_liquidity_result_y(result: &RemoveLiquidityResult): u64 {
        result.token_y_amount
    }
}
