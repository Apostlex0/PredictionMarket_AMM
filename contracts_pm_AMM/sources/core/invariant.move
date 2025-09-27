module pm_amm::invariant_amm {
    use pm_amm::fixed_point::{Self, FixedPoint128};
    use pm_amm::normal_dist;
    use pm_amm::signed_fixed_point::{Self, SignedFixedPoint128};
    use std::error;

    // ===== Constants =====

    const MAX_NEWTON_ITERATIONS: u8 = 20;
    const NEWTON_TOLERANCE: u128 = 1844674407370955; // ~0.0001 in fixed-point

    // Error codes
    const E_INVALID_LIQUIDITY: u64 = 400;
    const E_INVALID_RESERVES: u64 = 401;
    const E_SWAP_TOO_LARGE: u64 = 402;
    const E_NEWTON_CONVERGENCE_FAILED: u64 = 403;
    const E_INVALID_PRICE: u64 = 404;
    const E_ZERO_INPUT: u64 = 405;
    const E_INSUFFICIENT_OUTPUT: u64 = 406;

    // ===== Core Invariant Function =====

    /// Evaluate the pm-AMM invariant: (y-x)Φ((y-x)/L) + Lφ((y-x)/L) - y
    /// Should equal 0 for valid reserves
    public fun evaluate_invariant(
        reserve_x: u64,
        reserve_y: u64,
        liquidity_L: &FixedPoint128
    ): SignedFixedPoint128 {
        // L > 0
        assert!(!fixed_point::equal(liquidity_L, &fixed_point::zero()),
            error::invalid_argument(E_INVALID_LIQUIDITY));

        let x = fixed_point::from_u64(reserve_x);
        let y = fixed_point::from_u64(reserve_y);

        // y - x (signed)
        let y_minus_x = compute_signed_difference(&y, &x);

        // z = (y - x) / L
        let z = signed_fixed_point::div(
            &y_minus_x,
            &signed_fixed_point::from_fixed_point(liquidity_L, false)
        );

        // |z|, sign(z)
        let (z_abs, z_is_negative) = signed_fixed_point::to_fixed_point(&z);

        // Φ(z)
        let phi_z = if (z_is_negative) {
            let phi_pos = normal_dist::cdf(&z_abs);
            fixed_point::sub(&fixed_point::one(), &phi_pos)
        } else {
            normal_dist::cdf(&z_abs)
        };

        // φ(z) (symmetric)
        let pdf_z = normal_dist::pdf(&z_abs);

        // (y - x) * Φ(z)
        let term1 = signed_fixed_point::mul(
            &y_minus_x,
            &signed_fixed_point::from_fixed_point(&phi_z, false)
        );

        // L * φ(z)
        let term2 = fixed_point::mul(liquidity_L, &pdf_z);
        let term2_signed = signed_fixed_point::from_fixed_point(&term2, false);

        // (y - x)Φ(z) + Lφ(z) - y
        let sum = signed_fixed_point::add(&term1, &term2_signed);
        let y_signed = signed_fixed_point::from_fixed_point(&y, false);
        signed_fixed_point::sub(&sum, &y_signed)
    }

    /// Check if reserves satisfy the invariant (within tolerance)
    public fun validate_reserves(
        reserve_x: u64,
        reserve_y: u64,
        liquidity_L: &FixedPoint128
    ): bool {
        let inv = evaluate_invariant(reserve_x, reserve_y, liquidity_L);
        let abs_val = signed_fixed_point::abs(&inv);
        let tol = fixed_point::from_raw(NEWTON_TOLERANCE);
        fixed_point::less_than(&abs_val, &tol)
    }

    // ===== Optimal Reserve Calculations =====

    /// x*(P) = L{Φ⁻¹(P)P + φ(Φ⁻¹(P)) - Φ⁻¹(P)}
    /// y*(P) = L{Φ⁻¹(P)P + φ(Φ⁻¹(P))}
    public fun calculate_optimal_reserves(
        price: &FixedPoint128,
        liquidity_L: &FixedPoint128
    ): (u64, u64) {
        assert!(
            fixed_point::greater_than(price, &fixed_point::zero())
            && fixed_point::less_than(price, &fixed_point::one()),
            error::invalid_argument(E_INVALID_PRICE)
        );

        // z = Φ⁻¹(P)
        let quantile = normal_dist::inverse_cdf(price);
        let (quantile_abs, quantile_is_negative) =
            signed_fixed_point::to_fixed_point(&to_signed_fixed_point(&quantile));

        // φ(Φ⁻¹(P))
        let pdf_quantile = normal_dist::pdf(&quantile_abs);

        // Φ⁻¹(P) * P
        let quantile_times_price = fixed_point::mul(&quantile_abs, price);

        // x*: L{Φ⁻¹(P)P + φ - Φ⁻¹(P)}
        let x_term = if (quantile_is_negative) {
            // φ + |z|(1 - P)
            let one_minus_p = fixed_point::sub(&fixed_point::one(), price);
            let q_1mp = fixed_point::mul(&quantile_abs, &one_minus_p);
            fixed_point::add(&pdf_quantile, &q_1mp)
        } else {
            // φ + |z|(P - 1)  ==  φ - |z|(1 - P)
            let one_minus_p = fixed_point::sub(&fixed_point::one(), price);
            let neg_term = fixed_point::mul(&quantile_abs, &one_minus_p);
            if (fixed_point::greater_than(&pdf_quantile, &neg_term)) {
                fixed_point::sub(&pdf_quantile, &neg_term)
            } else {
                fixed_point::zero()
            }
        };
        let reserve_x = fixed_point::mul(liquidity_L, &x_term);

        // y*: L{Φ⁻¹(P)P + φ}
        let y_term = if (quantile_is_negative) {
            // φ - |z|*P
            let neg_term = fixed_point::mul(&quantile_abs, price);
            if (fixed_point::greater_than(&pdf_quantile, &neg_term)) {
                fixed_point::sub(&pdf_quantile, &neg_term)
            } else {
                fixed_point::zero()
            }
        } else {
            fixed_point::add(&quantile_times_price, &pdf_quantile)
        };
        let reserve_y = fixed_point::mul(liquidity_L, &y_term);

        (fixed_point::to_u64(&reserve_x), fixed_point::to_u64(&reserve_y))
    }

    /// P = Φ((y-x)/L)
    public fun calculate_marginal_price(
        reserve_x: u64,
        reserve_y: u64,
        liquidity_L: &FixedPoint128
    ): FixedPoint128 {
        let x = fixed_point::from_u64(reserve_x);
        let y = fixed_point::from_u64(reserve_y);

        let y_minus_x = compute_signed_difference(&y, &x);
        let z = signed_fixed_point::div(
            &y_minus_x,
            &signed_fixed_point::from_fixed_point(liquidity_L, false)
        );

        let (z_abs, z_is_negative) = signed_fixed_point::to_fixed_point(&z);
        if (z_is_negative) {
            let phi_pos = normal_dist::cdf(&z_abs);
            fixed_point::sub(&fixed_point::one(), &phi_pos)
        } else {
            normal_dist::cdf(&z_abs)
        }
    }


    // ===== Helpers =====

    /// y - x as signed
    fun compute_signed_difference(y: &FixedPoint128, x: &FixedPoint128): SignedFixedPoint128 {
        if (fixed_point::greater_than_or_equal(y, x)) {
            let d = fixed_point::sub(y, x);
            signed_fixed_point::from_fixed_point(&d, false)
        } else {
            let d = fixed_point::sub(x, y);
            signed_fixed_point::from_fixed_point(&d, true)
        }
    }

    /// Evaluate invariant with FixedPoint128 inputs
    fun evaluate_invariant_fixed_point(
        x: &FixedPoint128,
        y: &FixedPoint128,
        liquidity_L: &FixedPoint128
    ): SignedFixedPoint128 {
        evaluate_invariant(fixed_point::to_u64(x), fixed_point::to_u64(y), liquidity_L)
    }

    /// Convert FixedPoint128 to SignedFixedPoint128 via two's-complement convention
    fun to_signed_fixed_point(x: &FixedPoint128): SignedFixedPoint128 {
        let raw = fixed_point::raw_value(x);
        if (raw > (1u128 << 127u8)) {
            signed_fixed_point::from_fixed_point(x, true)
        } else {
            signed_fixed_point::from_fixed_point(x, false)
        }
    }

   
}
