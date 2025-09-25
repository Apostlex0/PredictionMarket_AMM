module pm_amm::fixed_point {
    use std::error;

    // ===== Constants =====
    const FRACTIONAL_BITS: u8 = 64;
    const INTEGER_BITS: u8 = 64;
    const TOTAL_BITS: u8 = 128;

    // Scale factor: 2^64
    const SCALE: u128 = 18446744073709551616; // 2^64
    const HALF_SCALE: u128 = 9223372036854775808; // 2^63

    // Useful constants in fixed-point representation
    const ZERO: u128 = 0;
    const ONE: u128 = 18446744073709551616; // 1.0
    const TWO: u128 = 36893488147419103232; // 2.0
    const HALF: u128 = 9223372036854775808; // 0.5

    // Bounds
    const MAX_U128: u128 = 340282366920938463463374607431768211455;
    const MAX_SAFE_INT: u128 = 9223372036854775807; // 2^63 - 1

    // Error codes
    const E_OVERFLOW: u64 = 1;
    const E_UNDERFLOW: u64 = 2;
    const E_DIVISION_BY_ZERO: u64 = 3;
    const E_NEGATIVE_SQRT: u64 = 4;
    const E_NEGATIVE_LN: u64 = 5;
    const E_OUT_OF_RANGE: u64 = 6;

    // ===== Type =====
    struct FixedPoint128 has copy, drop, store { value: u128 }

    // ===== Constructors =====
    public fun from_u64(val: u64): FixedPoint128 {
        FixedPoint128 { value: (val as u128) * SCALE }
    }
    public fun from_u128(val: u128): FixedPoint128 {
        assert!(val <= MAX_SAFE_INT, error::invalid_argument(E_OVERFLOW));
        FixedPoint128 { value: val * SCALE }
    }
    public fun from_raw(val: u128): FixedPoint128 { FixedPoint128 { value: val } }
    public fun from_fraction(numerator: u64, denominator: u64): FixedPoint128 {
        assert!(denominator != 0, error::invalid_argument(E_DIVISION_BY_ZERO));
        FixedPoint128 { value: ((numerator as u128) * SCALE) / (denominator as u128) }
    }

    // ===== Common constants =====
    public fun zero(): FixedPoint128 { FixedPoint128 { value: ZERO } }
    public fun one(): FixedPoint128 { FixedPoint128 { value: ONE } }
    public fun two(): FixedPoint128 { FixedPoint128 { value: TWO } }
    public fun half(): FixedPoint128 { FixedPoint128 { value: HALF } }

    // ===== Conversions =====
    public fun raw_value(a: &FixedPoint128): u128 { a.value }
    public fun to_u64(a: &FixedPoint128): u64 { (a.value / SCALE) as u64 }
    public fun to_u128(a: &FixedPoint128): u128 { a.value / SCALE }
    public fun fractional_part(a: &FixedPoint128): u128 { a.value % SCALE }

    // ===== Comparisons =====
    public fun equal(a: &FixedPoint128, b: &FixedPoint128): bool { a.value == b.value }
    public fun less_than(a: &FixedPoint128, b: &FixedPoint128): bool { a.value < b.value }
    public fun less_than_or_equal(a: &FixedPoint128, b: &FixedPoint128): bool { a.value <= b.value }
    public fun greater_than(a: &FixedPoint128, b: &FixedPoint128): bool { a.value > b.value }
    public fun greater_than_or_equal(a: &FixedPoint128, b: &FixedPoint128): bool { a.value >= b.value }

    public fun min(a: &FixedPoint128, b: &FixedPoint128): FixedPoint128 {
        if (a.value < b.value) { FixedPoint128 { value: a.value } } else { FixedPoint128 { value: b.value } }
    }
    public fun max(a: &FixedPoint128, b: &FixedPoint128): FixedPoint128 {
        if (a.value > b.value) { FixedPoint128 { value: a.value } } else { FixedPoint128 { value: b.value } }
    }

    // ===== Arithmetic =====
    public fun add(a: &FixedPoint128, b: &FixedPoint128): FixedPoint128 {
        let sum = a.value + b.value;
        assert!(sum >= a.value, error::invalid_argument(E_OVERFLOW));
        FixedPoint128 { value: sum }
    }
    public fun sub(a: &FixedPoint128, b: &FixedPoint128): FixedPoint128 {
        assert!(a.value >= b.value, error::invalid_argument(E_UNDERFLOW));
        FixedPoint128 { value: a.value - b.value }
    }

    /// NOTE[MATH]: this split multiply is approximate (ignores high_high and exact cross-term scaling).
    /// Kept as-is per your request; consider u256 intermediates or math128::mul_div for exactness.
    public fun mul(a: &FixedPoint128, b: &FixedPoint128): FixedPoint128 {
        let a_high = a.value >> 64u8;
        let a_low  = a.value & ((1u128 << 64u8) - 1u128);
        let b_high = b.value >> 64u8;
        let b_low  = b.value & ((1u128 << 64u8) - 1u128);

        assert!(a_high == 0 || b_high == 0, error::invalid_argument(E_OVERFLOW));

        let low_low  = a_low * b_low;
        let low_high = a_low * b_high;
        let high_low = a_high * b_low;

        let result = (low_low / SCALE) + low_high + high_low;
        FixedPoint128 { value: result }
    }

    public fun div(a: &FixedPoint128, b: &FixedPoint128): FixedPoint128 {
        assert!(b.value != 0, error::invalid_argument(E_DIVISION_BY_ZERO));
        if (a.value < (MAX_U128 / SCALE)) {
            FixedPoint128 { value: (a.value * SCALE) / b.value }
        } else {
            let quotient = a.value / b.value;
            let remainder = a.value % b.value;
            let fractional = (remainder * SCALE) / b.value;
            FixedPoint128 { value: (quotient * SCALE) + fractional }
        }
    }

    // / Fixed-point sqrt via binary search: find res s.t. (res^2)/SCALE ≈ a
    public fun sqrt(a: &FixedPoint128): FixedPoint128 {
        if (a.value == 0u128) { return zero(); };

        let lo = 0u128;
        let hi = a.value;
        let res = 0u128;
        let target = a.value;

        let lo_mut = lo;
        let hi_mut = hi;
        let res_mut = res;

        while (lo_mut <= hi_mut) {
            let mid = (lo_mut + hi_mut) / 2u128;

            // guard overflow on mid*mid
            if (mid != 0u128 && mid > (MAX_U128 / mid)) {
                hi_mut = mid - 1u128;
                continue
            };

            let mid_squared = (mid * mid) / SCALE;
            if (mid_squared <= target) {
                res_mut = mid;
                lo_mut = mid + 1u128;
            } else {
                hi_mut = mid - 1u128;
            }
        };
        FixedPoint128 { value: res_mut }
    }

    public fun reciprocal(a: &FixedPoint128): FixedPoint128 {
        assert!(a.value != 0, error::invalid_argument(E_DIVISION_BY_ZERO));
        div(&one(), a)
    }

    public fun abs_diff(a: &FixedPoint128, b: &FixedPoint128): FixedPoint128 {
        if (a.value >= b.value) { FixedPoint128 { value: a.value - b.value } }
        else { FixedPoint128 { value: b.value - a.value } }
    }

    // ===== Rounding =====
    public fun round(a: &FixedPoint128): FixedPoint128 {
        let integer_part = (a.value / SCALE) * SCALE;
        let fractional = a.value % SCALE;
        if (fractional >= HALF_SCALE) { FixedPoint128 { value: integer_part + SCALE } }
        else { FixedPoint128 { value: integer_part } }
    }
    public fun floor(a: &FixedPoint128): FixedPoint128 {
        FixedPoint128 { value: (a.value / SCALE) * SCALE }
    }
    public fun ceil(a: &FixedPoint128): FixedPoint128 {
        let integer_part = (a.value / SCALE) * SCALE;
        if (a.value % SCALE == 0) { FixedPoint128 { value: integer_part } }
        else { FixedPoint128 { value: integer_part + SCALE } }
    }
}
