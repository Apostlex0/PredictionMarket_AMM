module pm_amm::pm_amm {
    use std::option::Option;
    use std::signer;
    use std::string::{Self, String};
    use std::vector; 
    use aptos_framework::timestamp;

    use pm_amm::fixed_point::{Self, FixedPoint128};
    use pm_amm::pool_state::{Self};
    use pm_amm::swap_engine::{Self};
    use pm_amm::invariant_amm;
    use pm_amm::prediction_market;

    // ===== Error Codes =====
    const E_NOT_INITIALIZED: u64 = 1100;
    const E_ALREADY_INITIALIZED: u64 = 1101;
    const E_INVALID_PARAMETERS: u64 = 1102;
    const E_UNAUTHORIZED: u64 = 1103;
    const E_PAUSED: u64 = 1104;

    // ===== Constants =====
    const DEFAULT_FEE_RATE: u16 = 30; // 0.3%
    const MIN_LIQUIDITY: u64 = 1000;
    const MAX_FEE_RATE: u16 = 1000; // 10% max

    // ===== Structs =====

    /// Global protocol configuration
    struct ProtocolConfig has key {
        admin: address,
        fee_recipient: address,
        protocol_fee_rate: u16, // Basis points taken from swap fees
        is_paused: bool,
        total_pools_created: u64,
        total_markets_created: u64,
    }

    /// Registry for all pools
    struct PoolRegistry has key {
        pools: vector<PoolRecord>,
    }

    struct PoolRecord has store, copy, drop {
        pool_id: u64,
        token_x_type: String,
        token_y_type: String,
        creator: address,
        is_prediction_market: bool,
        created_at: u64,
    }

    // ===== Initialization =====

    /// Initialize the protocol
    public entry fun initialize(
        admin: &signer,
        fee_recipient: address,
        protocol_fee_rate: u16,
    ) {
        let admin_addr = signer::address_of(admin);
        assert!(admin_addr == @pm_amm, E_UNAUTHORIZED);
        
        assert!(!exists<ProtocolConfig>(admin_addr), E_ALREADY_INITIALIZED);
        assert!(protocol_fee_rate <= 1000, E_INVALID_PARAMETERS); // Max 10%

        move_to(admin, ProtocolConfig {
            admin: admin_addr,
            fee_recipient,
            protocol_fee_rate,
            is_paused: false,
            total_pools_created: 0,
            total_markets_created: 0,
        });

        move_to(admin, PoolRegistry {
            pools: vector::empty<PoolRecord>(), 
        });
    }

    /// Create a new prediction market
    public entry fun create_prediction_market<YesToken, NoToken, Collateral>(
        creator: &signer,
        question: vector<u8>,
        description: vector<u8>,
        category: vector<u8>,
        expires_in_seconds: u64,
        initial_probability: u128, // Raw FixedPoint128
        initial_liquidity: u128, // Changed to u128 for raw FixedPoint128
        fee_rate: u16,
        resolution_source: vector<u8>,
        is_dynamic: bool,
    ) acquires ProtocolConfig, PoolRegistry {
        assert_not_paused();

        let price = fixed_point::from_raw(initial_probability);
        let expires_at = timestamp::now_seconds() + expires_in_seconds;

        // Calculate initial reserves based on probability
        // Convert initial_liquidity to total pool value for PM-AMM
        let total_pool_value = fixed_point::from_raw(initial_liquidity); // Use from_raw for consistency

        let _market_id = prediction_market::create_market<YesToken, NoToken, Collateral>(
            creator,
            string::utf8(question),
            string::utf8(description),
            string::utf8(category),
            expires_at,
            price,
            total_pool_value,
            fee_rate,
            is_dynamic,
        );

        // Update protocol stats
        // NOTE: This reads @pm_amm; see note below re: where ProtocolConfig is stored.
        let config = borrow_global_mut<ProtocolConfig>(@pm_amm); // CHANGED: compiles, but see design note
        config.total_markets_created = config.total_markets_created + 1;

        // Register as a pool
        register_pool<YesToken, NoToken>(signer::address_of(creator), true);
    }

    /// Mint prediction tokens by depositing APT collateral
    public entry fun mint_prediction_tokens<YesToken, NoToken>(
        user: &signer, 
        market_addr: address, 
        apt_amount: u64
    ) {
        prediction_market::mint_prediction_tokens<YesToken, NoToken>(user, market_addr, apt_amount);
    }

    /// Buy YES tokens with NO tokens
    public entry fun buy_yes_tokens<YesToken, NoToken>(
        buyer: &signer, 
        market_addr: address, 
        amount_in_no: u64, 
        min_out_yes: u64
    ) {
        prediction_market::buy_yes<YesToken, NoToken>(buyer, market_addr, amount_in_no, min_out_yes);
    }

    /// Buy NO tokens with YES tokens  
    public entry fun buy_no_tokens<YesToken, NoToken>(
        buyer: &signer, 
        market_addr: address, 
        amount_in_yes: u64, 
        min_out_no: u64
    ) {
        prediction_market::buy_no<YesToken, NoToken>(buyer, market_addr, amount_in_yes, min_out_no);
    }

    public entry fun add_market_liquidity<YesToken, NoToken>(
        provider: &signer,
        market_addr: address,
        desired_value_increase_raw: u128  // Raw FixedPoint128 value
    ) {
        // Use raw value directly as FixedPoint128
        let desired_value_increase = fixed_point::from_raw(desired_value_increase_raw);
        //prediction_market::add_liquidity<YesToken, NoToken>(provider, market_addr, desired_value_increase);
         prediction_market::add_pretrade_liquidity<YesToken, NoToken>(
                provider, 
                market_addr, 
                desired_value_increase
            );
    }

    /// Remove liquidity from a prediction market
    public entry fun remove_market_liquidity<YesToken, NoToken>(
        provider: &signer,
        market_addr: address,
        lp_to_burn: u128
    ) {
        prediction_market::remove_liquidity<YesToken, NoToken>(provider, market_addr, lp_to_burn);
    }

    // ===== Market Resolution Functions =====

    /// Resolve a prediction market
    public entry fun resolve_prediction_market<YesToken, NoToken>(
        resolver: &signer,
        market_addr: address,
        outcome_yes: bool
    ) {
        prediction_market::resolve_market<YesToken, NoToken>(resolver, market_addr, outcome_yes);
    }

    /// Settle tokens after market resolution with collateral redemption - PRIMARY REDEMPTION METHOD)
    public entry fun settle_tokens_with_collateral<YesToken, NoToken>(
        holder: &signer,
        market_addr: address,
        yes_amount: u64,
        no_amount: u64
    ) {
        prediction_market::settle_tokens_with_collateral<YesToken, NoToken>(
            holder, market_addr, yes_amount, no_amount
        );
    }

    // ===== Prediction Market View Functions =====

#[view]
public fun is_paused(): bool acquires ProtocolConfig {
    if (!exists<ProtocolConfig>(@pm_amm)) { return true };
    let config = borrow_global<ProtocolConfig>(@pm_amm);
    config.is_paused
}

        // ===== Internal Functions =====

    fun assert_not_paused() acquires ProtocolConfig {
        assert!(!is_paused(), E_PAUSED);
    }

    fun register_pool<X, Y>(
        pool_owner: address,
        is_prediction_market: bool,
    ) acquires ProtocolConfig, PoolRegistry {
        let config = borrow_global_mut<ProtocolConfig>(@pm_amm); 
        config.total_pools_created = config.total_pools_created + 1;

        let registry = borrow_global_mut<PoolRegistry>(@pm_amm); 
        vector::push_back(&mut registry.pools, PoolRecord {
            pool_id: config.total_pools_created,
            token_x_type: type_name<X>(),
            token_y_type: type_name<Y>(),
            creator: pool_owner,
            is_prediction_market,
            created_at: timestamp::now_seconds(),
        });
    }

     fun type_name<T>(): String {
        string::utf8(b"placeholder") 
    }
}