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

        // Φ(z) using proper signed CDF
        let phi_z = normal_dist::cdf_signed(&z);

        // φ(z) using signed PDF
        let pdf_z = normal_dist::pdf_signed(&z);

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
            fixed_point::greater_than(price, &fixed_point::zero()) &&
            fixed_point::less_than(price, &fixed_point::one()),
            error::invalid_argument(E_INVALID_PRICE)
        );

        // z = Φ⁻¹(P)
        let quantile = normal_dist::inverse_cdf_signed(price);
        let quantile_abs = signed_fixed_point::abs(&quantile);
        let quantile_is_negative = signed_fixed_point::is_negative(&quantile);

        // φ(Φ⁻¹(P))
        let pdf_quantile = normal_dist::pdf_signed(&quantile);

        // Φ⁻¹(P) * P 
        let quantile_times_price = if (quantile_is_negative) {
            // -|z| * P = -(|z| * P)
            fixed_point::mul(&quantile_abs, price)
        } else {
            fixed_point::mul(&quantile_abs, price)
        };

        // x* calculation with proper sign handling
        let x_term = if (quantile_is_negative) {
            // x* = L{-|z|P + φ + |z|} = L{φ + |z|(1-P)}
            let one_minus_p = fixed_point::sub(&fixed_point::one(), price);
            let z_times_1mp = fixed_point::mul(&quantile_abs, &one_minus_p);
            fixed_point::add(&pdf_quantile, &z_times_1mp)
        } else {
            // x* = L{|z|P + φ - |z|} = L{φ - |z|(1-P)}
            let one_minus_p = fixed_point::sub(&fixed_point::one(), price);
            let z_times_1mp = fixed_point::mul(&quantile_abs, &one_minus_p);
            if (fixed_point::greater_than(&pdf_quantile, &z_times_1mp)) {
                fixed_point::sub(&pdf_quantile, &z_times_1mp)
            } else {
                fixed_point::zero()
            }
        };
        let reserve_x = fixed_point::mul(liquidity_L, &x_term);

        // y* calculation with proper sign handling  
        let y_term = if (quantile_is_negative) {
            // y* = L{-|z|P + φ} = L{φ - |z|P}
            let z_times_p = fixed_point::mul(&quantile_abs, price);
            if (fixed_point::greater_than(&pdf_quantile, &z_times_p)) {
                fixed_point::sub(&pdf_quantile, &z_times_p)
            } else {
                fixed_point::zero()
            }
        } else {
            // y* = L{|z|P + φ}
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

        
        normal_dist::cdf_signed(&z)
    }

    // ===== Swap Calculations =====

    public fun calculate_swap_output(
        reserve_x: u64,
        reserve_y: u64,
        liquidity_L: &FixedPoint128,
        input_x: u64,
        is_x_to_y: bool
    ): u64 {
        assert!(input_x > 0, error::invalid_argument(E_ZERO_INPUT));
        
        if (is_x_to_y) {
            calculate_x_to_y_output(reserve_x, reserve_y, liquidity_L, input_x)
        } else {
            calculate_y_to_x_output(reserve_x, reserve_y, liquidity_L, input_x)
        }
    }

    fun calculate_x_to_y_output(
        reserve_x: u64,
        reserve_y: u64,
        liquidity_L: &FixedPoint128,
        input_x: u64
    ): u64 {
        let x = fixed_point::from_u64(reserve_x);
        let y = fixed_point::from_u64(reserve_y);
        let dx = fixed_point::from_u64(input_x);

        let new_x = fixed_point::add(&x, &dx);

        // Better initial guess based on constant product
        let initial_guess = fixed_point::div(&fixed_point::mul(&y, &dx), &new_x);

        let output = newton_raphson_solve(&new_x, &y, liquidity_L, &initial_guess, true);
        let out_u64 = fixed_point::to_u64(&output);
        
        assert!( out_u64 < reserve_y, error::invalid_argument(E_INSUFFICIENT_OUTPUT));
        out_u64
    }

    fun calculate_y_to_x_output(
        reserve_x: u64,
        reserve_y: u64,
        liquidity_L: &FixedPoint128,
        input_y: u64
    ): u64 {
        let x = fixed_point::from_u64(reserve_x);
        let y = fixed_point::from_u64(reserve_y);
        let dy = fixed_point::from_u64(input_y);

        let new_y = fixed_point::add(&y, &dy);

        let initial_guess = fixed_point::div(&fixed_point::mul(&x, &dy), &new_y);

        let output = newton_raphson_solve(&x, &new_y, liquidity_L, &initial_guess, false);
        let out_u64 = fixed_point::to_u64(&output);
        
        assert!(out_u64 > 0 && out_u64 < reserve_x, error::invalid_argument(E_INSUFFICIENT_OUTPUT));
        out_u64
    }

    /// Newton-Raphson solver with corrected derivatives
