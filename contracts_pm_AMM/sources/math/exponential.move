module pm_amm::exponential {
    use pm_amm::fixed_point::{Self, FixedPoint128};
    use std::error;

    // ===== Constants =====
    const E: u128 = 50143449209799256682;        // e
    const PI: u128 = 57952155664616982739;       // π
    const TWO_PI: u128 = 115904311329233965478;  // 2π
    const SQRT_TWO_PI: u128 = 46199664534094293570;
    const LN_2: u128 = 12786308645202145923;     // ln(2)

    // Error codes
    const E_LN_NEGATIVE: u64 = 100;
    const E_EXP_OVERFLOW: u64 = 101;
    const E_OUT_OF_DOMAIN: u64 = 102;

    // ===== Exponential (series) =====
    /// NOTE: No special handling for negative exponents here; callers may use 1/exp(|x|).
    public fun exp(x: &FixedPoint128): FixedPoint128 {
        let x_raw = fixed_point::raw_value(x);
        if (x_raw == 0u128) { return fixed_point::one() };

        let twenty = fixed_point::from_u64(20);
        assert!(fixed_point::less_than(x, &twenty), error::invalid_argument(E_EXP_OVERFLOW));

        let result = fixed_point::one();
        let term = fixed_point::one();
        let i = 1u64;
        let max_iterations = 20u64;

        let result_mut = result;
        let term_mut = term;
        let i_mut = i;

        while (i_mut <= max_iterations) {
            term_mut = fixed_point::mul(&term_mut, x);
            term_mut = fixed_point::div(&term_mut, &fixed_point::from_u64(i_mut));
            let old_result = result_mut;
            result_mut = fixed_point::add(&result_mut, &term_mut);
            if (fixed_point::equal(&result_mut, &old_result)) { break };
            i_mut = i_mut + 1u64;
        };
        result_mut
    }

    /// e^(-x^2/2) = 1 / e^(x^2/2)
    public fun exp_neg_half_square(x: &FixedPoint128): FixedPoint128 {
        let x_squared = fixed_point::mul(x, x);
        let half = fixed_point::half();
        let half_x2 = fixed_point::mul(&x_squared, &half);
        exp_negative(&half_x2)
    }

    /// e^(-x) helper (x ≥ 0)
    fun exp_negative(x: &FixedPoint128): FixedPoint128 {
        let pos_exp = exp(x);
        fixed_point::div(&fixed_point::one(), &pos_exp)
    }

    /// Natural logarithm via Newton-Raphson (coarse initial guess).
    public fun ln(x: &FixedPoint128): FixedPoint128 {
        let x_raw = fixed_point::raw_value(x);
        assert!(x_raw > 0u128, error::invalid_argument(E_LN_NEGATIVE));
        if (fixed_point::equal(x, &fixed_point::one())) { return fixed_point::zero() };

        let guess = fixed_point::one();
        let guess_mut = guess;
        let i = 0u8;
        let i_mut = i;
        let max_iterations = 20u8;
        let tolerance = fixed_point::from_raw(1000u128);

        while (i_mut < max_iterations) {
            let exp_guess = exp(&guess_mut);
            let diff = fixed_point::sub(x, &exp_guess);
            let adjustment = fixed_point::div(&diff, &exp_guess);
            let old_guess = guess_mut;
            guess_mut = fixed_point::add(&guess_mut, &adjustment);
            if (fixed_point::less_than(&fixed_point::abs_diff(&guess_mut, &old_guess), &tolerance)) { break };
            i_mut = i_mut + 1u8;
        };
        guess_mut
    }

    /// Power: x^y = e^(y * ln x)
    public fun pow(x: &FixedPoint128, y: &FixedPoint128): FixedPoint128 {
        if (fixed_point::equal(y, &fixed_point::zero())) { return fixed_point::one() };
        if (fixed_point::equal(x, &fixed_point::zero())) { return fixed_point::zero() };
        if (fixed_point::equal(x, &fixed_point::one()))  { return fixed_point::one() };

        let ln_x = ln(x);
        let y_ln_x = fixed_point::mul(y, &ln_x);
        exp(&y_ln_x)
    }

    // ===== Constant accessors =====
    public fun e(): FixedPoint128 { fixed_point::from_raw(E) }
    public fun pi(): FixedPoint128 { fixed_point::from_raw(PI) }
    public fun two_pi(): FixedPoint128 { fixed_point::from_raw(TWO_PI) }
    public fun sqrt_two_pi(): FixedPoint128 { fixed_point::from_raw(SQRT_TWO_PI) }
}
