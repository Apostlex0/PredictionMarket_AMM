module pm_amm::swap_math {
    use pm_amm::fixed_point::{Self, FixedPoint128};
    use pm_amm::invariant_amm;

    // keep parity with original swap_engine codes for internal guards
    const E_INSUFFICIENT_OUTPUT: u64 = 601;
    const E_ZERO_AMOUNT: u64 = 605;

    public struct Quote has copy, drop {
        output_amount: u64,
        price_impact: FixedPoint128,
    }

    public struct Outcome has copy, drop {
        fee_amount: u64,
        output_amount: u64,
        new_reserve_x: u64,
        new_reserve_y: u64,
        price_impact: FixedPoint128,
        input_after_fee: u64,
    }

    inline fun calculate_fee(amount: u64, fee_rate: u16): u64 {
        ((amount as u128) * (fee_rate as u128) / 10000) as u64
    }
}