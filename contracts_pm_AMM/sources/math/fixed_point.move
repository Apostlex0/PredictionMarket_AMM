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
    const MAX_U64: u64 = 18446744073709551615;

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

    public fun from_raw(val: u128): FixedPoint128 {
        FixedPoint128 { value: val }
    }

    // (num/den) in fixed-point using safe 256-bit intermediate
    public fun from_fraction(numerator: u64, denominator: u64): FixedPoint128 {
        assert!(denominator != 0, error::invalid_argument(E_DIVISION_BY_ZERO));
        let result = mul_div((numerator as u128), SCALE, (denominator as u128));
        FixedPoint128 { value: result }
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

        public fun add(a: &FixedPoint128, b: &FixedPoint128): FixedPoint128 {
        let sum = a.value + b.value;
        assert!(sum >= a.value, error::invalid_argument(E_OVERFLOW));
        FixedPoint128 { value: sum }
    }

    public fun sub(a: &FixedPoint128, b: &FixedPoint128): FixedPoint128 {
        // assert!(a.value >= b.value, error::invalid_argument(E_UNDERFLOW));
        if (a.value < b.value){
            FixedPoint128 { value: b.value - a.value }
        }else{FixedPoint128 { value: a.value - b.value }}
    }

    public fun min(a: &FixedPoint128, b: &FixedPoint128): FixedPoint128 {
        if (a.value < b.value) { FixedPoint128 { value: a.value } }
        else { FixedPoint128 { value: b.value } }
    }

    public fun max(a: &FixedPoint128, b: &FixedPoint128): FixedPoint128 {
        if (a.value > b.value) { FixedPoint128 { value: a.value } }
        else { FixedPoint128 { value: b.value } }
    }

    // ===== CORE ARITHMETIC =====

    // (a * b) / SCALE with 256-bit intermediate
    public fun mul(a: &FixedPoint128, b: &FixedPoint128): FixedPoint128 {
        let val_a_256 = (a.value as u256);
        let val_b_256 = (b.value as u256);
        let scale_256 = (SCALE as u256);

        let product_256 = val_a_256 * val_b_256;
        let result_256 = product_256 / scale_256;

        // downcast guard
        assert!(result_256 <= (MAX_U128 as u256), error::invalid_argument(E_OVERFLOW));
        FixedPoint128 { value: (result_256 as u128) }
    }

    // (a * SCALE) / b with 256-bit intermediate
    public fun div(a: &FixedPoint128, b: &FixedPoint128): FixedPoint128 {
        assert!(b.value != 0, error::invalid_argument(E_DIVISION_BY_ZERO));

        let val_a_256 = (a.value as u256);
        let val_b_256 = (b.value as u256);
        let scale_256 = (SCALE as u256);

        let num_256 = val_a_256 * scale_256;
        let result_256 = num_256 / val_b_256;

        // downcast guard
        assert!(result_256 <= (MAX_U128 as u256), error::invalid_argument(E_OVERFLOW));
        FixedPoint128 { value: (result_256 as u128) }
    }

    // Generic helper used by from_fraction and elsewhere: floor((a*b)/den)
    public fun mul_div(a: u128, b: u128, denominator: u128): u128 {
        assert!(denominator > 0, error::invalid_argument(E_DIVISION_BY_ZERO));

        let a256 = (a as u256);
        let b256 = (b as u256);
        let d256 = (denominator as u256);

        let q256 = (a256 * b256) / d256;

        // downcast guard
        assert!(q256 <= (MAX_U128 as u256), error::invalid_argument(E_OVERFLOW));
        (q256 as u128)
    }

    /// Newton–Raphson sqrt on raw fixed-point 
    public fun sqrt(a: &FixedPoint128): FixedPoint128 {
        if (a.value == 0u128) {
            return FixedPoint128 { value: 0u128 };
        };

        let res = a.value;
        let prev_res = 0u128;

        while (res != prev_res) {
            prev_res = res;
            let res_fp = FixedPoint128 { value: res };
            // x_{n+1} = (x_n + a / x_n) / 2
            res = (res + div(a, &res_fp).value) / 2u128;
        };

        FixedPoint128 { value: res }
    }

    public fun reciprocal(a: &FixedPoint128): FixedPoint128 {
        assert!(a.value != 0, error::invalid_argument(E_DIVISION_BY_ZERO));
        div(&one(), a)
    }

    public fun abs_diff(a: &FixedPoint128, b: &FixedPoint128): FixedPoint128 {
        if (a.value >= b.value) {
            FixedPoint128 { value: a.value - b.value }
        } else {
            FixedPoint128 { value: b.value - a.value }
        }
    }

    // ===== Rounding =====
    public fun round(a: &FixedPoint128): FixedPoint128 {
        let integer_part = (a.value / SCALE) * SCALE;
        let fractional = a.value % SCALE;
        if (fractional >= HALF_SCALE) {
            FixedPoint128 { value: integer_part + SCALE }
        } else {
            FixedPoint128 { value: integer_part }
        }
    }

    public fun floor(a: &FixedPoint128): FixedPoint128 {
        FixedPoint128 { value: (a.value / SCALE) * SCALE }
    }

    public fun ceil(a: &FixedPoint128): FixedPoint128 {
        let integer_part = (a.value / SCALE) * SCALE;
        if (a.value % SCALE == 0) {
            FixedPoint128 { value: integer_part }
        } else {
            FixedPoint128 { value: integer_part + SCALE }
        }
    }
}
