module pm_amm::swap_math {
    use pm_amm::fixed_point::{Self, FixedPoint128};
    use pm_amm::invariant_amm;

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

    public fun quote(
        reserve_x: u64,
        reserve_y: u64,
        eff_L: &FixedPoint128,
        input_amount: u64,
        fee_rate: u16,
        is_x_to_y: bool,
    ): Quote {
        let fee_amount = calculate_fee(input_amount, fee_rate);
        let input_after_fee = input_amount - fee_amount;

        // invariant usage identical to your original:
        let output_amount = invariant_amm::calculate_swap_output(
            reserve_x, reserve_y, eff_L, input_after_fee, is_x_to_y
        );
        let price_impact = invariant_amm::calculate_price_impact(
            reserve_x, reserve_y, eff_L, input_after_fee, is_x_to_y
        );

        Quote { output_amount, price_impact }
    }

    ///  execution for X->Y 
    public fun exec_x_to_y(
        reserve_x: u64,
        reserve_y: u64,
        eff_L: &FixedPoint128,
        input_amount: u64,
        fee_rate: u16,
    ): Outcome {
        assert!(input_amount > 0, E_ZERO_AMOUNT);

        let q = quote(reserve_x, reserve_y, eff_L, input_amount, fee_rate, /*is_x_to_y=*/ true);
        // original insufficient-output guard
        assert!(q.output_amount < reserve_y, E_INSUFFICIENT_OUTPUT);

        let fee_amount = calculate_fee(input_amount, fee_rate);
        let input_after_fee = input_amount - fee_amount;

        let new_reserve_x = reserve_x + input_after_fee;
        let new_reserve_y = reserve_y - q.output_amount;

        Outcome {
            fee_amount,
            output_amount: q.output_amount,
            new_reserve_x,
            new_reserve_y,
            price_impact: q.price_impact,
            input_after_fee,
        }
    }

    ///  execution for Y->X 
    public fun exec_y_to_x(
        reserve_x: u64,
        reserve_y: u64,
        eff_L: &FixedPoint128,
        input_amount: u64,
        fee_rate: u16,
    ): Outcome {
        assert!(input_amount > 0, E_ZERO_AMOUNT);

        let q = quote(reserve_x, reserve_y, eff_L, input_amount, fee_rate, /*is_x_to_y=*/ false);
        // original insufficient-output guard
        assert!(q.output_amount < reserve_x, E_INSUFFICIENT_OUTPUT);

        let fee_amount = calculate_fee(input_amount, fee_rate);
        let input_after_fee = input_amount - fee_amount;

        let new_reserve_x = reserve_x - q.output_amount;
        let new_reserve_y = reserve_y + input_after_fee;

        Outcome {
            fee_amount,
            output_amount: q.output_amount,
            new_reserve_x,
            new_reserve_y,
            price_impact: q.price_impact,
            input_after_fee,
        }
    }

    /// pure marginal price 
    public fun spot_price(
        reserve_x: u64,
        reserve_y: u64,
        eff_L: &FixedPoint128,
    ): FixedPoint128 {
        invariant_amm::calculate_marginal_price(reserve_x, reserve_y, eff_L)
    }

    /// pure helper matching binary-search behavior from swap_engine
    public fun calculate_input_for_exact_output(
        reserve_x: u64,
        reserve_y: u64,
        eff_L: &FixedPoint128,
        fee_rate: u16,
        exact_output: u64,
        is_x_to_y: bool,
    ): u64 {
        let low = 1u64;
        let high = if (is_x_to_y) { reserve_x * 10 } else { reserve_y * 10 };
        let result = 0u64;

        let l = low; let h = high; let r = result;
        let lo = l; let hi = h; let res = r;

        while (lo <= hi) {
            let mid = (lo + hi) / 2;
            let fee_amount = calculate_fee(mid, fee_rate);
            let input_after_fee = mid - fee_amount;

            let output = invariant_amm::calculate_swap_output(
                reserve_x, reserve_y, eff_L, input_after_fee, is_x_to_y
            );

            if (output == exact_output) { return mid }
            else if (output < exact_output) { res = mid; lo = mid + 1; }
            else { hi = mid - 1; }
        };

        res + 1
    }

     // ===== Quote Accessors =====
    public fun get_quote_output_amount(quote: &Quote): u64 { quote.output_amount }
    public fun get_quote_price_impact(quote: &Quote): FixedPoint128 { quote.price_impact }

    // ===== Outcome Accessors =====
    public fun get_fee_amount(outcome: &Outcome): u64 { outcome.fee_amount }
    public fun get_output_amount(outcome: &Outcome): u64 { outcome.output_amount }
    public fun get_new_reserve_x(outcome: &Outcome): u64 { outcome.new_reserve_x }
    public fun get_new_reserve_y(outcome: &Outcome): u64 { outcome.new_reserve_y }
    public fun get_price_impact(outcome: &Outcome): FixedPoint128 { outcome.price_impact }
    public fun get_input_after_fee(outcome: &Outcome): u64 { outcome.input_after_fee }
}
