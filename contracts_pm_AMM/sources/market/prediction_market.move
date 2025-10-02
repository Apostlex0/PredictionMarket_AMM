module pm_amm::prediction_market {
    use std::option::{Self, Option};
    use std::signer;
    use std::vector;

    use aptos_framework::timestamp;
    use aptos_framework::event::{Self, EventHandle};
    use aptos_framework::account;
    use aptos_framework::fungible_asset::{Self as fa, MintRef, BurnRef, TransferRef, Metadata, FungibleStore};
    use aptos_framework::primary_fungible_store as pfs;
    use aptos_framework::object::{Self, Object};
    
    use aptos_std::table::{Self as atable, Table};
    use aptos_std::string::{Self, String};



    // ===== Error Codes =====
    /// Market not found
    const E_MARKET_NOT_FOUND: u64 = 9001;
    /// Market has expired
    const E_MARKET_EXPIRED: u64 = 9002;
    /// Market already resolved
    const E_MARKET_ALREADY_RESOLVED: u64 = 9003;
    /// Market not expired yet
    const E_MARKET_NOT_EXPIRED: u64 = 9004;
    /// Market not resolved yet
    const E_MARKET_NOT_RESOLVED: u64 = 9005;
    /// Not authorized to perform action
    const E_NOT_AUTHORIZED: u64 = 9010;
    /// Invalid probability value
    const E_INVALID_PROBABILITY: u64 = 9006;
    /// Minimum output not met
    const E_MIN_OUTPUT: u64 = 9007;
    /// Zero amount not allowed
    const E_ZERO: u64 = 9008;
    /// Insufficient LP tokens
    const E_INSUFF_LP: u64 = 9009;
    /// Trading has already started - no more liquidity additions allowed
    const E_TRADING_ALREADY_STARTED: u64 = 9011;
    /// Not a dynamic pool
    const E_NOT_DYNAMIC_POOL: u64 = 9012;
    /// Dynamic tracking not initialized
    const E_TRACKING_NOT_INITIALIZED: u64 = 9013;
    /// Liquidity period has ended - trading can now begin
    const E_LIQUIDITY_PERIOD_ENDED: u64 = 9014;


    // fee index scale
    const SCALE_FEES: u128 = 1_000_000_000_000;
    /// Default liquidity period for dynamic pools (in seconds)
    /// LPs have this much time to add liquidity before trading can start
    const DEFAULT_LIQUIDITY_PERIOD_SECONDS: u64 = 3600; // 1 hour

        // ===== Events =====
    struct MarketCreatedEvent has drop, store {
        market_id: u64,
        creator: address,
        question: String,
        expires_at: u64,
        initial_probability_raw: u128,
        fee_bps: u16,
    }

    struct TradeEvent has drop, store {
        market_id: u64,
        trader: address,
        is_buy: bool,     // always true (buy side); direction in is_yes
        is_yes: bool,     // true if NO→YES; false if YES→NO
        amount_in: u64,
        amount_out: u64,
        new_probability_raw: u128,
        timestamp: u64,
    }

    struct ResolutionEvent has drop, store {
        market_id: u64,
        resolver: address,
        outcome_yes: bool,
        timestamp: u64,
    }
}