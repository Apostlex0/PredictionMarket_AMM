module pm_amm::pool_state {
    use std::option::{Self, Option};
    use aptos_framework::timestamp;

    use pm_amm::fixed_point::{Self, FixedPoint128};
    use pm_amm::swap_engine;
    use pm_amm::swap_math;
    use pm_amm::liquidity_math;
    use pm_amm::liquidity_manager;
    use pm_amm::invariant_amm;

    friend pm_amm::dynamic_tracking;

    // ===== Error Codes (keep your numbers) =====
    /// Pool not initialized
    const E_POOL_NOT_INITIALIZED: u64 = 500;
    /// Pool already exists
    const E_POOL_ALREADY_EXISTS: u64 = 501;
    /// Invalid pool parameters
    const E_INVALID_POOL_PARAMS: u64 = 502;
    /// Pool expired
    const E_POOL_EXPIRED: u64 = 503;
    /// Invalid timestamp
    const E_INVALID_TIMESTAMP: u64 = 504;

    // Liquidity path (match original liquidity_manager)
    /// Insufficient liquidity
    const LQ_E_INSUFFICIENT_LIQUIDITY: u64 = 700;
    /// Invalid LP amount
    const LQ_E_INVALID_LP_AMOUNT: u64     = 701;
    /// Unbalanced liquidity
    const LQ_E_UNBALANCED_LIQUIDITY: u64  = 702;
    /// Pool expired
    const LQ_E_POOL_EXPIRED: u64          = 703;
    /// Minimum liquidity not met
    const LQ_E_MINIMUM_LIQUIDITY: u64     = 704;
    /// Zero liquidity not allowed
    const LQ_E_ZERO_LIQUIDITY: u64        = 705;
     /// Market already active
    const LQ_E_MARKET_ALREADY_ACTIVE: u64 = 509;
    /// Not a dynamic pool
    const LQ_E_NOT_DYNAMIC_POOL: u64 = 510;

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

    // Getter functions for AddLiqOutcome
    public(friend) fun get_actual_x(outcome: &AddLiqOutcome): u64 { outcome.actual_x }
    public(friend) fun get_actual_y(outcome: &AddLiqOutcome): u64 { outcome.actual_y }
    public(friend) fun get_minted_lp(outcome: &AddLiqOutcome): u128 { outcome.minted_lp }
    
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

    // ===== Price cache =====
    public fun get_cached_price<X, Y>(pool: &Pool<X, Y>): Option<FixedPoint128> {
        if (option::is_some(&pool.cached_price_timestamp)) {
            let cache_time = *option::borrow(&pool.cached_price_timestamp);
            let now = timestamp::now_seconds();
            if (now - cache_time <= 1) { return pool.cached_price }
        };
        option::none()
    }
    public fun update_price_cache<X, Y>(pool: &mut Pool<X, Y>, price: FixedPoint128) {
        pool.cached_price = option::some(price);
        pool.cached_price_timestamp = option::some(timestamp::now_seconds());
    }

    // ===== Helpers =====

    /// Calculate implied total value from desired token amounts at given price
    /// This helps convert legacy (desired_x, desired_y) interface to PM-AMM value-based approach
    fun calculate_implied_value_from_tokens(
        desired_x: u64,
        desired_y: u64,
        price: &FixedPoint128
    ): FixedPoint128 {
        let x_value = fixed_point::mul(&fixed_point::from_u64(desired_x), price);
        let y_value = fixed_point::mul(&fixed_point::from_u64(desired_y), 
                                      &fixed_point::sub(&fixed_point::one(), price));
        fixed_point::add(&x_value, &y_value)
    }

    /// Get virtual reserves for dynamic pools (time-decayed optimal reserves)
    /// For static pools, returns actual reserves
    public fun get_virtual_reserves<X, Y>(pool: &Pool<X, Y>): (u64, u64) {
        if (!pool.is_dynamic) {
            return get_reserves(pool)  // Static pools use actual reserves
        };
        
        // For dynamic pools: Use cached price
        let current_price = *option::borrow(&pool.cached_price);
        
        let eff_L = get_effective_liquidity(pool);
        // Calculate optimal reserves for current price and time-decayed liquidity
        invariant_amm::calculate_optimal_reserves(&current_price, &eff_L)
    }

    /// Get pool reserves (friend function)
    public(friend) fun get_pool_reserves_friend<X, Y>(owner: address): (u64, u64) acquires Pool {
        let p = borrow_global<Pool<X, Y>>(owner);
        get_reserves(p)
    }

    /// Get LP supply (friend function)
    public(friend) fun get_lp_supply_friend<X, Y>(owner: address): u128 acquires Pool {
        let p = borrow_global<Pool<X, Y>>(owner);
        get_lp_supply(p)
    }

    /// Get effective liquidity (friend function) 
    public(friend) fun get_effective_liquidity_friend<X, Y>(owner: address): FixedPoint128 acquires Pool {
        let p = borrow_global<Pool<X, Y>>(owner);
        get_effective_liquidity(p)
    }

    /// Get expiration timestamp (friend function)
    public(friend) fun get_expiration_timestamp_friend<X, Y>(owner: address): u64 acquires Pool {
        let p = borrow_global<Pool<X, Y>>(owner);
        if (p.is_dynamic) {
            *option::borrow(&p.expiration_timestamp)
        } else {
            // Static pools don't expire, return far future
            18446744073709551615 // Max u64
        }
    }
    /// Get spot price on direct pool reference
    /// NOTE: Price cache is always initialized during pool creation with creator's initial_probability
    /// Price updates happen in swap functions using post-swap virtual reserves
    public(friend) fun get_spot_price_direct<X, Y>(pool: &mut Pool<X, Y>): FixedPoint128 {
        let cached = get_cached_price(pool);
        assert!(option::is_some(&cached), E_INVALID_POOL_PARAMS); // Should never be none after proper initialization
        *option::borrow(&cached)
    }

    /// Check if pool is dynamic (public function)
    public fun is_dynamic<X, Y>(pool: &Pool<X, Y>): bool {
        pool.is_dynamic
    }

    // ===== Publish / exists =====
    public fun publish_pool<X, Y>(owner: &signer, pool: Pool<X, Y>) { move_to(owner, pool) }
    public fun pool_exists<X, Y>(owner: address): bool { exists<Pool<X, Y>>(owner) }

    // ===================== SWAP EXECs (friend) =====================
    
    public(friend) fun exec_swap_x_to_y<X, Y>(
        owner: address, amount_in: u64, min_out: u64
    ): swap_engine::SwapResult acquires Pool {
        let p = borrow_global_mut<Pool<X, Y>>(owner);
        assert!(!is_expired(p), 603);

        // 1. Get pre-swap virtual reserves for pricing
        let (virtual_rx, virtual_ry) = get_virtual_reserves(p);
        let fee_rate = get_fee_rate(p);
        let eff_L = get_effective_liquidity(p);

        // 2. Calculate swap using virtual reserves
        let out = swap_math::exec_x_to_y(virtual_rx, virtual_ry, &eff_L, amount_in, fee_rate);
        assert!(swap_math::get_output_amount(&out) >= min_out, 602);

        // 3. Update actual reserves for token movements
        let (actual_rx, actual_ry) = get_reserves(p);
        let fee_amount = swap_math::get_fee_amount(&out);
        let output_amount = swap_math::get_output_amount(&out);
        let input_after_fee = amount_in - fee_amount;
        
        let new_actual_rx = actual_rx + input_after_fee;
        let new_actual_ry = actual_ry - output_amount;
        
        update_reserves(p, new_actual_rx, new_actual_ry, (amount_in as u128), 0);
        add_fees(p, fee_amount, 0);
        
        // 4. Calculate and cache new price using post-swap virtual reserves
        let virtual_rx_after = virtual_rx + input_after_fee;
        let virtual_ry_after = virtual_ry - output_amount;
        let new_price = swap_math::spot_price(virtual_rx_after, virtual_ry_after, &eff_L);
        update_price_cache(p, new_price);

        swap_engine::mk_result(
            amount_in,
            output_amount,
            fee_amount,
            new_actual_rx,
            new_actual_ry,
            swap_math::get_price_impact(&out),
        )
    }

    /// Y->X swap
    public(friend) fun exec_swap_y_to_x<X, Y>(
        owner: address, amount_in: u64, min_out: u64
    ): swap_engine::SwapResult acquires Pool {
        let p = borrow_global_mut<Pool<X, Y>>(owner);
        assert!(!is_expired(p), 603);

        // 1. Get pre-swap virtual reserves for pricing
        let (virtual_rx, virtual_ry) = get_virtual_reserves(p);
        let fee_rate = get_fee_rate(p);
        let eff_L = get_effective_liquidity(p);

        // 2. Calculate swap using virtual reserves
        let out = swap_math::exec_y_to_x(virtual_rx, virtual_ry, &eff_L, amount_in, fee_rate);
        assert!(swap_math::get_output_amount(&out) >= min_out, 602);

        // 3. Update actual reserves for token movements
        let (actual_rx, actual_ry) = get_reserves(p);
        let fee_amount = swap_math::get_fee_amount(&out);
        let output_amount = swap_math::get_output_amount(&out);
        let input_after_fee = amount_in - fee_amount;
        
        let new_actual_rx = actual_rx - output_amount;
        let new_actual_ry = actual_ry + input_after_fee;

        update_reserves(p, new_actual_rx, new_actual_ry, 0, (amount_in as u128));
        add_fees(p, 0, fee_amount);
        
        // 4. Calculate and cache new price using post-swap virtual reserves
        let virtual_rx_after = virtual_rx - output_amount;
        let virtual_ry_after = virtual_ry + input_after_fee;
        let new_price = swap_math::spot_price(virtual_rx_after, virtual_ry_after, &eff_L);
        update_price_cache(p, new_price);

        swap_engine::mk_result(
            amount_in,
            output_amount,
            fee_amount,
            new_actual_rx,
            new_actual_ry,
            swap_math::get_price_impact(&out),
        )
    }

    /// Quote without executing (same math as your original)
    public(friend) fun get_swap_quote_friend<X, Y>(
        owner: address, amount_in: u64, is_x_to_y: bool
    ): (u64, FixedPoint128) acquires Pool {
        let p = borrow_global<Pool<X, Y>>(owner);
        // Use virtual reserves for consistent quoting
        let (virtual_rx, virtual_ry) = get_virtual_reserves(p);
        let fee_rate = get_fee_rate(p);
        let eff_L = get_effective_liquidity(p);
        let q = swap_math::quote(virtual_rx, virtual_ry, &eff_L, amount_in, fee_rate, is_x_to_y);
        (swap_math::get_quote_output_amount(&q), swap_math::get_quote_price_impact(&q))
    }

    /// Spot with 1s cache 
    public(friend) fun get_spot_price_friend<X, Y>(owner: address): FixedPoint128 acquires Pool {
        let p = borrow_global_mut<Pool<X, Y>>(owner);
        let cached = get_cached_price(p);
        assert!(option::is_some(&cached), E_INVALID_POOL_PARAMS); 
        *option::borrow(&cached)
    }

        // ===================== LIQUIDITY EXECs (friend) =====================

    /// Add liquidity using PM-AMM math (maintains legacy interface for external callers)
    public(friend) fun exec_add_liquidity_friend<X, Y>(
        owner: address,
        desired_x: u64,
        desired_y: u64,
        _min_x: u64,
        _min_y: u64,
    ): liquidity_manager::LiquidityResult acquires Pool {
        let p = borrow_global_mut<Pool<X, Y>>(owner);

        assert!(!is_expired(p), LQ_E_POOL_EXPIRED);
        assert!(desired_x > 0 && desired_y > 0, LQ_E_ZERO_LIQUIDITY);

        let (reserve_x, reserve_y) = get_reserves(p);
        let lp_supply = get_lp_supply(p);
        let current_L = get_effective_liquidity(p);

        let (actual_x, actual_y, lp_tokens, new_effective_L) = if (lp_supply == 0) {
            let default_price = fixed_point::half(); 
            let total_value = calculate_implied_value_from_tokens(desired_x, desired_y, &default_price);
            let (required_x, required_y, lp_tokens, final_L) = 
                liquidity_math::add_initial_liquidity_pm_amm(&default_price, &total_value);
            
            // Update pool state for initial liquidity
            update_reserves(p, required_x, required_y, 0, 0);
            if (p.is_dynamic) {
                p.initial_L = option::some(final_L);
            } else {
                p.liquidity_parameter_L = final_L;
            };
            
            (required_x, required_y, lp_tokens, final_L)
        } else {
            // Additional liquidity: Use current market price and convert desired tokens to value
            let current_price = swap_math::spot_price(reserve_x, reserve_y, &current_L);
            let desired_value = calculate_implied_value_from_tokens(desired_x, desired_y, &current_price);
            let (required_x, required_y, new_x, new_y, lp_tokens, new_effective_L) =
                liquidity_math::add_liquidity_pm_amm(&desired_value, reserve_x, reserve_y, &current_L, lp_supply);
            
            // Update pool state for additional liquidity
            update_reserves(p, new_x, new_y, 0, 0);
            if (p.is_dynamic) {
                // Update base L₀ to achieve new effective L
                let now = timestamp::now_seconds();
                let expiration = *option::borrow(&p.expiration_timestamp);
                let total_duration = expiration - p.creation_timestamp;
                let time_remaining = expiration - now;
                let time_ratio = fixed_point::from_fraction(time_remaining, total_duration);
                let sqrt_ratio = fixed_point::sqrt(&time_ratio);
                let new_base_L = fixed_point::div(&new_effective_L, &sqrt_ratio);
                p.initial_L = option::some(new_base_L);
            } else {
                p.liquidity_parameter_L = new_effective_L;
            };
            
            (required_x, required_y, lp_tokens, new_effective_L)
        };

        mint_lp_tokens(p, lp_tokens);
        liquidity_manager::mk_liquidity_result(actual_x, actual_y, lp_tokens, new_effective_L)
    }

    /// Remove liquidity using PM-AMM math (maintains legacy interface for external callers)
    public(friend) fun exec_remove_liquidity_friend<X, Y>(
        owner: address,
        lp_tokens: u128,
        _min_x: u64,
        _min_y: u64,
    ): liquidity_manager::RemoveLiquidityResult acquires Pool {
        let p = borrow_global_mut<Pool<X, Y>>(owner);

        let lp_supply = get_lp_supply(p);
        assert!(lp_tokens > 0 && lp_tokens <= lp_supply, LQ_E_INVALID_LP_AMOUNT);

        let (reserve_x, reserve_y) = get_reserves(p);
        let current_L = get_effective_liquidity(p);

        // Use PM-AMM removal logic
        let (withdraw_x, withdraw_y, new_x, new_y, new_effective_L) =
            liquidity_math::remove_liquidity_pm_amm(lp_tokens, reserve_x, reserve_y, &current_L, lp_supply);

        // Update pool state
        update_reserves(p, new_x, new_y, 0, 0);
        burn_lp_tokens(p, lp_tokens);
        
        // Update liquidity parameter correctly for dynamic pools
        if (p.is_dynamic && !fixed_point::equal(&new_effective_L, &fixed_point::zero())) {
            let now = timestamp::now_seconds();
            let expiration = *option::borrow(&p.expiration_timestamp);
            let total_duration = expiration - p.creation_timestamp;
            let time_remaining = expiration - now;
            let time_ratio = fixed_point::from_fraction(time_remaining, total_duration);
            let sqrt_ratio = fixed_point::sqrt(&time_ratio);
            let new_base_L = fixed_point::div(&new_effective_L, &sqrt_ratio);
            p.initial_L = option::some(new_base_L);
        } else if (!p.is_dynamic) {
            p.liquidity_parameter_L = new_effective_L;
        };

        liquidity_manager::mk_remove_liquidity_result(withdraw_x, withdraw_y, lp_tokens, new_effective_L)
    }

    /// Remove liquidity and swap the other leg to single asset (identical flow)
    /// - removal first (updates reserves),
    /// - then perform swap on the post-removal reserves,
    /// - final assert on min_output with E_INSUFFICIENT_LIQUIDITY (700), as in your code.
    public(friend) fun exec_remove_liquidity_single_asset_friend<X, Y>(
        owner: address,
        lp_tokens: u128,
        prefer_x: bool,
        min_output: u64,
    ): u64 acquires Pool {
        let p = borrow_global_mut<Pool<X, Y>>(owner);

        // 1) remove proportionally (this updates reserves & burns LP)
        let lp_supply = get_lp_supply(p);
        assert!(lp_tokens > 0 && lp_tokens <= lp_supply, LQ_E_INVALID_LP_AMOUNT);

        let (reserve_x, reserve_y) = get_reserves(p);
        let current_L = get_effective_liquidity(p);

        // Use PM-AMM removal logic
        let (amount_x, amount_y, new_x, new_y, new_effective_L) =
            liquidity_math::remove_liquidity_pm_amm(lp_tokens, reserve_x, reserve_y, &current_L, lp_supply);

        update_reserves(p, new_x, new_y, 0, 0);
        burn_lp_tokens(p, lp_tokens);
        
        // CRITICAL: Update L parameter after liquidity removal
        if (p.is_dynamic && !fixed_point::equal(&new_effective_L, &fixed_point::zero())) {
            let now = timestamp::now_seconds();
            let expiration = *option::borrow(&p.expiration_timestamp);
            let total_duration = expiration - p.creation_timestamp;
            let time_remaining = expiration - now;
            let time_ratio = fixed_point::from_fraction(time_remaining, total_duration);
            let sqrt_ratio = fixed_point::sqrt(&time_ratio);
            let new_base_L = fixed_point::div(&new_effective_L, &sqrt_ratio);
            p.initial_L = option::some(new_base_L);
        } else if (!p.is_dynamic) {
            p.liquidity_parameter_L = new_effective_L;
        };

        // 2) swap the other leg on updated reserves (no slippage guard here; matches your 0-min swap)
        let fee_rate = get_fee_rate(p);
        let eff_L_2 = get_effective_liquidity(p);

        if (prefer_x) {
            // swap Y->X using post-removal reserves
            let out = swap_math::exec_y_to_x(new_x, new_y, &eff_L_2, amount_y, fee_rate);
            // apply state from the swap
            update_reserves(p, swap_math::get_new_reserve_x(&out), swap_math::get_new_reserve_y(&out), 0, (amount_y as u128));
            add_fees(p, 0, swap_math::get_fee_amount(&out));

            let total_x = amount_x + swap_math::get_output_amount(&out);
            assert!(total_x >= min_output, LQ_E_INSUFFICIENT_LIQUIDITY);
            total_x
        } else {
            // prefer Y: swap X->Y
            let out = swap_math::exec_x_to_y(new_x, new_y, &eff_L_2, amount_x, fee_rate);
            update_reserves(p, swap_math::get_new_reserve_x(&out), swap_math::get_new_reserve_y(&out), (amount_x as u128), 0);
            add_fees(p, swap_math::get_fee_amount(&out), 0);

            let total_y = amount_y + swap_math::get_output_amount(&out);
            assert!(total_y >= min_output, LQ_E_INSUFFICIENT_LIQUIDITY);
            total_y
        }
        
    }

    // ===== Direct Pool Reference Functions (for prediction market) =====
    
    /// Execute X->Y swap on direct pool reference
    public(friend) fun swap_x_to_y_direct<X, Y>(
        pool: &mut Pool<X, Y>, amount_in: u64, min_out: u64
    ): swap_engine::SwapResult {
        assert!(!is_expired(pool), 603);
        
        // 1. Get pre-swap virtual reserves for pricing
        let (virtual_rx, virtual_ry) = get_virtual_reserves(pool);
        let fee_rate = get_fee_rate(pool);
        let eff_L = get_effective_liquidity(pool);
        
        // 2. Calculate swap using virtual reserves
        let out = swap_math::exec_x_to_y(virtual_rx, virtual_ry, &eff_L, amount_in, fee_rate);
        assert!(swap_math::get_output_amount(&out) >= min_out, 602);
        
        // 3. Update actual reserves for token movements
        let (actual_rx, actual_ry) = get_reserves(pool);
        let fee_amount = swap_math::get_fee_amount(&out);
        let output_amount = swap_math::get_output_amount(&out);
        let input_after_fee = amount_in - fee_amount;
        
        let new_actual_rx = actual_rx + input_after_fee;
        let new_actual_ry = actual_ry - output_amount;
        
        update_reserves(pool, new_actual_rx, new_actual_ry, (amount_in as u128), 0);
        add_fees(pool, fee_amount, 0);
        
        // 4. Calculate and cache new price using post-swap virtual reserves
        let virtual_rx_after = virtual_rx + input_after_fee;
        let virtual_ry_after = virtual_ry - output_amount;
        let new_price = swap_math::spot_price(virtual_rx_after, virtual_ry_after, &eff_L);
        update_price_cache(pool, new_price);
        
        swap_engine::mk_result(
            amount_in, output_amount, fee_amount,
            new_actual_rx, new_actual_ry, swap_math::get_price_impact(&out)
        )
    }

    /// Execute Y->X swap on direct pool reference
    public(friend) fun swap_y_to_x_direct<X, Y>(
        pool: &mut Pool<X, Y>, amount_in: u64, min_out: u64
    ): swap_engine::SwapResult {
        assert!(!is_expired(pool), 603);
        
        // 1. Get pre-swap virtual reserves for pricing
        let (virtual_rx, virtual_ry) = get_virtual_reserves(pool);
        let fee_rate = get_fee_rate(pool);
        let eff_L = get_effective_liquidity(pool);
        
        // 2. Calculate swap using virtual reserves
        let out = swap_math::exec_y_to_x(virtual_rx, virtual_ry, &eff_L, amount_in, fee_rate);
        assert!(swap_math::get_output_amount(&out) >= min_out, 602);
        
        // 3. Update actual reserves for token movements
        let (actual_rx, actual_ry) = get_reserves(pool);
        let fee_amount = swap_math::get_fee_amount(&out);
        let output_amount = swap_math::get_output_amount(&out);
        let input_after_fee = amount_in - fee_amount;
        
        let new_actual_rx = actual_rx - output_amount;
        let new_actual_ry = actual_ry + input_after_fee;
        
        update_reserves(pool, new_actual_rx, new_actual_ry, 0, (amount_in as u128));
        add_fees(pool, 0, fee_amount);
        
        // 4. Calculate and cache new price using post-swap virtual reserves
        let virtual_rx_after = virtual_rx - output_amount;
        let virtual_ry_after = virtual_ry + input_after_fee;
        let new_price = swap_math::spot_price(virtual_rx_after, virtual_ry_after, &eff_L);
        update_price_cache(pool, new_price);
        
        swap_engine::mk_result(
            amount_in, output_amount, fee_amount,
            new_actual_rx, new_actual_ry, swap_math::get_price_impact(&out)
        )
    }

    // ===================== LIQUIDITY (DIRECT, for prediction_market) =====================

    /// Preview liquidity addition using PM-AMM logic
    /// For initial liquidity: uses target_price and desired_value_increase
    /// For additional liquidity: uses current price and desired_value_increase
    public(friend) fun preview_add_liquidity_direct<X, Y>(
        pool: &Pool<X, Y>,
        desired_value_increase: &FixedPoint128,
        target_price: &FixedPoint128
    ): AddLiqOutcome {
        let (rx, ry) = get_reserves(pool);
        let lp_supply = get_lp_supply(pool);
        let current_L = get_effective_liquidity(pool);

        if (lp_supply == 0) {
            // Initial liquidity: use provided target_price
            let (ax, ay, minted, final_L) = liquidity_math::add_initial_liquidity_pm_amm(
                target_price, 
                desired_value_increase
            );
            AddLiqOutcome {
                actual_x: ax, actual_y: ay, minted_lp: minted,
                new_reserve_x: ax, new_reserve_y: ay, new_L: final_L
            }
        } else {
            // Additional liquidity: use current market price (ignore target_price)
            let (required_x, required_y, nx, ny, minted, newL) =
                liquidity_math::add_liquidity_pm_amm(desired_value_increase, rx, ry, &current_L, lp_supply);
            AddLiqOutcome {
                actual_x: required_x, actual_y: required_y, minted_lp: minted,
                new_reserve_x: nx, new_reserve_y: ny, new_L: newL
            }
        }
    }

    /// Add liquidity using PM-AMM logic - maintains optimal reserves for current price
    /// CRITICAL: This preserves the dynamic L = L₀√(T-t) relationship
    /// For initial liquidity: uses target_price, for additional: uses current price
    public(friend) fun add_liquidity_direct<X,Y>(
        pool: &mut Pool<X,Y>,
        desired_value_increase: &FixedPoint128,
        target_price: &FixedPoint128
    ): AddLiqOutcome {
        assert!(!is_expired(pool), LQ_E_POOL_EXPIRED);

        let (rx, ry) = get_reserves(pool);
        let lp_supply = get_lp_supply(pool);
        let current_effective_L = get_effective_liquidity(pool);

        if (lp_supply == 0) {
            // Initial liquidity: use provided target_price
            let (ax, ay, minted, final_L) = liquidity_math::add_initial_liquidity_pm_amm(
                target_price,
                desired_value_increase
            );
            update_reserves(pool, ax, ay, 0, 0);
            
            // For initial liquidity, set the base L parameter
            if (pool.is_dynamic) {
                pool.initial_L = option::some(final_L);
            } else {
                pool.liquidity_parameter_L = final_L;
            };
            
            mint_lp_tokens(pool, minted);
            AddLiqOutcome {
                actual_x: ax, actual_y: ay, minted_lp: minted,
                new_reserve_x: ax, new_reserve_y: ay, new_L: final_L
            }
        } else {
            let (required_x, required_y, nx, ny, minted, new_effective_L) =
                liquidity_math::add_liquidity_pm_amm(desired_value_increase, rx, ry, &current_effective_L, lp_supply);
            
            update_reserves(pool, nx, ny, 0, 0);
            
            // CRITICAL: For dynamic pools, we need to update L₀, not effective L
            if (pool.is_dynamic) {
                // Calculate what the new L₀ should be to achieve new_effective_L at current time
                let now = timestamp::now_seconds();
                let expiration = *option::borrow(&pool.expiration_timestamp);
                let total_duration = expiration - pool.creation_timestamp;
                let time_remaining = expiration - now;
                let time_ratio = fixed_point::from_fraction(time_remaining, total_duration);
                let sqrt_ratio = fixed_point::sqrt(&time_ratio);
                let new_base_L = fixed_point::div(&new_effective_L, &sqrt_ratio);
                pool.initial_L = option::some(new_base_L);
            } else {
                pool.liquidity_parameter_L = new_effective_L;
            };
            
            mint_lp_tokens(pool, minted);
            AddLiqOutcome {
                actual_x: required_x, actual_y: required_y, minted_lp: minted,
                new_reserve_x: nx, new_reserve_y: ny, new_L: new_effective_L
            }
        }
    }

    /// Remove liquidity using PM-AMM logic - maintains optimal reserves for current price
    public(friend) fun remove_liquidity_proportional_direct<X,Y>(
        pool: &mut Pool<X,Y>,
        lp_to_burn: u128
    ): (u64, u64) {
        assert!(!is_expired(pool), LQ_E_POOL_EXPIRED);
        let (rx, ry) = get_reserves(pool);
        let lp_supply = get_lp_supply(pool);
        let current_effective_L = get_effective_liquidity(pool);

        let (withdraw_x, withdraw_y, nx, ny, new_effective_L) =
            liquidity_math::remove_liquidity_pm_amm(lp_to_burn, rx, ry, &current_effective_L, lp_supply);
        
        burn_lp_tokens(pool, lp_to_burn);
        update_reserves(pool, nx, ny, 0, 0);
        
        // Update liquidity parameter correctly for dynamic pools
        if (pool.is_dynamic && !fixed_point::equal(&new_effective_L, &fixed_point::zero())) {
            let now = timestamp::now_seconds();
            let expiration = *option::borrow(&pool.expiration_timestamp);
            let total_duration = expiration - pool.creation_timestamp;
            let time_remaining = expiration - now;
            let time_ratio = fixed_point::from_fraction(time_remaining, total_duration);
            let sqrt_ratio = fixed_point::sqrt(&time_ratio);
            let new_base_L = fixed_point::div(&new_effective_L, &sqrt_ratio);
            pool.initial_L = option::some(new_base_L);
        } else if (!pool.is_dynamic) {
            pool.liquidity_parameter_L = new_effective_L;
        };
        
        (withdraw_x, withdraw_y)
    }

    // ===== optional view helper mirroring your old API =====
    public(friend) fun calculate_lp_value_friend<X, Y>(
        owner: address, lp_tokens: u128
    ): u64 acquires Pool {
        let p = borrow_global<Pool<X, Y>>(owner);
        let (rx, ry) = get_reserves(p);
        let supply = get_lp_supply(p);
        let effective_L = get_effective_liquidity(p); // ✅ Use effective L for dynamic pools
        let lp_value = liquidity_math::calculate_lp_value_pm_amm(lp_tokens, supply, rx, ry, &effective_L);
        fixed_point::to_u64(&lp_value)
    }

    // ===== Pre-Trading Liquidity Functions =====
    
    /// Add liquidity before trading starts (maintains constant price)
    /// Only allowed on dynamic pools before market activation
    public(friend) fun add_pretrade_liquidity<X, Y>(
        pool: &mut Pool<X, Y>,
        lp_value_contribution: &FixedPoint128,
        is_market_active: bool
    ): AddLiqOutcome {
        // Only allow before trading starts
        assert!(!is_market_active, LQ_E_MARKET_ALREADY_ACTIVE);
        assert!(pool.is_dynamic, LQ_E_NOT_DYNAMIC_POOL);
        
        let (reserve_x, reserve_y) = get_reserves(pool);
        let lp_supply = get_lp_supply(pool);
        let current_base_L0 = *option::borrow(&pool.initial_L);
        
        // Get current price (should be same as initial)
        let current_price = swap_math::spot_price(reserve_x, reserve_y, &current_base_L0);
        
        // Calculate current pool value: V = L × φ(Φ⁻¹(P))
        let current_pool_value = liquidity_math::calculate_current_pool_value(
            reserve_x, reserve_y, &current_base_L0
        );
        
        // Calculate new total value
        let new_total_value = fixed_point::add(&current_pool_value, lp_value_contribution);
        
        // Calculate new L₀ to achieve new value at SAME price: L_new = V_new / φ(Φ⁻¹(P))
        let new_base_L0 = invariant_amm::calculate_liquidity_from_pool_value(
            &current_price, &new_total_value
        );
        
        // Calculate new optimal reserves at this price with new L
        let (new_reserve_x, new_reserve_y) = invariant_amm::calculate_optimal_reserves(
            &current_price, &new_base_L0
        );
        
        // Required additional tokens
        let required_x = new_reserve_x - reserve_x;
        let required_y = new_reserve_y - reserve_y;
        
        // LP tokens proportional to value contribution
        let lp_ratio = fixed_point::div(lp_value_contribution, &current_pool_value);
        let new_lp_tokens = fixed_point::mul(&lp_ratio, &fixed_point::from_u128(lp_supply));
        let lp_tokens = fixed_point::to_u128(&new_lp_tokens);
        
        // Update pool state - CRITICAL: Only update base L₀, not effective L
        pool.initial_L = option::some(new_base_L0);
        update_reserves(pool, new_reserve_x, new_reserve_y, 0, 0);
        mint_lp_tokens(pool, lp_tokens);
        
        AddLiqOutcome {
            actual_x: required_x,
            actual_y: required_y,
            minted_lp: lp_tokens,
            new_reserve_x,
            new_reserve_y,
            new_L: new_base_L0
        }
    }

}