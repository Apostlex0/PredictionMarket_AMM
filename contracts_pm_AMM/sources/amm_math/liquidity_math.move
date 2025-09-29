module pm_amm::liquidity_math {
    use pm_amm::fixed_point::{Self, FixedPoint128};
    use pm_amm::invariant_amm;

    const E_INSUFFICIENT_LIQUIDITY: u64 = 700;
    /// Invalid LP amount
    const E_INVALID_LP_AMOUNT: u64 = 701;
    /// Unbalanced liquidity
    const E_UNBALANCED_LIQUIDITY: u64 = 702;
    /// Pool expired
    const E_POOL_EXPIRED: u64 = 703;
    /// Minimum liquidity not met
    const E_MINIMUM_LIQUIDITY: u64 = 704;
    /// Zero liquidity not allowed
    const E_ZERO_LIQUIDITY: u64 = 705;
    /// Invalid price
    const E_INVALID_PRICE: u64 = 706;
    /// Invalid pool value
    const E_INVALID_POOL_VALUE: u64 = 707;

    // ===== PM-AMM Liquidity Helpers =====

    /// Calculate LP tokens based on pool value contribution (PM-AMM approach)
    /// LP tokens represent proportional share of pool value V(P) = L * φ(Φ⁻¹(P))
    public fun calculate_lp_tokens_from_liquidity_increase(
        liquidity_increase: &FixedPoint128,
        current_liquidity: &FixedPoint128,
        current_lp_supply: u128
    ): u128 {
        if (current_lp_supply == 0) {
            // Initial liquidity: LP tokens = L * SCALE_FACTOR
            let scaled = fixed_point::mul(liquidity_increase, &fixed_point::from_u64(1_000_000));
            fixed_point::to_u128(&scaled)
        } else {
            // Additional liquidity: LP tokens proportional to L increase
            let ratio = fixed_point::div(liquidity_increase, current_liquidity);
            let new_tokens = fixed_point::mul(&ratio, &fixed_point::from_u128(current_lp_supply));
            fixed_point::to_u128(&new_tokens)
        }
    }

    /// Calculate pool value from current reserves and liquidity parameter
    public fun calculate_current_pool_value(
        reserve_x: u64,
        reserve_y: u64,
        liquidity_L: &FixedPoint128
    ): FixedPoint128 {
        let current_price = invariant_amm::calculate_marginal_price(reserve_x, reserve_y, liquidity_L);
        invariant_amm::calculate_pool_value(&current_price, liquidity_L)
    }

    /// Calculate required liquidity increase to achieve target pool value increase
    /// This is the core PM-AMM liquidity addition logic
    public fun calculate_required_liquidity_increase(
        target_value_increase: &FixedPoint128,
        current_price: &FixedPoint128
    ): FixedPoint128 {
        // ΔL = ΔV(P) / φ(Φ⁻¹(P))
        invariant_amm::calculate_liquidity_from_pool_value(current_price, target_value_increase)
    }
}