public fun newton_raphson_solve(
    x_after: &FixedPoint128,
    y_after: &FixedPoint128,
    liquidity_L: &FixedPoint128,
    initial_guess: &FixedPoint128,
    solving_for_y: bool,
): FixedPoint128 {
    let current = *initial_guess;
    let iterations = 0u8;

    while (iterations < MAX_NEWTON_ITERATIONS) {
        // Compute (curr_x, curr_y) depending on which side we're solving for
        let (curr_x, curr_y) = if (solving_for_y) {
            (*x_after, fixed_point::sub(y_after, &current))
        } else {
            (fixed_point::sub(x_after, &current), *y_after)
        };

        // f(current)
        let f_val = evaluate_invariant_fixed_point(&curr_x, &curr_y, liquidity_L);
        let f_abs = signed_fixed_point::abs(&f_val);

        // |f| < tolerance => done
        if (fixed_point::less_than(&f_abs, &fixed_point::from_raw(NEWTON_TOLERANCE))) {
            return current
        };

        // f'(current)
        let deriv = compute_invariant_derivative(&curr_x, &curr_y, liquidity_L, solving_for_y);
        let deriv_abs = signed_fixed_point::abs(&deriv);

        // Derivative too small => break and return best guess
        if (fixed_point::less_than(&deriv_abs, &fixed_point::from_raw(1000))) {
            break
        };

        // Newton step: adjust = f / f'
        let adjust = signed_fixed_point::div(&f_val, &deriv);
        let adjust_abs = signed_fixed_point::abs(&adjust);

        // --- DAMPING & SAFETY ---

        // 1) Dampen if |adjust| > current/2
        let half_current = fixed_point::div(&current, &fixed_point::two());
        if (fixed_point::greater_than(&adjust_abs, &half_current)) {
            // reassign local (no `mut` needed in Move)
            adjust_abs = fixed_point::div(&adjust_abs, &fixed_point::two());
        };

        // 2) Don't subtract more than current
        if (fixed_point::greater_than(&adjust_abs, &current)) {
            adjust_abs = current;
        };

        // 3) Apply step in correct direction
        if (signed_fixed_point::is_negative(&adjust)) {
            current = fixed_point::add(&current, &adjust_abs);
        } else {
            current = fixed_point::sub(&current, &adjust_abs);
        };

        iterations = iterations + 1;
    };

    current
}

    /// CORRECTED DERIVATIVES
    /// ∂I/∂x = -Φ(z) where z = (y-x)/L
    /// ∂I/∂y = Φ(z) - 1
    fun compute_invariant_derivative(
        x: &FixedPoint128,
        y: &FixedPoint128,
        liquidity_L: &FixedPoint128,
        with_respect_to_y: bool
    ): SignedFixedPoint128 {
        // Calculate the marginal price P = Φ(z)
        let price = calculate_marginal_price(
            fixed_point::to_u64(x),
            fixed_point::to_u64(y),
            liquidity_L
        );

        if (with_respect_to_y) {
            // ∂I/∂y = Φ(z) - 1 = P - 1
            // This is always negative since P < 1
            if (fixed_point::greater_than(&price, &fixed_point::one())) {
                // Should not happen in normal operation, but handle gracefully
                let diff = fixed_point::sub(&price, &fixed_point::one());
                signed_fixed_point::from_fixed_point(&diff, false)
            } else {
                let diff = fixed_point::sub(&fixed_point::one(), &price);
                signed_fixed_point::from_fixed_point(&diff, true)
            }
        } else {
            // ∂I/∂x = -Φ(z) = -P
            // This is always negative
            signed_fixed_point::from_fixed_point(&price, true)
        }
    }

    // ===== Helpers =====

    /// Compute y - x as a signed value
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

    // ===== Pool Value Function =====

    /// Calculate pool value V(P) = L * φ(Φ⁻¹(P))
    public fun calculate_pool_value(
        price: &FixedPoint128,
        liquidity_L: &FixedPoint128
    ): FixedPoint128 {
        assert!(
            fixed_point::greater_than(price, &fixed_point::zero()) &&
            fixed_point::less_than(price, &fixed_point::one()),
            error::invalid_argument(E_INVALID_PRICE)
        );

        // z = Φ⁻¹(P)
        let quantile = normal_dist::inverse_cdf_signed(price);

        // φ(Φ⁻¹(P)) - PDF at the quantile
        let pdf_quantile = normal_dist::pdf_signed(&quantile);

        // V(P) = L * φ(Φ⁻¹(P))
        fixed_point::mul(liquidity_L, &pdf_quantile)
    }

    /// Calculate required liquidity L to achieve target pool value at given price
    public fun calculate_liquidity_from_pool_value(
        price: &FixedPoint128,
        target_pool_value: &FixedPoint128
    ): FixedPoint128 {
        assert!(
            fixed_point::greater_than(price, &fixed_point::zero()) &&
            fixed_point::less_than(price, &fixed_point::one()),
            error::invalid_argument(E_INVALID_PRICE)
        );

        let quantile = normal_dist::inverse_cdf_signed(price);
        let pdf_quantile = normal_dist::pdf_signed(&quantile);

        // L = V(P) / φ(Φ⁻¹(P))
        fixed_point::div(target_pool_value, &pdf_quantile)
    }

    // ===== Price Impact =====

    public fun calculate_price_impact(
        reserve_x: u64,
        reserve_y: u64,
        liquidity_L: &FixedPoint128,
        input_amount: u64,
        is_x_to_y: bool
    ): FixedPoint128 {
        let initial_price = calculate_marginal_price(reserve_x, reserve_y, liquidity_L);

        let output = calculate_swap_output(
            reserve_x,
            reserve_y,
            liquidity_L,
            input_amount,
            is_x_to_y
        );

        let (new_x, new_y) = if (is_x_to_y) {
            (reserve_x + input_amount, reserve_y - output)
        } else {
            (reserve_x - output, reserve_y + input_amount)
        };

        let final_price = calculate_marginal_price(new_x, new_y, liquidity_L);
        let price_diff = fixed_point::abs_diff(&final_price, &initial_price);
        fixed_point::div(&price_diff, &initial_price)
    }

}