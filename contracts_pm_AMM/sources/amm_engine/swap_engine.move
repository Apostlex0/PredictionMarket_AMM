module pm_amm::swap_engine {
    use pm_amm::fixed_point::{Self, FixedPoint128};

    const E_INSUFFICIENT_INPUT: u64 = 600;
    const E_INSUFFICIENT_OUTPUT: u64 = 601;
    const E_EXCESSIVE_SLIPPAGE: u64 = 602;
    const E_POOL_EXPIRED: u64 = 603;
    const E_INVALID_SWAP_DIRECTION: u64 = 604;
    const E_ZERO_AMOUNT: u64 = 605;

    friend pm_amm::pool_state;

    struct SwapResult has copy, drop {
        input_amount: u64,
        output_amount: u64,
        fee_amount: u64,
        new_reserve_x: u64,
        new_reserve_y: u64,
        price_impact: FixedPoint128,
    }

    // friend-only constructor
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

    public fun output_amount(res: &SwapResult): u64 { res.output_amount }
    public fun input_amount(res: &SwapResult): u64 { res.input_amount }
    public fun fee_amount(res: &SwapResult): u64 { res.fee_amount }
    public fun new_reserve_x(res: &SwapResult): u64 { res.new_reserve_x }
    public fun new_reserve_y(res: &SwapResult): u64 { res.new_reserve_y }
    public fun price_impact(res: &SwapResult): FixedPoint128 { res.price_impact }
}