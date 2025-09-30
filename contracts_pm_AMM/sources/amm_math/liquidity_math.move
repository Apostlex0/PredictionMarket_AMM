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

    const LP_TOKEN_SCALE_FACTOR: u64 = 1_000_000;

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

    /// Creator specifies target price and total value, gets exact token requirements
    public fun add_initial_liquidity_pm_amm(
        target_price: &FixedPoint128,
        total_value_to_provide: &FixedPoint128
    ): (u64, u64, u128, FixedPoint128) {
        assert!(
            fixed_point::greater_than(target_price, &fixed_point::zero())
            && fixed_point::less_than(target_price, &fixed_point::one()),
            E_INVALID_PRICE
        );
        assert!(
            fixed_point::greater_than(total_value_to_provide, &fixed_point::zero()),
            E_ZERO_LIQUIDITY
        );

        // Calculate required L to achieve target pool value at target price
        // L = V(P) / φ(Φ⁻¹(P))
        let liquidity_L = invariant_amm::calculate_liquidity_from_pool_value(target_price, total_value_to_provide);

        // Calculate EXACT reserves needed for this price and L
        let (required_x, required_y) = invariant_amm::calculate_optimal_reserves(target_price, &liquidity_L);

        // LP tokens based on liquidity parameter
        let lp_tokens = calculate_lp_tokens_from_liquidity_increase(&liquidity_L, &fixed_point::zero(), 0);
        assert!(lp_tokens >= (LP_TOKEN_SCALE_FACTOR as u128), E_MINIMUM_LIQUIDITY);

        (required_x, required_y, lp_tokens, liquidity_L)
    }

    /// PM-AMM liquidity addition - maintains optimal reserves for current price
    public fun add_liquidity_pm_amm(
        desired_value_increase: &FixedPoint128,
        current_reserve_x: u64,
        current_reserve_y: u64,
        current_L: &FixedPoint128,
        current_lp_supply: u128
    ): (u64, u64, u64, u64, u128, FixedPoint128) {
        // 1. Calculate current market price from reserves
        let current_price = invariant_amm::calculate_marginal_price(
            current_reserve_x, current_reserve_y, current_L
        );

        // 2. Calculate required liquidity increase for desired value increase
        let liquidity_increase = calculate_required_liquidity_increase(
            desired_value_increase, &current_price
        );

        // 3. Calculate new total liquidity parameter
        let new_L = fixed_point::add(current_L, &liquidity_increase);

        // 4. Calculate optimal reserves for current price with new L
        let (optimal_new_x, optimal_new_y) = invariant_amm::calculate_optimal_reserves(
            &current_price, &new_L
        );

        // 5. Calculate required token amounts (with underflow protection)
        assert!(optimal_new_x >= current_reserve_x, E_INSUFFICIENT_LIQUIDITY);
        assert!(optimal_new_y >= current_reserve_y, E_INSUFFICIENT_LIQUIDITY);
        let required_x = optimal_new_x - current_reserve_x;
        let required_y = optimal_new_y - current_reserve_y;

        // 6. Calculate LP tokens based on liquidity increase
        let lp_tokens = calculate_lp_tokens_from_liquidity_increase(
            &liquidity_increase, current_L, current_lp_supply
        );

        (required_x, required_y, optimal_new_x, optimal_new_y, lp_tokens, new_L)
    }
}