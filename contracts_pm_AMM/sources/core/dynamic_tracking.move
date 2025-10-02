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
        
        // Check time remaining to avoid division by zero
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
            &fixed_point::from_u64(2 * time_remaining) 
        );
        
        fixed_point::mul(&withdrawal_rate, &fixed_point::from_u64(time_elapsed))
    }

    /// Process automatic withdrawal for an LP
    /// Returns (x_tokens, y_tokens, dollar_value) to withdraw
    public fun process_automatic_withdrawal<X, Y>(
        pool_address: address,
        lp_address: address,
        lp_tokens: u128
    ): (u64, u64, FixedPoint128) acquires DynamicPoolState {
        let pending = calculate_pending_withdrawal<X, Y>(pool_address, lp_address, lp_tokens);
        
        if (fixed_point::equal(&pending, &fixed_point::zero())) {
            return (0, 0, fixed_point::zero())
        };
        
        // Get current price from cache
        let current_price = pool_state::get_spot_price_friend<X, Y>(pool_address);
        
        // Convert dollar value to liquidity, then to optimal reserves
        // This maintains the PM-AMM invariant: x² + y² = L² × φ(Φ⁻¹(P))²
        
        // Step 1: Calculate liquidity reduction needed for the pending dollar value
        // From paper: V(P) = L × φ(Φ⁻¹(P)), so L = V(P) / φ(Φ⁻¹(P))
        let liquidity_to_withdraw = invariant_amm::calculate_liquidity_from_pool_value(
            &current_price, 
            &pending
        );
        
        // Step 2: Calculate optimal token amounts maintaining PM-AMM invariant
        // From paper: x*(P) = L × Φ(Φ⁻¹(P) + σ/2), y*(P) = L × Φ(Φ⁻¹(P) - σ/2)
        let (x_withdraw, y_withdraw) = invariant_amm::calculate_optimal_reserves(
            &current_price, 
            &liquidity_to_withdraw
        );
        
        // Update tracking
        let tracking = borrow_global_mut<DynamicPoolState>(pool_address);
        
        // Update LP's cumulative withdrawals
        if (!table::contains(&tracking.cumulative_withdrawals, lp_address)) {
            table::add(&mut tracking.cumulative_withdrawals, lp_address, fixed_point::zero());
        };
        let existing = table::borrow_mut(&mut tracking.cumulative_withdrawals, lp_address);
        *existing = fixed_point::add(existing, &pending);
        
        // Update LP's last withdrawal timestamp
        if (!table::contains(&tracking.last_withdrawal_timestamp, lp_address)) {
            table::add(&mut tracking.last_withdrawal_timestamp, lp_address, timestamp::now_seconds());
        } else {
            *table::borrow_mut(&mut tracking.last_withdrawal_timestamp, lp_address) = timestamp::now_seconds();
        };
        
        // Update total withdrawals
        tracking.total_cumulative_withdrawals = fixed_point::add(
            &tracking.total_cumulative_withdrawals,
            &pending
        );
        
        (x_withdraw, y_withdraw, pending)
    }

    /// Calculate LP's total wealth: W_t = V_t + C_t
    /// This is what the LP can recover (pool value + withdrawals)
    public fun calculate_lp_total_wealth<X, Y>(
        pool_address: address,
        lp_address: address,
        lp_tokens: u128
    ): FixedPoint128 acquires DynamicPoolState {
        // Current pool value share using consistent approach
        let lp_supply = pool_state::get_lp_supply_friend<X, Y>(pool_address);
        let current_L = pool_state::get_effective_liquidity_friend<X, Y>(pool_address);
        let current_price = pool_state::get_spot_price_friend<X, Y>(pool_address);
        
        // Calculate current total pool value: V_t = L_t × φ(Φ⁻¹(P))
        let current_pool_value = invariant_amm::calculate_pool_value(&current_price, &current_L);
        
        // LP's share of current pool value
        let lp_share = fixed_point::from_fraction((lp_tokens as u64), (lp_supply as u64));
        let pool_value_share = fixed_point::mul(&current_pool_value, &lp_share);
        
        // Plus cumulative withdrawals
        let tracking = borrow_global<DynamicPoolState>(pool_address);
        let cumulative = if (table::contains(&tracking.cumulative_withdrawals, lp_address)) {
            *table::borrow(&tracking.cumulative_withdrawals, lp_address)
        } else {
            fixed_point::zero()
        };
        
        // Plus pending withdrawals
        let pending = calculate_pending_withdrawal<X, Y>(pool_address, lp_address, lp_tokens);
        
        fixed_point::add(&fixed_point::add(&pool_value_share, &cumulative), &pending)
    }

    /// Calculate what happens at expiration
    /// Returns (withdrawn_during_lifetime, settlement_from_winning_tokens, total_loss)
    public fun calculate_expiration_settlement<X, Y>(
        pool_address: address,
        lp_address: address,
        lp_tokens: u128,
        outcome_x_wins: bool
    ): (FixedPoint128, FixedPoint128, FixedPoint128) acquires DynamicPoolState {
        let tracking = borrow_global<DynamicPoolState>(pool_address);
        let initial_pool_value = tracking.initial_pool_value;

        let lp_supply = pool_state::get_lp_supply_friend<X, Y>(pool_address);
        
        // LP's share of total supply
        let lp_share = fixed_point::from_fraction((lp_tokens as u64), (lp_supply as u64));
        
        // 1. Total withdrawn during lifetime (including final pending)
        let cumulative = if (table::contains(&tracking.cumulative_withdrawals, lp_address)) {
            *table::borrow(&tracking.cumulative_withdrawals, lp_address)
        } else {
            fixed_point::zero()
        };
        let pending = calculate_pending_withdrawal<X, Y>(pool_address, lp_address, lp_tokens);
        let total_withdrawn = fixed_point::add(&cumulative, &pending);
        
        // 2. Settlement from winning tokens
        let (reserve_x, reserve_y) = pool_state::get_pool_reserves_friend<X, Y>(pool_address);
        let winning_tokens = if (outcome_x_wins) { reserve_x } else { reserve_y };
        let settlement = fixed_point::mul(
            &lp_share,
            &fixed_point::from_u64(winning_tokens)
        );
        
        // 3. Calculate loss
        let initial_contribution = fixed_point::mul(&lp_share, &initial_pool_value);
        let total_recovered = fixed_point::add(&total_withdrawn, &settlement);
        let total_loss = fixed_point::sub(&initial_contribution, &total_recovered);
        
        (total_withdrawn, settlement, total_loss)
    }

    // ===== View Functions =====
    
    public fun get_cumulative_withdrawals(pool_address: address, lp_address: address): FixedPoint128 acquires DynamicPoolState {
        let tracking = borrow_global<DynamicPoolState>(pool_address);
        if (table::contains(&tracking.cumulative_withdrawals, lp_address)) {
            *table::borrow(&tracking.cumulative_withdrawals, lp_address)
        } else {
            fixed_point::zero()
        }
    }
    
    public fun get_initial_pool_value(pool_address: address): FixedPoint128 acquires DynamicPoolState {
        let tracking = borrow_global<DynamicPoolState>(pool_address);
        tracking.initial_pool_value
    }
    
    /// Check if dynamic tracking exists for a pool
    public fun tracking_exists(pool_address: address): bool {
        exists<DynamicPoolState>(pool_address)
    }
}