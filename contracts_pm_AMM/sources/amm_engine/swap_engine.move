module pm_amm::swap_engine {
    use pm_amm::fixed_point::{Self, FixedPoint128};

    
    const E_INSUFFICIENT_INPUT: u64 = 600;
    const E_INSUFFICIENT_OUTPUT: u64 = 601;
    const E_EXCESSIVE_SLIPPAGE: u64 = 602;
    const E_POOL_EXPIRED: u64 = 603;
    const E_INVALID_SWAP_DIRECTION: u64 = 604;
    const E_ZERO_AMOUNT: u64 = 605;

    

    struct SwapResult has copy, drop {
        input_amount: u64,
        output_amount: u64,
        fee_amount: u64,
        new_reserve_x: u64,
        new_reserve_y: u64,
        price_impact: FixedPoint128,
    }

    // friend-only constructor so pool_state can return the same struct
    public(friend) fun mk_result(
        input_amount: u64,
        output_amount: u64,
        fee_amount: u64,
        new_reserve_x: u64,
        new_reserve_y: u64,
        price_impact: FixedPoint128,
    ): SwapResult {
        SwapResult {
            input_amount, output_amount, fee_amount,
            new_reserve_x, new_reserve_y, price_impact
        }
    }
}    