module pm_amm::pm_amm {
    use std::option::Option;
    use std::signer;
    use std::string::{Self, String};
    use std::vector; 
    use aptos_framework::timestamp;

   

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
            pools: vector::empty<PoolRecord>(), // CHANGED: supply type parameter
        });
    }
}