module pm_amm::dynamic_tracking {
    use std::table::{Self, Table};
    use aptos_framework::timestamp;
    use pm_amm::fixed_point::{Self, FixedPoint128};
    use pm_amm::pool_state;
    use pm_amm::invariant_amm;

    /// Simple dynamic pool withdrawal tracking
    struct DynamicPoolState has key, store {
        // Initial total value when trading started
        initial_pool_value: FixedPoint128,
        
        // When trading actually started (L decay begins)
        trading_start_timestamp: u64,
        
        // Cumulative value withdrawn by each LP (in dollar terms)
        cumulative_withdrawals: Table<address, FixedPoint128>,
        
        // Last withdrawal timestamp for each LP
        last_withdrawal_timestamp: Table<address, u64>,
        
        // Total cumulative withdrawals from pool
        total_cumulative_withdrawals: FixedPoint128,
    }

    /// Initialize dynamic tracking when trading starts
    public fun initialize_dynamic_tracking(
        account: &signer,
        initial_pool_value: FixedPoint128
    ) {
        let tracking = DynamicPoolState {
            initial_pool_value,
            trading_start_timestamp: timestamp::now_seconds(),
            cumulative_withdrawals: table::new(),
            last_withdrawal_timestamp: table::new(),
            total_cumulative_withdrawals: fixed_point::zero(),
        };
        move_to(account, tracking);
    }

    /// Calculate pending withdrawal for an LP based on paper's formula
    /// dC/dt = (V_t × LP_share) / (2(T-t)) × dt
    /// Uses current pool value V_t = L_t × φ(Φ⁻¹(P)) where L_t = L_0√(T-t)
    public fun calculate_pending_withdrawal<X, Y>(
        pool_address: address,
        lp_address: address,
        lp_tokens: u128
    ): FixedPoint128 acquires DynamicPoolState {
        let tracking = borrow_global<DynamicPoolState>(pool_address);
        let now = timestamp::now_seconds();
        
        // Get last withdrawal time for this LP
        let last_update = if (table::contains(&tracking.last_withdrawal_timestamp, lp_address)) {
            *table::borrow(&tracking.last_withdrawal_timestamp, lp_address)
        } else {
            tracking.trading_start_timestamp
        };
        
        if (now <= last_update) {
            return fixed_point::zero()
        };
        
        // Get pool info using friend functions
        let lp_supply = pool_state::get_lp_supply_friend<X, Y>(pool_address);
        let expiration = pool_state::get_expiration_timestamp_friend<X, Y>(pool_address);
        
        // CRITICAL: Check time remaining to avoid division by zero
        let time_remaining = expiration - now;
        if (time_remaining == 0) {
            return fixed_point::zero()
        };
        
        // LP's share of total supply
        let lp_share = fixed_point::from_fraction((lp_tokens as u64), (lp_supply as u64));
        
        // Get current effective liquidity L_t (implements L_0√(T-t) decay)
        let current_L = pool_state::get_effective_liquidity_friend<X, Y>(pool_address);
        
        // Get current price from cache (not swap_math spot price)
        let current_price = pool_state::get_spot_price_friend<X, Y>(pool_address);
        
        // Calculate current pool value: V_t = L_t × φ(Φ⁻¹(P))
        let current_pool_value = invariant_amm::calculate_pool_value(&current_price, &current_L);
        
        // Calculate withdrawal using correct paper formula
        // dC/dt = (V_t × LP_share) / (2(T-t))
        let time_elapsed = now - last_update;
        
        let withdrawal_rate = fixed_point::div(
            &fixed_point::mul(&current_pool_value, &lp_share),
            &fixed_point::from_u64(2 * time_remaining)  // ✅ TIME-DEPENDENT DENOMINATOR
        );
        
        fixed_point::mul(&withdrawal_rate, &fixed_point::from_u64(time_elapsed))
    }
}