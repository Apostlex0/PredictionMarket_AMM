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
    
    // ===== Dynamic Liquidity =====
    public fun get_effective_liquidity<X, Y>(pool: &Pool<X, Y>): FixedPoint128 {
        if (!pool.is_dynamic) { return pool.liquidity_parameter_L };
        let now = timestamp::now_seconds();
        let expiration = *option::borrow(&pool.expiration_timestamp);
        assert!(now < expiration, E_POOL_EXPIRED);
        let initial_L = *option::borrow(&pool.initial_L);
        let total_duration = expiration - pool.creation_timestamp;
        let time_remaining = expiration - now;
        let time_ratio = fixed_point::from_fraction(time_remaining, total_duration);
        let sqrt_ratio = fixed_point::sqrt(&time_ratio);
        fixed_point::mul(&initial_L, &sqrt_ratio)
    }

    // ===== Reserve/Fee Updates =====
    public fun update_reserves<X, Y>(
        pool: &mut Pool<X, Y>, new_x: u64, new_y: u64, volume_x: u128, volume_y: u128,
    ) {
        pool.reserve_x = new_x;
        pool.reserve_y = new_y;
        pool.total_volume_x = pool.total_volume_x + volume_x;
        pool.total_volume_y = pool.total_volume_y + volume_y;
        pool.swap_count = pool.swap_count + 1;
        pool.last_interaction_timestamp = timestamp::now_seconds();
        pool.cached_price = option::none();
        pool.cached_price_timestamp = option::none();
    }
    public fun add_fees<X, Y>(pool: &mut Pool<X, Y>, fee_x: u64, fee_y: u64) {
        pool.accumulated_fees_x = pool.accumulated_fees_x + fee_x;
        pool.accumulated_fees_y = pool.accumulated_fees_y + fee_y;
    }

    // ===== LP =====
    public fun mint_lp_tokens<X, Y>(pool: &mut Pool<X, Y>, amount: u128) { pool.lp_token_supply = pool.lp_token_supply + amount }
    public fun burn_lp_tokens<X, Y>(pool: &mut Pool<X, Y>, amount: u128) {
        assert!(amount <= pool.lp_token_supply, E_INVALID_POOL_PARAMS);
        pool.lp_token_supply = pool.lp_token_supply - amount
    }

    // ===== Getters =====
    public fun get_reserves<X, Y>(pool: &Pool<X, Y>): (u64, u64) { (pool.reserve_x, pool.reserve_y) }
    public fun get_lp_supply<X, Y>(pool: &Pool<X, Y>): u128 { pool.lp_token_supply }
    public fun get_fee_rate<X, Y>(pool: &Pool<X, Y>): u16 { pool.fee_rate }
    public fun get_accumulated_fees<X, Y>(pool: &Pool<X, Y>): (u64, u64) { (pool.accumulated_fees_x, pool.accumulated_fees_y) }
    
    /// Get current liquidity parameter (for backward compatibility)
    public fun get_liquidity_parameter<X, Y>(pool: &Pool<X, Y>): FixedPoint128 {
        get_effective_liquidity(pool)
    }
    
    /// Set base liquidity parameter (for dynamic pools, this sets L₀)
    fun set_liquidity_parameter<X, Y>(pool: &mut Pool<X, Y>, new_L: FixedPoint128) {
        if (pool.is_dynamic) {
            // For dynamic pools, we need to set the base L₀, not the effective L
            // Calculate what L₀ should be to achieve new_L at current time
            let now = timestamp::now_seconds();
            let expiration = *option::borrow(&pool.expiration_timestamp);
            let total_duration = expiration - pool.creation_timestamp;
            let time_remaining = expiration - now;
            let time_ratio = fixed_point::from_fraction(time_remaining, total_duration);
            let sqrt_ratio = fixed_point::sqrt(&time_ratio);
            let new_base_L = fixed_point::div(&new_L, &sqrt_ratio);
            pool.initial_L = option::some(new_base_L);
        } else {
            pool.liquidity_parameter_L = new_L;
        }
    }
    
    
    public fun get_pool_info<X, Y>(pool: &Pool<X, Y>): PoolInfo {
        PoolInfo {
            reserve_x: pool.reserve_x,
            reserve_y: pool.reserve_y,
            liquidity_parameter: get_effective_liquidity(pool),
            lp_supply: pool.lp_token_supply,
            fee_rate: pool.fee_rate,
            is_dynamic: pool.is_dynamic,
        }
    }
    public fun is_expired<X, Y>(pool: &Pool<X, Y>): bool {
        if (!pool.is_dynamic) { return false };
        let now = timestamp::now_seconds();
        let expiration = *option::borrow(&pool.expiration_timestamp);
        now >= expiration
    }
}