module pm_amm::pool_state {
    use std::option::{Self, Option};
    use aptos_framework::timestamp;

    use pm_amm::fixed_point::{Self, FixedPoint128};
    use pm_amm::swap_engine;
    use pm_amm::swap_math;
    use pm_amm::liquidity_math;
    use pm_amm::liquidity_manager;
    use pm_amm::invariant_amm;

    // ===== Error Codes (keep your numbers) =====
    /// Pool not initialized
    const E_POOL_NOT_INITIALIZED: u64 = 500;
    /// Pool already exists
    const E_POOL_ALREADY_EXISTS: u64 = 501;
    /// Invalid pool parameters
    const E_INVALID_POOL_PARAMS: u64 = 502;
    /// Pool expired
    const E_POOL_EXPIRED: u64 = 508;
    /// Market already active
    const LQ_E_MARKET_ALREADY_ACTIVE: u64 = 509;
    /// Not a dynamic pool
    const LQ_E_NOT_DYNAMIC_POOL: u64 = 510;
    /// Invalid timestamp
    const E_INVALID_TIMESTAMP: u64 = 504;
    /// Insufficient liquidity
    const LQ_E_INSUFFICIENT_LIQUIDITY: u64 = 700;
    /// Invalid LP amount
    const LQ_E_INVALID_LP_AMOUNT: u64     = 701;
    /// Unbalanced liquidity
    const LQ_E_UNBALANCED_LIQUIDITY: u64  = 702;
    // Removed duplicate - using E_POOL_EXPIRED (508) instead
    /// Minimum liquidity not met
    const LQ_E_MINIMUM_LIQUIDITY: u64     = 704;
    /// Zero liquidity not allowed
    const LQ_E_ZERO_LIQUIDITY: u64        = 705;

    // ===== Structs =====
    struct Pool<phantom X, phantom Y> has key, store {
        reserve_x: u64,
        reserve_y: u64,
        liquidity_parameter_L: FixedPoint128,
        lp_token_supply: u128,
        is_dynamic: bool,
        initial_L: Option<FixedPoint128>,
        expiration_timestamp: Option<u64>,
        creation_timestamp: u64,
        fee_rate: u16,
        accumulated_fees_x: u64,
        accumulated_fees_y: u64,
        total_volume_x: u128,
        total_volume_y: u128,
        swap_count: u64,
        last_interaction_timestamp: u64,
        cached_price: Option<FixedPoint128>,
        cached_price_timestamp: Option<u64>,
    }

    struct PoolInfo has copy, drop, store {
        reserve_x: u64,
        reserve_y: u64,
        liquidity_parameter: FixedPoint128,
        lp_supply: u128,
        fee_rate: u16,
        is_dynamic: bool,
    }

    /// Result for proportional add (no token I/O here)
    public(friend) struct AddLiqOutcome has copy, drop {
        actual_x: u64,
        actual_y: u64,
        minted_lp: u128,
        new_reserve_x: u64,
        new_reserve_y: u64,
        new_L: FixedPoint128,
    }
    
    // ===== Create =====
    public fun create_static_pool<X, Y>(
        initial_x: u64, initial_y: u64, liquidity_L: FixedPoint128, fee_rate: u16, _creator: address,
    ): Pool<X, Y> {
        assert!(initial_x > 0 && initial_y > 0, E_INVALID_POOL_PARAMS);
        assert!(fee_rate <= 1000, E_INVALID_POOL_PARAMS);
        let now = timestamp::now_seconds();
        Pool<X, Y> {
            reserve_x: initial_x,
            reserve_y: initial_y,
            liquidity_parameter_L: liquidity_L,
            lp_token_supply: liquidity_math::calculate_lp_tokens_from_liquidity_increase(&liquidity_L, &fixed_point::zero(), 0),
            is_dynamic: false,
            initial_L: option::none(),
            expiration_timestamp: option::none(),
            creation_timestamp: now,
            fee_rate,
            accumulated_fees_x: 0,
            accumulated_fees_y: 0,
            total_volume_x: 0,
            total_volume_y: 0,
            swap_count: 0,
            last_interaction_timestamp: now,
            cached_price: option::none(),
            cached_price_timestamp: option::none(),
        }
    }

    public fun create_dynamic_pool<X, Y>(
        initial_x: u64, initial_y: u64, liquidity_L: FixedPoint128, expiration_timestamp: u64, fee_rate: u16, _creator: address,
    ): Pool<X, Y> {
        let now = timestamp::now_seconds();
        assert!(expiration_timestamp > now, E_INVALID_TIMESTAMP);
        assert!(initial_x > 0 && initial_y > 0, E_INVALID_POOL_PARAMS);
        Pool<X, Y> {
            reserve_x: initial_x,
            reserve_y: initial_y,
            liquidity_parameter_L: liquidity_L,
            lp_token_supply: liquidity_math::calculate_lp_tokens_from_liquidity_increase(&liquidity_L, &fixed_point::zero(), 0),
            is_dynamic: true,
            initial_L: option::some(liquidity_L),
            expiration_timestamp: option::some(expiration_timestamp),
            creation_timestamp: now,
            fee_rate,
            accumulated_fees_x: 0,
            accumulated_fees_y: 0,
            total_volume_x: 0,
            total_volume_y: 0,
            swap_count: 0,
            last_interaction_timestamp: now,
            cached_price: option::none(),
            cached_price_timestamp: option::none(),
        }
    }
}