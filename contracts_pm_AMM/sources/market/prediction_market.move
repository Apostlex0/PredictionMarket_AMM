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

    use pm_amm::fixed_point::{Self, FixedPoint128};
    use pm_amm::pool_state::{Self};
    use pm_amm::liquidity_math;
    use pm_amm::dynamic_tracking;
    use pm_amm::swap_engine;

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

    // ===== Registry =====
    struct MarketRegistry has key {
        next_market_id: u64,
        markets: vector<u64>,
        active_markets: vector<u64>,
        resolved_markets: vector<u64>,
        total_markets_created: u64,
        total_markets_resolved: u64,
        total_volume_all_markets: u128,
    }

    // ===== LP accounting =====
    struct LpAccount has store, drop {
        lp_balance: u128,
        // Simplified - no fee index tracking needed with FA vault system
    }

    // ===== Market resource =====
    /// YES = X leg, NO = Y leg (keeps spot price = P(YES))
    struct PredictionMarket<phantom YesToken, phantom NoToken> has key {
        // identity & pool
        market_id: u64,
        creator: address,
        question: String,
        description: String,
        category: String,
        pool: pool_state::Pool<YesToken, NoToken>,

        // timing & resolution
        created_at: u64,
        liquidity_period_ends_at: Option<u64>,
        expires_at: u64,
        resolved_at: Option<u64>,
        resolved: bool,
        outcome_yes: Option<bool>,

        // economics
        initial_probability: FixedPoint128,
        fee_bps: u16,               // swap fee (basis points), used by pool math

        // stats
        total_volume: u128,

        // events
        ev_created: EventHandle<MarketCreatedEvent>,
        ev_trade:   EventHandle<TradeEvent>,
        ev_resolve: EventHandle<ResolutionEvent>,

        // Added changes

        // ===== FA Token Metadata Objects =====
        yes_metadata: Object<fa::Metadata>,
        no_metadata: Object<fa::Metadata>,
        lp_metadata: Object<fa::Metadata>,
        apt_metadata: Object<fa::Metadata>, // APT now uses FA framework (post-June 2025)
        
        // ===== FA Management References =====
        yes_mint_ref: fa::MintRef,
        yes_burn_ref: fa::BurnRef,
        yes_transfer_ref: fa::TransferRef,
        no_mint_ref: fa::MintRef,
        no_burn_ref: fa::BurnRef,
        no_transfer_ref: fa::TransferRef,
        lp_mint_ref: fa::MintRef,
        lp_burn_ref: fa::BurnRef,
        lp_transfer_ref: fa::TransferRef,
        
        // ===== Market Authority =====
        market_signer_cap: account::SignerCapability, // For controlling market's APT
        
         //till here

        // ===== custodial FA vaults =====
        // Token reserves (pre-minted YES/NO tokens available for trading)
        yes_reserve: Object<fa::FungibleStore>,
        no_reserve: Object<fa::FungibleStore>,
        // Collateral reserve (APT FA backing the prediction tokens)
        apt_collateral_reserve: Object<fa::FungibleStore>,
        // Fee vaults (trading fees collected)
        yes_fee_vault: Object<fa::FungibleStore>,
        no_fee_vault: Object<fa::FungibleStore>,

        // LP distribution (simplified - fees distributed via FA vaults)
        // Note: LP supply is tracked in pool.lp_token_supply, not duplicated here
        lp_accounts: Table<address, LpAccount>
    }

    // ====== internal LP helpers ======
    fun load_lp_acc(t: &mut Table<address, LpAccount>, who: address): &mut LpAccount {
        if (!atable::contains(t, who)) {
            let fresh = LpAccount { lp_balance: 0 };
            atable::add(t, who, fresh);
        };
        atable::borrow_mut(t, who)
    }

    
    
    /// Synchronize pool reserves with actual FA store balances 
    fun sync_pool_reserves_with_fa_stores<YesToken, NoToken>(m: &mut PredictionMarket<YesToken, NoToken>) {
        let actual_yes_balance = fa::balance(m.yes_reserve);
        let actual_no_balance = fa::balance(m.no_reserve);
        
        // Update pool state to match actual FA balances
        pool_state::update_reserves(&mut m.pool, actual_yes_balance, actual_no_balance, 0, 0);
    }
        
        /// Helper function to create FA tokens for a market
    
        fun create_market_tokens(
        creator: &signer,
        _market_id: u64,
        _question: &String
    ): (
        Object<fa::Metadata>, fa::MintRef, fa::BurnRef, fa::TransferRef, // YES
        Object<fa::Metadata>, fa::MintRef, fa::BurnRef, fa::TransferRef, // NO  
        Object<fa::Metadata>, fa::MintRef, fa::BurnRef, fa::TransferRef  // LP
    ) {
        // Create YES token
        let yes_constructor_ref = &object::create_named_object(creator, b"YES_TOKEN");
        pfs::create_primary_store_enabled_fungible_asset(
            yes_constructor_ref,
            option::none(), // unlimited supply
            string::utf8(b"YES Token"),
            string::utf8(b"YES"),
            8, // decimals
            string::utf8(b""),
            string::utf8(b"")
        );
        let yes_metadata = object::object_from_constructor_ref<fa::Metadata>(yes_constructor_ref);

        let yes_mint_ref = fa::generate_mint_ref(yes_constructor_ref);
        let yes_burn_ref = fa::generate_burn_ref(yes_constructor_ref);
        let yes_transfer_ref = fa::generate_transfer_ref(yes_constructor_ref);

        // Create NO token 
        let no_constructor_ref = &object::create_named_object(creator, b"NO_TOKEN");
        pfs::create_primary_store_enabled_fungible_asset(
            no_constructor_ref, option::none(), string::utf8(b"NO Token"),
            string::utf8(b"NO"), 8, string::utf8(b""), string::utf8(b"")
        );
        let no_metadata = object::object_from_constructor_ref<fa::Metadata>(no_constructor_ref);
        let no_mint_ref = fa::generate_mint_ref(no_constructor_ref);
        let no_burn_ref = fa::generate_burn_ref(no_constructor_ref);
        let no_transfer_ref = fa::generate_transfer_ref(no_constructor_ref);

        // Create LP token 
        let lp_constructor_ref = &object::create_named_object(creator, b"LP_TOKEN");
        pfs::create_primary_store_enabled_fungible_asset(
            lp_constructor_ref, option::none(), string::utf8(b"LP Token"),
            string::utf8(b"LP"), 8, string::utf8(b""), string::utf8(b"")
        );
        let lp_metadata = object::object_from_constructor_ref<fa::Metadata>(lp_constructor_ref);
        let lp_mint_ref = fa::generate_mint_ref(lp_constructor_ref);
        let lp_burn_ref = fa::generate_burn_ref(lp_constructor_ref);
        let lp_transfer_ref = fa::generate_transfer_ref(lp_constructor_ref);

        (yes_metadata, yes_mint_ref, yes_burn_ref, yes_transfer_ref,
         no_metadata, no_mint_ref, no_burn_ref, no_transfer_ref,
         lp_metadata, lp_mint_ref, lp_burn_ref, lp_transfer_ref)
    }

    // ===== Create market =====

    public fun create_market<YesToken, NoToken, CollateralToken>(
        creator: &signer,
        question: String,
        description: String,
        category: String,
        expires_at: u64,
        initial_probability: FixedPoint128,
        total_pool_value: FixedPoint128,  
        fee_bps: u16,
        is_dynamic: bool,
    ): u64 acquires MarketRegistry {
        let now = timestamp::now_seconds();
        assert!(expires_at > now, E_MARKET_EXPIRED);
        assert!(
            fixed_point::greater_than(&initial_probability, &fixed_point::zero()) &&
            fixed_point::less_than(&initial_probability, &fixed_point::one()),
            E_INVALID_PROBABILITY
        );

        // Registry (per-creator)
        let owner = signer::address_of(creator);
        if (!exists<MarketRegistry>(owner)) {
            move_to(creator, MarketRegistry {
                next_market_id: 1,
                markets: vector::empty<u64>(),
                active_markets: vector::empty<u64>(),
                resolved_markets: vector::empty<u64>(),
                total_markets_created: 0,
                total_markets_resolved: 0,
                total_volume_all_markets: 0,
            });
        };
        let reg = borrow_global_mut<MarketRegistry>(owner);
        let market_id = reg.next_market_id;
        reg.next_market_id = market_id + 1;
        // Create FA tokens for this market
        let (yes_metadata, yes_mint_ref, yes_burn_ref, yes_transfer_ref,
        no_metadata, no_mint_ref, no_burn_ref, no_transfer_ref,
        lp_metadata, lp_mint_ref, lp_burn_ref, lp_transfer_ref) = 
        create_market_tokens(creator, market_id, &question);

        // Calculate optimal L and reserves using PM-AMM math
        let (required_x_yes, required_y_no, _lp_tokens, liquidity_L) = 
            liquidity_math::add_initial_liquidity_pm_amm(&initial_probability, &total_pool_value);

        // Pool - create with calculated optimal reserves and initial price cache
        let pool = if (is_dynamic) {
            pool_state::create_dynamic_pool<YesToken, NoToken>(
                required_x_yes, required_y_no, liquidity_L, expires_at, /*fee*/ fee_bps, owner, initial_probability
            )
        } else {
            pool_state::create_static_pool<YesToken, NoToken>(
                required_x_yes, required_y_no, liquidity_L, /*fee*/ fee_bps, owner, initial_probability
            )
        };



        // Get APT metadata (official APT FA metadata address on all networks)
        let apt_metadata = object::address_to_object<fa::Metadata>(@0xa);
        
        // Create market authority (resource account for controlling APT)
        let (market_signer, market_signer_cap) = account::create_resource_account(creator, b"prediction_market");
        
        // Initialize dynamic tracking for dynamic pools
        if (is_dynamic) {
            dynamic_tracking::initialize_dynamic_tracking(&market_signer, total_pool_value);
        };
        
        // Create proper FA stores for reserves and fee vaults
        let yes_reserve_constructor = &object::create_object_from_account(creator);
        let yes_reserve = fa::create_store(yes_reserve_constructor, yes_metadata);
        
        let no_reserve_constructor = &object::create_object_from_account(creator);
        let no_reserve = fa::create_store(no_reserve_constructor, no_metadata);
        
        // Create APT collateral reserve (now using FA framework)
        let apt_collateral_constructor = &object::create_object_from_account(creator);
        let apt_collateral_reserve = fa::create_store(apt_collateral_constructor, apt_metadata);
        
        let yes_fee_vault_constructor = &object::create_object_from_account(creator);
        let yes_fee_vault = fa::create_store(yes_fee_vault_constructor, yes_metadata);
        
        let no_fee_vault_constructor = &object::create_object_from_account(creator);
        let no_fee_vault = fa::create_store(no_fee_vault_constructor, no_metadata);

        // Calculate liquidity period end time for dynamic pools
        let liquidity_period_ends_at = if (is_dynamic) {
            option::some(now + DEFAULT_LIQUIDITY_PERIOD_SECONDS)
        } else {
            option::none()
        };

        let m = PredictionMarket<YesToken, NoToken> {
            market_id, creator: owner, question, description, category,
            pool,
            created_at: now, liquidity_period_ends_at, expires_at, resolved_at: option::none(), resolved: false, outcome_yes: option::none(),
            initial_probability, fee_bps,
            total_volume: 0,
            ev_created: account::new_event_handle<MarketCreatedEvent>(creator),
            ev_trade:   account::new_event_handle<TradeEvent>(creator),
            ev_resolve: account::new_event_handle<ResolutionEvent>(creator),
            yes_metadata, no_metadata, lp_metadata, apt_metadata,
            yes_mint_ref, yes_burn_ref, yes_transfer_ref,
            no_mint_ref, no_burn_ref, no_transfer_ref,
            lp_mint_ref, lp_burn_ref, lp_transfer_ref,
            market_signer_cap,
            yes_reserve, no_reserve, apt_collateral_reserve, yes_fee_vault, no_fee_vault,
            lp_accounts: atable::new<address, LpAccount>(),
        };

        // Fund reserves using calculated PM-AMM optimal amounts
        // These amounts were calculated by liquidity_math to ensure correct initial price
        if (required_x_yes > 0) {
            let initial_yes_tokens = fa::mint(&m.yes_mint_ref, required_x_yes);
            fa::deposit_with_ref(&m.yes_transfer_ref, m.yes_reserve, initial_yes_tokens);
        };
        if (required_y_no > 0) {
            let initial_no_tokens = fa::mint(&m.no_mint_ref, required_y_no);
            fa::deposit_with_ref(&m.no_transfer_ref, m.no_reserve, initial_no_tokens);
        };

        // Seed LP ledger to creator (use pool's LP supply as source of truth)
        let initial_lp_supply = pool_state::get_lp_supply(&m.pool);
        if (initial_lp_supply > 0) {
            let acc = load_lp_acc(&mut m.lp_accounts, owner);
            acc.lp_balance = acc.lp_balance + initial_lp_supply;
            // No fee index tracking needed - fees distributed via FA vaults
        };

        // persist + event
        let question_copy = m.question;
        event::emit_event(&mut m.ev_created, MarketCreatedEvent {
            market_id, creator: owner, question: question_copy, expires_at, initial_probability_raw: fixed_point::raw_value(&initial_probability), fee_bps
        });
        move_to(creator, m);

        vector::push_back(&mut reg.markets, market_id);
        vector::push_back(&mut reg.active_markets, market_id);
        reg.total_markets_created = reg.total_markets_created + 1;

        market_id
    }

    // ===== Collateral Operations =====
    
    /// Deposit APT collateral to mint YES and NO tokens (1 APT → 1 YES + 1 NO)
    public fun mint_prediction_tokens<YesToken, NoToken>(
        user: &signer, market_addr: address, apt_amount: u64
    ) acquires PredictionMarket {
        assert!(exists<PredictionMarket<YesToken, NoToken>>(market_addr), E_MARKET_NOT_FOUND);
        assert!(apt_amount > 0, E_ZERO);

        let m = borrow_global_mut<PredictionMarket<YesToken, NoToken>>(market_addr);
        assert!(!m.resolved, E_MARKET_ALREADY_RESOLVED);
        assert!(timestamp::now_seconds() < m.expires_at, E_MARKET_EXPIRED);

        let user_addr = signer::address_of(user);
        
        // 1) Transfer APT from user to market's authority account (PRODUCTION READY)
        let market_signer = account::create_signer_with_capability(&m.market_signer_cap);
        let market_authority_addr = signer::address_of(&market_signer);
        pfs::transfer(user, m.apt_metadata, market_authority_addr, apt_amount);
        
        // 3) Mint YES tokens (1:1 ratio)
        let yes_tokens = fa::mint(&m.yes_mint_ref, apt_amount);
        let user_yes_store = pfs::ensure_primary_store_exists(user_addr, m.yes_metadata);
        fa::deposit_with_ref(&m.yes_transfer_ref, user_yes_store, yes_tokens);
        
        // 4) Mint NO tokens (1:1 ratio)  
        let no_tokens = fa::mint(&m.no_mint_ref, apt_amount);
        let user_no_store = pfs::ensure_primary_store_exists(user_addr, m.no_metadata);
        fa::deposit_with_ref(&m.no_transfer_ref, user_no_store, no_tokens);
    }

    /// Redeem winning tokens for APT after market resolution
    public fun redeem_winning_tokens<YesToken, NoToken>(
        holder: &signer, market_addr: address, token_amount: u64
    ) acquires PredictionMarket {
        assert!(exists<PredictionMarket<YesToken, NoToken>>(market_addr), E_MARKET_NOT_FOUND);
        assert!(token_amount > 0, E_ZERO);

        let m = borrow_global_mut<PredictionMarket<YesToken, NoToken>>(market_addr);
        assert!(m.resolved, E_MARKET_NOT_RESOLVED);
        
        let holder_addr = signer::address_of(holder);
        let winning_outcome = *option::borrow(&m.outcome_yes);
        
        if (winning_outcome) {
            // YES won - redeem YES tokens for APT
            let holder_yes_store = pfs::primary_store(holder_addr, m.yes_metadata);
            let yes_tokens = fa::withdraw(holder, holder_yes_store, token_amount);
            fa::burn(&m.yes_burn_ref, yes_tokens);
        } else {
            // NO won - redeem NO tokens for APT  
            let holder_no_store = pfs::primary_store(holder_addr, m.no_metadata);
            let no_tokens = fa::withdraw(holder, holder_no_store, token_amount);
            fa::burn(&m.no_burn_ref, no_tokens);
        };
        
        // Pay out APT 1:1 for winning tokens (PRODUCTION READY)
        let market_signer = account::create_signer_with_capability(&m.market_signer_cap);
        pfs::transfer(&market_signer, m.apt_metadata, holder_addr, token_amount);
    }  

    // ===== View Functions =====
    
    /// Get market information
    public fun get_market_info<YesToken, NoToken>(market_addr: address): (String, String, String, u64, u64, bool, Option<bool>) acquires PredictionMarket {
        assert!(exists<PredictionMarket<YesToken, NoToken>>(market_addr), E_MARKET_NOT_FOUND);
        let m = borrow_global<PredictionMarket<YesToken, NoToken>>(market_addr);
        (m.question, m.description, m.category, m.created_at, m.expires_at, m.resolved, m.outcome_yes)
    }
    
    /// Get market pricing information
    public fun get_market_price<YesToken, NoToken>(market_addr: address): (FixedPoint128, u128) acquires PredictionMarket {
        assert!(exists<PredictionMarket<YesToken, NoToken>>(market_addr), E_MARKET_NOT_FOUND);
        let m = borrow_global_mut<PredictionMarket<YesToken, NoToken>>(market_addr);
        let current_price = pool_state::get_spot_price_direct(&mut m.pool);
        (current_price, m.total_volume)
    }
    
    /// Get market reserves (YES and NO token amounts available for trading)
    public fun get_market_reserves<YesToken, NoToken>(market_addr: address): (u64, u64) acquires PredictionMarket {
        assert!(exists<PredictionMarket<YesToken, NoToken>>(market_addr), E_MARKET_NOT_FOUND);
        let m = borrow_global<PredictionMarket<YesToken, NoToken>>(market_addr);
        pool_state::get_reserves(&m.pool)
    }
    
    /// Get user's token balances (YES, NO tokens)
    public fun get_user_balances<YesToken, NoToken>(user_addr: address, market_addr: address): (u64, u64) acquires PredictionMarket {
        assert!(exists<PredictionMarket<YesToken, NoToken>>(market_addr), E_MARKET_NOT_FOUND);
        let m = borrow_global<PredictionMarket<YesToken, NoToken>>(market_addr);
        
        let yes_balance = if (pfs::primary_store_exists(user_addr, m.yes_metadata)) {
            let yes_store = pfs::primary_store(user_addr, m.yes_metadata);
            fa::balance(yes_store)
        } else { 0 };
        
        let no_balance = if (pfs::primary_store_exists(user_addr, m.no_metadata)) {
            let no_store = pfs::primary_store(user_addr, m.no_metadata);
            fa::balance(no_store)
        } else { 0 };
        
        (yes_balance, no_balance)
    }
    
    /// Check if market exists
    public fun market_exists<YesToken, NoToken>(market_addr: address): bool {
        exists<PredictionMarket<YesToken, NoToken>>(market_addr)
    }
    
    /// Get APT metadata object (helper function)
    public fun apt_metadata(): Object<fa::Metadata> {
        object::address_to_object<fa::Metadata>(@0xa)
    }  

    // ===== Trading =====
    // Users trade YES ↔ NO tokens through AMM, fees go to LP providers

    /// Swap NO tokens for YES tokens (NO → YES)
    public fun buy_yes<YesToken, NoToken>(
        buyer: &signer, market_addr: address, amount_in_no: u64, min_out_yes: u64
    ) acquires PredictionMarket {
        assert!(exists<PredictionMarket<YesToken, NoToken>>(market_addr), E_MARKET_NOT_FOUND);
        assert!(amount_in_no > 0, E_ZERO);

        let m = borrow_global_mut<PredictionMarket<YesToken, NoToken>>(market_addr);
        assert!(!m.resolved, E_MARKET_ALREADY_RESOLVED);
        assert!(timestamp::now_seconds() < m.expires_at, E_MARKET_EXPIRED);

        // For dynamic pools, ensure liquidity period has ended before trading
        if (pool_state::is_dynamic(&m.pool)) {
            if (option::is_some(&m.liquidity_period_ends_at)) {
                let liquidity_deadline = *option::borrow(&m.liquidity_period_ends_at);
                assert!(timestamp::now_seconds() > liquidity_deadline, E_LIQUIDITY_PERIOD_ENDED);
            };
        };

        // Execute swap using pool state 
        let swap_result = pool_state::swap_y_to_x_direct(&mut m.pool, amount_in_no, min_out_yes);
        let out_yes = swap_engine::output_amount(&swap_result);
        let fee_no = swap_engine::fee_amount(&swap_result);
        
        // 2) FA Operations: Pull NO from buyer
        let buyer_addr = signer::address_of(buyer);
        let buyer_no_store = pfs::primary_store(buyer_addr, m.no_metadata);
        let no_tokens = fa::withdraw(buyer, buyer_no_store, amount_in_no);
        
        // 3) Split fee from principal
        let fee_tokens = fa::extract(&mut no_tokens, fee_no);
        
        // 4) Deposit principal to NO reserve 
        fa::deposit_with_ref(&m.no_transfer_ref, m.no_reserve, no_tokens);
        
        // 5) Deposit fee to fee vault
        fa::deposit_with_ref(&m.no_transfer_ref, m.no_fee_vault, fee_tokens);
        
        // 6) Withdraw YES tokens from YES reserve and send to buyer
        let yes_tokens = fa::withdraw_with_ref(&m.yes_transfer_ref, m.yes_reserve, out_yes);
        let buyer_yes_store = pfs::ensure_primary_store_exists(buyer_addr, m.yes_metadata);
        fa::deposit_with_ref(&m.yes_transfer_ref, buyer_yes_store, yes_tokens);
        
        // 7) Synchronize pool reserves with FA store balances (critical for consistency)
        sync_pool_reserves_with_fa_stores(m);
        
        // 8) Update stats and emit event
        m.total_volume = m.total_volume + (amount_in_no as u128);
        let new_price = pool_state::get_spot_price_direct(&mut m.pool);
        event::emit_event(&mut m.ev_trade, TradeEvent {
            market_id: m.market_id, trader: signer::address_of(buyer),
            is_buy: true, is_yes: true,
            amount_in: amount_in_no, amount_out: out_yes,
            new_probability_raw: fixed_point::raw_value(&new_price),
            timestamp: timestamp::now_seconds(),
        });
    }

    /// Swap YES tokens for NO tokens (YES → NO)
    public fun buy_no<YesToken, NoToken>(
        buyer: &signer, market_addr: address, amount_in_yes: u64, min_out_no: u64
    ) acquires PredictionMarket {
        assert!(exists<PredictionMarket<YesToken, NoToken>>(market_addr), E_MARKET_NOT_FOUND);
        assert!(amount_in_yes > 0, E_ZERO);

        let m = borrow_global_mut<PredictionMarket<YesToken, NoToken>>(market_addr);
        assert!(!m.resolved, E_MARKET_ALREADY_RESOLVED);
        assert!(timestamp::now_seconds() < m.expires_at, E_MARKET_EXPIRED);

        // For dynamic pools, ensure liquidity period has ended before trading
        if (pool_state::is_dynamic(&m.pool)) {
            if (option::is_some(&m.liquidity_period_ends_at)) {
                let liquidity_deadline = *option::borrow(&m.liquidity_period_ends_at);
                assert!(timestamp::now_seconds() > liquidity_deadline, E_LIQUIDITY_PERIOD_ENDED);
            };
        };

        // Execute swap using pool state 
        let swap_result = pool_state::swap_x_to_y_direct(&mut m.pool, amount_in_yes, min_out_no);
        let out_no = swap_engine::output_amount(&swap_result);
        let fee_yes = swap_engine::fee_amount(&swap_result);

        // FA Operations: Pull YES from buyer
        let buyer_addr = signer::address_of(buyer);
        let buyer_yes_store = pfs::primary_store(buyer_addr, m.yes_metadata);
        let yes_tokens = fa::withdraw(buyer, buyer_yes_store, amount_in_yes);
        
        // Split fee from principal
        let fee_tokens = fa::extract(&mut yes_tokens, fee_yes);
        
        // Deposit principal to YES reserve 
        fa::deposit_with_ref(&m.yes_transfer_ref, m.yes_reserve, yes_tokens);
        
        // Deposit fee to fee vault
        fa::deposit_with_ref(&m.yes_transfer_ref, m.yes_fee_vault, fee_tokens);
        
        // Withdraw NO tokens from NO reserve and send to buyer
        let no_tokens = fa::withdraw_with_ref(&m.no_transfer_ref, m.no_reserve, out_no);
        let buyer_no_store = pfs::ensure_primary_store_exists(buyer_addr, m.no_metadata);
        fa::deposit_with_ref(&m.no_transfer_ref, buyer_no_store, no_tokens);

        // Synchronize pool reserves with FA store balances (critical for consistency)
        sync_pool_reserves_with_fa_stores(m);

        // Update stats and emit event
        m.total_volume = m.total_volume + (amount_in_yes as u128);
        let new_price = pool_state::get_spot_price_direct(&mut m.pool);
        event::emit_event(&mut m.ev_trade, TradeEvent {
            market_id: m.market_id, trader: buyer_addr,
            is_buy: true, is_yes: false,
            amount_in: amount_in_yes, amount_out: out_no,
            new_probability_raw: fixed_point::raw_value(&new_price),
            timestamp: timestamp::now_seconds(),
        });
    }

    /// Add liquidity and mint LP tokens
    /// Adds liquidity to prediction market using desired value increase
    /// The pool math will calculate optimal token amounts based on current price and PM-AMM invariant
    public fun add_liquidity<YesToken, NoToken>(
        provider: &signer, 
        market_addr: address, 
        desired_value_increase: FixedPoint128
    ) acquires PredictionMarket {
        assert!(exists<PredictionMarket<YesToken, NoToken>>(market_addr), E_MARKET_NOT_FOUND);
        assert!(fixed_point::greater_than(&desired_value_increase, &fixed_point::zero()), E_ZERO);
        let who = signer::address_of(provider);

        let m = borrow_global_mut<PredictionMarket<YesToken, NoToken>>(market_addr);
        assert!(!m.resolved, E_MARKET_ALREADY_RESOLVED);
        assert!(timestamp::now_seconds() < m.expires_at, E_MARKET_EXPIRED);

        // For dynamic pools, restrict liquidity addition after liquidity period ends
        if (pool_state::is_dynamic(&m.pool)) {
            // Check if liquidity period has ended
            if (option::is_some(&m.liquidity_period_ends_at)) {
                let liquidity_deadline = *option::borrow(&m.liquidity_period_ends_at);
                assert!(timestamp::now_seconds() <= liquidity_deadline, E_LIQUIDITY_PERIOD_ENDED);
            };
        };

        // Get current price for liquidity calculation
        let current_price = pool_state::get_spot_price_direct(&mut m.pool);
        
        // Run pool math to determine required token amounts
        let outcome = pool_state::add_liquidity_direct(&mut m.pool, &desired_value_increase, &current_price);
        let required_x = pool_state::get_actual_x(&outcome);
        let required_y = pool_state::get_actual_y(&outcome);
        let minted_lp = pool_state::get_minted_lp(&outcome);

        // Pull exact required tokens from provider
        let provider_yes_store = pfs::primary_store(who, m.yes_metadata);
        let provider_no_store = pfs::primary_store(who, m.no_metadata);
        
        let yes_tokens = if (required_x > 0) { 
            fa::withdraw(provider, provider_yes_store, required_x) 
        } else { 
            fa::zero(m.yes_metadata) 
        };
        let no_tokens = if (required_y > 0) { 
            fa::withdraw(provider, provider_no_store, required_y) 
        } else { 
            fa::zero(m.no_metadata) 
        };

        // Deposit tokens to reserves 
        fa::deposit_with_ref(&m.yes_transfer_ref, m.yes_reserve, yes_tokens);
        fa::deposit_with_ref(&m.no_transfer_ref, m.no_reserve, no_tokens);

        // Mint LP tokens to provider
        let lp_tokens = fa::mint(&m.lp_mint_ref, (minted_lp as u64));
        let provider_lp_store = pfs::ensure_primary_store_exists(who, m.lp_metadata);
        fa::deposit_with_ref(&m.lp_transfer_ref, provider_lp_store, lp_tokens);

        // Update LP accounting
        let acc = load_lp_acc(&mut m.lp_accounts, who);
        acc.lp_balance = acc.lp_balance + minted_lp;
        // Note: Pool already updated its lp_token_supply, no need to duplicate tracking
        // No fee index tracking needed - fees distributed via FA vaults
    }
    
   

    /// Remove liquidity and burn LP tokens
    public fun remove_liquidity<YesToken, NoToken>(
        provider: &signer, market_addr: address, lp_to_burn: u128
    ) acquires PredictionMarket {
        assert!(exists<PredictionMarket<YesToken, NoToken>>(market_addr), E_MARKET_NOT_FOUND);
        let who = signer::address_of(provider);

        let m = borrow_global_mut<PredictionMarket<YesToken, NoToken>>(market_addr);
        assert!(lp_to_burn > 0, E_ZERO);


        // Process automatic withdrawals for dynamic pools first
        if (pool_state::is_dynamic(&m.pool)) {
            let market_signer_addr = signer::address_of(&account::create_signer_with_capability(&m.market_signer_cap));
            if (dynamic_tracking::tracking_exists(market_signer_addr)) {
                let acc_temp = load_lp_acc(&mut m.lp_accounts, who);
                let (x_withdraw, y_withdraw, _dollar_value) = 
                    dynamic_tracking::process_automatic_withdrawal<YesToken, NoToken>(
                        market_signer_addr, who, acc_temp.lp_balance
                    );
                
                // Transfer withdrawn tokens to provider
                let provider_yes_store = pfs::ensure_primary_store_exists(who, m.yes_metadata);
                let provider_no_store = pfs::ensure_primary_store_exists(who, m.no_metadata);
                
                if (x_withdraw > 0) {
                    let yes_out = fa::withdraw_with_ref(&m.yes_transfer_ref, m.yes_reserve, x_withdraw);
                    fa::deposit_with_ref(&m.yes_transfer_ref, provider_yes_store, yes_out);
                };
                if (y_withdraw > 0) {
                    let no_out = fa::withdraw_with_ref(&m.no_transfer_ref, m.no_reserve, y_withdraw);
                    fa::deposit_with_ref(&m.no_transfer_ref, provider_no_store, no_out);
                };
            };
        };

        let acc = load_lp_acc(&mut m.lp_accounts, who);
        assert!(acc.lp_balance >= lp_to_burn, E_INSUFF_LP);

        // Calculate and distribute fees BEFORE burning LP tokens
        let total_lp_supply = pool_state::get_lp_supply(&m.pool);
        let lp_ratio = fixed_point::from_fraction((lp_to_burn as u64), (total_lp_supply as u64));
        
        // Get total fees available in vaults
        let total_yes_fees = fa::balance(m.yes_fee_vault);
        let total_no_fees = fa::balance(m.no_fee_vault);
        
        // Calculate this LP's share of fees for the tokens being burned
        let yes_fee_share = fixed_point::mul(&fixed_point::from_u64(total_yes_fees), &lp_ratio);
        let no_fee_share = fixed_point::mul(&fixed_point::from_u64(total_no_fees), &lp_ratio);
        
        let yes_fees_to_claim = fixed_point::to_u64(&yes_fee_share);
        let no_fees_to_claim = fixed_point::to_u64(&no_fee_share);

        // Prepare provider stores for all transfers
        let provider_yes_store = pfs::ensure_primary_store_exists(who, m.yes_metadata);
        let provider_no_store = pfs::ensure_primary_store_exists(who, m.no_metadata);

        // Distribute fees immediately when burning LP tokens
        if (yes_fees_to_claim > 0) {
            let yes_fees = fa::withdraw_with_ref(&m.yes_transfer_ref, m.yes_fee_vault, yes_fees_to_claim);
            fa::deposit_with_ref(&m.yes_transfer_ref, provider_yes_store, yes_fees);
        };
        if (no_fees_to_claim > 0) {
            let no_fees = fa::withdraw_with_ref(&m.no_transfer_ref, m.no_fee_vault, no_fees_to_claim);
            fa::deposit_with_ref(&m.no_transfer_ref, provider_no_store, no_fees);
        };

        // Pool math for proportional liquidity removal
        let (ax, ay) = pool_state::remove_liquidity_proportional_direct(&mut m.pool, lp_to_burn);

        // Update LP ledger and burn tokens
        acc.lp_balance = acc.lp_balance - lp_to_burn;
        // Note: Pool already updated its lp_token_supply, no need to duplicate tracking

        // Burn LP tokens from provider
        let provider_lp_store = pfs::primary_store(who, m.lp_metadata);
        let lp_tokens = fa::withdraw(provider, provider_lp_store, (lp_to_burn as u64));
        fa::burn(&m.lp_burn_ref, lp_tokens);

        // Pay out proportional share from reserves
        if (ax > 0) {
            let yes_out = fa::withdraw_with_ref(&m.yes_transfer_ref, m.yes_reserve, ax);
            fa::deposit_with_ref(&m.yes_transfer_ref, provider_yes_store, yes_out);
        };
        if (ay > 0) {
            let no_out = fa::withdraw_with_ref(&m.no_transfer_ref, m.no_reserve, ay);
            fa::deposit_with_ref(&m.no_transfer_ref, provider_no_store, no_out);
        };
    }
}