module pm_amm::signed_fixed_point {
    use pm_amm::fixed_point::{Self, FixedPoint128};
    use std::error;

    // Error codes
    const E_OVERFLOW: u64 = 300;

    // Two's complement representation
    const SIGN_BIT: u128 = 170141183460469231731687303715884105728; // 2^127
    const MAX_POSITIVE: u128 = 170141183460469231731687303715884105727; // 2^127 - 1

    struct SignedFixedPoint128 has copy, drop, store {
        value: u128  // Two's complement representation
    }

    // ===== Constructors =====

    public fun from_fixed_point(x: &FixedPoint128, is_negative: bool): SignedFixedPoint128 {
        let raw = fixed_point::raw_value(x);
        if (is_negative) {
            let negated = (340282366920938463463374607431768211455u128 - raw) + 1u128; // CHANGED: explicit u128
            SignedFixedPoint128 { value: negated }
        } else {
            assert!(raw <= MAX_POSITIVE, error::invalid_argument(E_OVERFLOW));
            SignedFixedPoint128 { value: raw }
        }
    }

    public fun zero(): SignedFixedPoint128 { SignedFixedPoint128 { value: 0u128 } }

    // public fun from_int(val: i64): SignedFixedPoint128 {
    //     if (val >= 0) {
    //         let pos = fixed_point::from_u64(val as u64);
    //         from_fixed_point(&pos, false)
    //     } else {
    //         let pos = fixed_point::from_u64(((0 - val) as u64)); // NOTE[MATH]: i64::MIN edge case not handled
    //         from_fixed_point(&pos, true)
    //     }
    // }

    // ===== Conversion =====

    public fun is_negative(x: &SignedFixedPoint128): bool { x.value >= SIGN_BIT }

    public fun abs(x: &SignedFixedPoint128): FixedPoint128 {
        if (is_negative(x)) {
            let positive_val = (340282366920938463463374607431768211455u128 - x.value) + 1u128;
            fixed_point::from_raw(positive_val)
        } else {
            fixed_point::from_raw(x.value)
        }
    }

    public fun to_fixed_point(x: &SignedFixedPoint128): (FixedPoint128, bool) {
        let is_neg = is_negative(x);
        let abs_val = abs(x);
        (abs_val, is_neg)
    }

    // ===== Arithmetic =====

    public fun add(a: &SignedFixedPoint128, b: &SignedFixedPoint128): SignedFixedPoint128 {
        let a_neg = is_negative(a);
        let b_neg = is_negative(b);

        if (a_neg == b_neg) {
            let abs_a = abs(a);
            let abs_b = abs(b);
            let sum = fixed_point::add(&abs_a, &abs_b);
            from_fixed_point(&sum, a_neg)
        } else {
            let abs_a = abs(a);
            let abs_b = abs(b);
            if (fixed_point::greater_than(&abs_a, &abs_b)) {
                let diff = fixed_point::sub(&abs_a, &abs_b);
                from_fixed_point(&diff, a_neg)
            } else {
                let diff = fixed_point::sub(&abs_b, &abs_a);
                from_fixed_point(&diff, b_neg)
            }
        }
    }

    public fun sub(a: &SignedFixedPoint128, b: &SignedFixedPoint128): SignedFixedPoint128 {
        let nb = negate(b);
        add(a, &nb)
    }

    public fun negate(x: &SignedFixedPoint128): SignedFixedPoint128 {
        let negated = (340282366920938463463374607431768211455u128 - x.value) + 1u128; // CHANGED: explicit u128
        SignedFixedPoint128 { value: negated }
    }

    public fun mul(a: &SignedFixedPoint128, b: &SignedFixedPoint128): SignedFixedPoint128 {
        let abs_a = abs(a);
        let abs_b = abs(b);
        let product = fixed_point::mul(&abs_a, &abs_b);
        let result_negative = is_negative(a) != is_negative(b);
        from_fixed_point(&product, result_negative)
    }

    public fun div(a: &SignedFixedPoint128, b: &SignedFixedPoint128): SignedFixedPoint128 {
        let abs_a = abs(a);
        let abs_b = abs(b);
        let quotient = fixed_point::div(&abs_a, &abs_b);
        let result_negative = is_negative(a) != is_negative(b);
        from_fixed_point(&quotient, result_negative)
    }
}
