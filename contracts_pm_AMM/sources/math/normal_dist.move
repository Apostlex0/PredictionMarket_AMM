module pm_amm::normal_dist {
    use pm_amm::fixed_point::{Self, FixedPoint128};
    use pm_amm::exponential;
    use std::error;

    // ===== Constants =====
    const AS_P: u128  = 4268071170065780019;     // 0.2316419
    const AS_B1: u128 = 5890370078591574343;     // +0.319381530
    const AS_B2: u128 = 6573303272560444928;     //  0.356563782 (subtract)
    const AS_B3: u128 = 32851090106953711616;    // +1.781477937
    const AS_B4: u128 = 33595749314265661440;    //  1.821255978 (subtract)
    const AS_B5: u128 = 24534675331651862528;    // +1.330274429

    // Acklam (as provided)
    const ACKLAM_A1: u128 = 46008100438495330304;
    const ACKLAM_A2: u128 = 343547141196726042624;
    const ACKLAM_A3: u128 = 768439543683239608320;
    const ACKLAM_A4: u128 = 469872428449024688128;

    const ACKLAM_B1: u128 = 18446744073709551616;
    const ACKLAM_B2: u128 = 153439103456825507840;
    const ACKLAM_B3: u128 = 432974213052236955648;
    const ACKLAM_B4: u128 = 389241957851379056640;
    const ACKLAM_B5: u128 = 59567355696580100096;

    const ACKLAM_C1: u128 = 25842678515101331456;
    const ACKLAM_C2: u128 = 3528091898151862272;
    const ACKLAM_C3: u128 = 19387061148180807680;
    const ACKLAM_C4: u128 = 996431160646926336;

    const ACKLAM_D1: u128 = 18446744073709551616;
    const ACKLAM_D2: u128 = 2329862488270946304;
    const ACKLAM_D3: u128 = 741290218821599232;
    const ACKLAM_D4: u128 = 238577481863954432;

    const ONE_OVER_SQRT_TWO_PI: u128 = 7334302651812470784; // ~0.3989422804
    const SQRT_TWO: u128 = 26087635650665564424;            // ~1.41421356237

    // Domain & errors
    const CDF_LOWER_BOUND: u128 = 92233720368547758;     // 0.005
    const CDF_UPPER_BOUND: u128 = 18354510353341003858;  // 0.995
    const CENTRAL_REGION_BOUND: u128 = 7836115114640310272; // 0.425

    const E_PROBABILITY_OUT_OF_RANGE: u64 = 200;
    const E_INVERSE_CDF_UNDEFINED: u64 = 201;

    // ===== PDF =====
    /// φ(x) = (1/√(2π)) * e^(-x²/2)
    public fun pdf(x: &FixedPoint128): FixedPoint128 {
        let x_squared = fixed_point::mul(x, x);
        let half = fixed_point::half();
        let half_x2 = fixed_point::mul(&x_squared, &half);
        let exp_part = exp_negative(&half_x2);
        let scale = fixed_point::from_raw(ONE_OVER_SQRT_TWO_PI);
        fixed_point::mul(&scale, &exp_part)
    }
    fun exp_negative(x: &FixedPoint128): FixedPoint128 {
        let pos_exp = exponential::exp(x);
        fixed_point::div(&fixed_point::one(), &pos_exp)
    }

    // ===== CDF (Abramowitz–Stegun) =====
    public fun cdf(x: &FixedPoint128): FixedPoint128 {
        let x_raw = fixed_point::raw_value(x);
        if (x_raw == 0u128) { return fixed_point::half() };

        // Using two's-complement-style helpers for sign (as in your original design)
        let abs_x = if (is_negative(x)) { negate(x) } else { *x };

        let p = fixed_point::from_raw(AS_P);
        let px = fixed_point::mul(&p, &abs_x);
        let one_plus_px = fixed_point::add(&fixed_point::one(), &px);
        let t = fixed_point::div(&fixed_point::one(), &one_plus_px);

        let t2 = fixed_point::mul(&t, &t);
        let t3 = fixed_point::mul(&t2, &t);
        let t4 = fixed_point::mul(&t3, &t);
        let t5 = fixed_point::mul(&t4, &t);

        let term1 = fixed_point::mul(&fixed_point::from_raw(AS_B1), &t);
        let term2 = fixed_point::mul(&fixed_point::from_raw(AS_B2), &t2);
        let term3 = fixed_point::mul(&fixed_point::from_raw(AS_B3), &t3);
        let term4 = fixed_point::mul(&fixed_point::from_raw(AS_B4), &t4);
        let term5 = fixed_point::mul(&fixed_point::from_raw(AS_B5), &t5);

        let poly = fixed_point::add(
            &fixed_point::sub(&fixed_point::add(&fixed_point::sub(&term1, &term2), &term3), &term4),
            &term5
        );

        let pdf_x = pdf(&abs_x);
        let product = fixed_point::mul(&pdf_x, &poly);
        let cdf_abs_x = fixed_point::sub(&fixed_point::one(), &product);

        if (is_negative(x)) { fixed_point::sub(&fixed_point::one(), &cdf_abs_x) } else { cdf_abs_x }
    }

    // ===== Inverse CDF (Acklam) =====
    public fun inverse_cdf(p: &FixedPoint128): FixedPoint128 {
        let p_raw = fixed_point::raw_value(p);
        assert!(p_raw > 0u128 && p_raw < fixed_point::raw_value(&fixed_point::one()),
            error::invalid_argument(E_PROBABILITY_OUT_OF_RANGE));

        if (fixed_point::equal(p, &fixed_point::half())) { return fixed_point::zero() };

        let half = fixed_point::half();
        let diff_from_half = fixed_point::abs_diff(p, &half);
        let central_bound = fixed_point::from_raw(CENTRAL_REGION_BOUND);

        let result =
            if (fixed_point::less_than(&diff_from_half, &central_bound)) { inverse_cdf_central(p) }
            else { inverse_cdf_tail(p) };

        refine_inverse_cdf(&result, p)
    }

    fun inverse_cdf_central(p: &FixedPoint128): FixedPoint128 {
        let half = fixed_point::half();
        let q = fixed_point::sub(p, &half);
        let q2 = fixed_point::mul(&q, &q);

        let a = fixed_point::sub(
            &fixed_point::mul(
                &fixed_point::sub(
                    &fixed_point::mul(
                        &fixed_point::add(
                            &fixed_point::mul(&fixed_point::from_raw(ACKLAM_A4), &q2),
                            &fixed_point::from_raw(ACKLAM_A3)
                        ),
                        &q2
                    ),
                    &fixed_point::from_raw(ACKLAM_A2) // subtract
                ),
                &q2
            ),
            &fixed_point::from_raw(ACKLAM_A1) // subtract
        );
        let num = fixed_point::mul(&a, &q);

        let b = fixed_point::add(
            &fixed_point::mul(
                &fixed_point::sub(
                    &fixed_point::mul(
                        &fixed_point::add(
                            &fixed_point::mul(
                                &fixed_point::add(
                                    &fixed_point::mul(&fixed_point::from_raw(ACKLAM_B5), &q2),
                                    &fixed_point::from_raw(ACKLAM_B4)
                                ),
                                &q2
                            ),
                            &fixed_point::from_raw(ACKLAM_B3)
                        ),
                        &q2
                    ),
                    &fixed_point::from_raw(ACKLAM_B2) // subtract
                ),
                &q2
            ),
            &fixed_point::from_raw(ACKLAM_B1)
        );
        fixed_point::div(&num, &b)
    }

    fun inverse_cdf_tail(p: &FixedPoint128): FixedPoint128 {
        let half = fixed_point::half();
        let in_lower_tail = fixed_point::less_than(p, &half);
        let p_for_log = if (in_lower_tail) { *p } else { fixed_point::sub(&fixed_point::one(), p) };

        let ln_p = exponential::ln(&p_for_log);
        // NOTE[MATH]: As written, this computes sqrt(2*ln(p)), but ln(p)<0 in tails.
        // The standard formula is q = sqrt(-2*ln(p_for_log)). Keeping your logic unchanged.
        let two = fixed_point::two();
        let neg_two_ln_p = fixed_point::mul(&two, &ln_p); // missing negation by design
        let q = fixed_point::sqrt(&neg_two_ln_p);         // may abort if negative

        let num = fixed_point::sub(
            &fixed_point::add(
                &fixed_point::mul(
                    &fixed_point::add(
                        &fixed_point::mul(&fixed_point::from_raw(ACKLAM_C4), &q),
                        &fixed_point::from_raw(ACKLAM_C2)
                    ),
                    &q
                ),
                &fixed_point::mul(&fixed_point::from_raw(ACKLAM_C2), &fixed_point::from_raw(0)) // no-op to keep structure
            ),
            &fixed_point::add(
                &fixed_point::mul(&fixed_point::from_raw(ACKLAM_C3), &q),
                &fixed_point::from_raw(ACKLAM_C1)
            )
        );

        let den = fixed_point::add(
            &fixed_point::mul(
                &fixed_point::sub(
                    &fixed_point::mul(
                        &fixed_point::sub(
                            &fixed_point::mul(&fixed_point::from_raw(ACKLAM_D4), &q),
                            &fixed_point::from_raw(ACKLAM_D3)
                        ),
                        &q
                    ),
                    &fixed_point::from_raw(ACKLAM_D2)
                ),
                &q
            ),
            &fixed_point::from_raw(ACKLAM_D1)
        );

        let res = fixed_point::div(&num, &den);
        if (!in_lower_tail) { negate(&res) } else { res }
    }

    fun refine_inverse_cdf(x: &FixedPoint128, target_p: &FixedPoint128): FixedPoint128 {
        let z = *x;
        let i = 0u8;
        let z_mut = z;
        let i_mut = i;
        let max_iterations = 3u8;
        let tolerance = fixed_point::from_raw(1000u128);

        while (i_mut < max_iterations) {
            let c = cdf(&z_mut);
            if (fixed_point::less_than(&fixed_point::abs_diff(&c, target_p), &tolerance)) { break; };
            let e = fixed_point::sub(&c, target_p);
            let d = pdf(&z_mut);
            let adj = fixed_point::div(&e, &d);
            z_mut = fixed_point::sub(&z_mut, &adj);
            i_mut = i_mut + 1u8;
        };
        z_mut
    }


    // ===== Helpers (two's-complement convention for sign) =====
    fun is_negative(x: &FixedPoint128): bool {
        fixed_point::raw_value(x) > (1u128 << 127u8)
    }
    fun negate(x: &FixedPoint128): FixedPoint128 {
        let max_u128 = 340282366920938463463374607431768211455u128;
        let neg = max_u128 - fixed_point::raw_value(x) + 1u128;
        fixed_point::from_raw(neg)
    }
    
    // ===== pm-AMM helpers =====
    public fun pdf_of_inverse_cdf(p: &FixedPoint128): FixedPoint128 {
        let z = inverse_cdf(p);
        pdf(&z)
    }
    public fun quantile_times_probability(p: &FixedPoint128): FixedPoint128 {
        let z = inverse_cdf(p);
        fixed_point::mul(&z, p)
    }

}
