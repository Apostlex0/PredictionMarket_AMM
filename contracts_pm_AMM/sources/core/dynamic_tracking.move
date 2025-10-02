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
}