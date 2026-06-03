module pm_amm::prediction_market {
    use std::bcs;
    use std::option::{Self, Option};
    use std::signer;
    use std::vector;

    use aptos_framework::timestamp;
    use aptos_framework::event::{Self, EventHandle};
    use aptos_framework::account;
    use aptos_framework::fungible_asset::{Self as fa};
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
    /// Dynamic pool liquidity can only be removed after market resolution
    const E_DYNAMIC_LP_REMOVAL_BEFORE_RESOLUTION: u64 = 9015;


    // fee index scale
    const SCALE_FEES: u128 = 1_000_000_000_000;
    /// Default liquidity period for dynamic pools (in seconds)
    /// LPs have this much time to add liquidity before trading can start
    const DEFAULT_LIQUIDITY_PERIOD_SECONDS: u64 = 300; // 5 minutes
    /// Dynamic market must retain a positive live-trading window after pretrade liquidity collection.
    const E_DYNAMIC_MARKET_DURATION_TOO_SHORT: u64 = 9016;

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
        apt_metadata: Object<fa::Metadata>, 
        
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
        
    fun market_seed(prefix: vector<u8>, market_id: u64): vector<u8> {
        let seed = prefix;
        vector::append(&mut seed, bcs::to_bytes(&market_id));
        seed
    }

    public fun next_market_address(creator_addr: address): address acquires MarketRegistry {
        let market_id = if (exists<MarketRegistry>(creator_addr)) {
            borrow_global<MarketRegistry>(creator_addr).next_market_id
        } else {
            1
        };

        account::create_resource_address(
            &creator_addr,
            market_seed(b"prediction_market", market_id)
        )
    }

    /// Helper function to create FA tokens for a market
    fun create_market_tokens(
        creator: &signer,
        market_id: u64,
        _question: &String
    ): (
        Object<fa::Metadata>, fa::MintRef, fa::BurnRef, fa::TransferRef, // YES
        Object<fa::Metadata>, fa::MintRef, fa::BurnRef, fa::TransferRef, // NO  
        Object<fa::Metadata>, fa::MintRef, fa::BurnRef, fa::TransferRef  // LP
    ) {
        // Create YES token
        let yes_constructor_ref = &object::create_named_object(
            creator,
            market_seed(b"YES_TOKEN", market_id)
        );
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
        let no_constructor_ref = &object::create_named_object(
            creator,
            market_seed(b"NO_TOKEN", market_id)
        );
        pfs::create_primary_store_enabled_fungible_asset(
            no_constructor_ref, option::none(), string::utf8(b"NO Token"),
            string::utf8(b"NO"), 8, string::utf8(b""), string::utf8(b"")
        );
        let no_metadata = object::object_from_constructor_ref<fa::Metadata>(no_constructor_ref);
        let no_mint_ref = fa::generate_mint_ref(no_constructor_ref);
        let no_burn_ref = fa::generate_burn_ref(no_constructor_ref);
        let no_transfer_ref = fa::generate_transfer_ref(no_constructor_ref);

        // Create LP token 
        let lp_constructor_ref = &object::create_named_object(
            creator,
            market_seed(b"LP_TOKEN", market_id)
        );
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

        // Calculate optimal L and reserves using PM-AMM math.
        let (required_x_yes, required_y_no, _lp_tokens, liquidity_L) =
            liquidity_math::add_initial_liquidity_pm_amm(
                &initial_probability,
                &total_pool_value
            );

        // Dynamic markets collect liquidity first and begin trading only after
        // this deadline. The deadline is also the dynamic L-decay anchor.
        let liquidity_period_ends_at = if (is_dynamic) {
            let trading_start_timestamp =
                now + DEFAULT_LIQUIDITY_PERIOD_SECONDS;

            assert!(
                expires_at > trading_start_timestamp,
                E_DYNAMIC_MARKET_DURATION_TOO_SHORT
            );

            option::some(trading_start_timestamp)
        } else {
            option::none()
        };

        // Pool creation uses the calculated reserves and initial price cache.
        let pool = if (is_dynamic) {
            let trading_start_timestamp =
                *option::borrow(&liquidity_period_ends_at);

            pool_state::create_dynamic_pool<YesToken, NoToken>(
                required_x_yes,
                required_y_no,
                liquidity_L,
                expires_at,
                trading_start_timestamp,
                fee_bps,
                owner,
                initial_probability
            )
        } else {
            pool_state::create_static_pool<YesToken, NoToken>(
                required_x_yes,
                required_y_no,
                liquidity_L,
                fee_bps,
                owner,
                initial_probability
            )
        };



        // Get APT metadata (official APT FA metadata address on all networks)
        let apt_metadata = object::address_to_object<fa::Metadata>(@0xa);
        
        // Create market authority (resource account for controlling APT)
        let (market_signer, market_signer_cap) = account::create_resource_account(
            creator,
            market_seed(b"prediction_market", market_id)
        );

        // Back the initial redeemable outcome token inventory.
        //
        // Exactly one side resolves in a binary market, so collateral must
        // cover the larger of the initial YES and NO reserve supplies.
        let initial_required_collateral =
            if (required_x_yes >= required_y_no) {
                required_x_yes
            } else {
                required_y_no
            };

        if (initial_required_collateral > 0) {
            let market_authority_addr = signer::address_of(&market_signer);

            pfs::transfer(
                creator,
                apt_metadata,
                market_authority_addr,
                initial_required_collateral
            );
        };

        
        // Initialize dynamic tracking against the same timestamp at which
        // trading and dynamic liquidity decay begin.
        if (is_dynamic) {
            let trading_start_timestamp =
                *option::borrow(&liquidity_period_ends_at);

            dynamic_tracking::initialize_dynamic_tracking(
                &market_signer,
                total_pool_value,
                trading_start_timestamp
            );
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

        // Seed the creator's initial LP position.
        //
        // The internal LP accounting balance and the actual LP fungible-asset
        // balance must remain aligned because remove_liquidity burns LP assets.
        let initial_lp_supply = pool_state::get_lp_supply(&m.pool);

        if (initial_lp_supply > 0) {
            let initial_lp_tokens =
                fa::mint(&m.lp_mint_ref, (initial_lp_supply as u64));

            let creator_lp_store =
                pfs::ensure_primary_store_exists(owner, m.lp_metadata);

            fa::deposit_with_ref(
                &m.lp_transfer_ref,
                creator_lp_store,
                initial_lp_tokens
            );

            let acc = load_lp_acc(&mut m.lp_accounts, owner);
            acc.lp_balance += initial_lp_supply;
        };

        // persist + event
        let question_copy = m.question;
        event::emit_event(&mut m.ev_created, MarketCreatedEvent {
            market_id, creator: owner, question: question_copy, expires_at, initial_probability_raw: fixed_point::raw_value(&initial_probability), fee_bps
        });
        move_to(&market_signer, m);

        vector::push_back(&mut reg.markets, market_id);
        vector::push_back(&mut reg.active_markets, market_id);
        reg.total_markets_created = reg.total_markets_created + 1;

        market_id
    }

    // ===== Collateral Operations =====
    
    /// Deposit APT collateral to mint matched YES and NO outcome units.
    ///
    /// Raw-unit invariant:
    ///   octa_amount APT units -> octa_amount YES units
    ///                         + octa_amount NO units
    ///
    /// APT and outcome assets use 8 decimals, so:
    ///   1 APT -> 1 YES + 1 NO
    public fun mint_prediction_tokens<YesToken, NoToken>(
        user: &signer, market_addr: address, octa_amount: u64
    ) acquires PredictionMarket {
        assert!(exists<PredictionMarket<YesToken, NoToken>>(market_addr), E_MARKET_NOT_FOUND);
        assert!(octa_amount >=100, E_ZERO);

        let m = borrow_global_mut<PredictionMarket<YesToken, NoToken>>(market_addr);
        assert!(!m.resolved, E_MARKET_ALREADY_RESOLVED);
        assert!(timestamp::now_seconds() < m.expires_at, E_MARKET_EXPIRED);

        let user_addr = signer::address_of(user);
        
        //  Transfer APT from user to market's authority account (PRODUCTION READY)
        let market_signer = account::create_signer_with_capability(&m.market_signer_cap);
        let market_authority_addr = signer::address_of(&market_signer);
        pfs::transfer(user, m.apt_metadata, market_authority_addr, octa_amount);
        
        
        let token_amount = octa_amount ;

        //  Mint YES tokens 
        let yes_tokens = fa::mint(&m.yes_mint_ref, token_amount);
        let user_yes_store = pfs::ensure_primary_store_exists(user_addr, m.yes_metadata);
        fa::deposit_with_ref(&m.yes_transfer_ref, user_yes_store, yes_tokens);
        
        // Mint NO tokens  
        let no_tokens = fa::mint(&m.no_mint_ref, token_amount);
        let user_no_store = pfs::ensure_primary_store_exists(user_addr, m.no_metadata);
        fa::deposit_with_ref(&m.no_transfer_ref, user_no_store, no_tokens);
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
        /// Returns whether this prediction market uses dynamic liquidity.
    public fun is_dynamic_market<YesToken, NoToken>(
        market_addr: address
    ): bool acquires PredictionMarket {
        assert!(
            exists<PredictionMarket<YesToken, NoToken>>(market_addr),
            E_MARKET_NOT_FOUND
        );

        let m = borrow_global<PredictionMarket<YesToken, NoToken>>(market_addr);
        pool_state::is_dynamic(&m.pool)
    }
    
    /// Get APT metadata object (helper function)
    public fun apt_metadata(): Object<fa::Metadata> {
        object::address_to_object<fa::Metadata>(@0xa)
    }  

    /// Quote a prediction-market swap using the market's embedded pool.
    ///
    /// YES = X and NO = Y:
    /// - is_x_to_y = true  => YES -> NO
    /// - is_x_to_y = false => NO -> YES
    ///
    /// The validation mirrors buy_yes / buy_no so the quote represents
    /// an executable trade under the current market phase.
    public fun get_swap_quote<YesToken, NoToken>(
        market_addr: address,
        amount_in: u64,
        is_x_to_y: bool
    ): (u64, FixedPoint128) acquires PredictionMarket {
        assert!(
            exists<PredictionMarket<YesToken, NoToken>>(market_addr),
            E_MARKET_NOT_FOUND
        );
        assert!(amount_in > 0, E_ZERO);

        let m = borrow_global<PredictionMarket<YesToken, NoToken>>(market_addr);

        assert!(!m.resolved, E_MARKET_ALREADY_RESOLVED);
        assert!(timestamp::now_seconds() < m.expires_at, E_MARKET_EXPIRED);

        // Dynamic markets are quoteable only once their trading phase begins,
        // exactly like buy_yes / buy_no.
        if (pool_state::is_dynamic(&m.pool)) {
            if (option::is_some(&m.liquidity_period_ends_at)) {
                let liquidity_deadline = *option::borrow(&m.liquidity_period_ends_at);
                assert!(
                    timestamp::now_seconds() >= liquidity_deadline,
                    E_LIQUIDITY_PERIOD_ENDED
                );
            };
        };

        pool_state::get_swap_quote_direct(
            &m.pool,
            amount_in,
            is_x_to_y
        )
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
                assert!(
                    timestamp::now_seconds() >= liquidity_deadline,
                    E_LIQUIDITY_PERIOD_ENDED
                );
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
        
        
        
        // 7) Update stats and emit event
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
                assert!(
                    timestamp::now_seconds() >= liquidity_deadline,
                    E_LIQUIDITY_PERIOD_ENDED
                );
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
    

    public fun add_pretrade_liquidity<YesToken, NoToken>(
        provider: &signer, 
        market_addr: address, 
        lp_value_contribution: FixedPoint128
    ) acquires PredictionMarket {
        assert!(exists<PredictionMarket<YesToken, NoToken>>(market_addr), E_MARKET_NOT_FOUND);
        assert!(fixed_point::greater_than(&lp_value_contribution, &fixed_point::zero()), E_ZERO);
        
        let who = signer::address_of(provider);
        let m = borrow_global_mut<PredictionMarket<YesToken, NoToken>>(market_addr);
        
        // Basic market state validations
        assert!(!m.resolved, E_MARKET_ALREADY_RESOLVED);
        assert!(timestamp::now_seconds() < m.expires_at, E_MARKET_EXPIRED);
        
        // Ensure this is a dynamic pool
        assert!(pool_state::is_dynamic(&m.pool), E_NOT_DYNAMIC_POOL);
        
        // Check that we're still in the liquidity period (trading hasn't started)
        let is_market_active = if (option::is_some(&m.liquidity_period_ends_at)) {
            let liquidity_deadline = *option::borrow(&m.liquidity_period_ends_at);
            timestamp::now_seconds() >= liquidity_deadline
        } else {
            false // No deadline set, market not active yet
        };
        assert!(!is_market_active, E_TRADING_ALREADY_STARTED);
        
        // Call the pool state function to calculate required tokens and update pool
        let outcome = pool_state::add_pretrade_liquidity(&mut m.pool, &lp_value_contribution, is_market_active);
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

        // Deposit tokens to reserves (pool math already updated reserves, this syncs FA stores)
        fa::deposit_with_ref(&m.yes_transfer_ref, m.yes_reserve, yes_tokens);
        fa::deposit_with_ref(&m.no_transfer_ref, m.no_reserve, no_tokens);

        // Mint LP tokens to provider
        let lp_tokens = fa::mint(&m.lp_mint_ref, (minted_lp as u64));
        let provider_lp_store = pfs::ensure_primary_store_exists(who, m.lp_metadata);
        fa::deposit_with_ref(&m.lp_transfer_ref, provider_lp_store, lp_tokens);

        // Update LP accounting
        let acc = load_lp_acc(&mut m.lp_accounts, who);
        acc.lp_balance = acc.lp_balance + minted_lp;
        // Note: Pool already updated its lp_token_supply via pool_state::add_pretrade_liquidity
    }
   

    /// Remove liquidity and burn LP tokens.
    ///
    /// Live static markets use ordinary proportional AMM removal.
    /// Resolved markets use terminal reserve withdrawal because the AMM no
    /// longer prices trades after resolution.
    ///
    /// Dynamic markets are removable only after resolution.
    public fun remove_liquidity<YesToken, NoToken>(
        provider: &signer,
        market_addr: address,
        lp_to_burn: u128
    ) acquires PredictionMarket {
        assert!(
            exists<PredictionMarket<YesToken, NoToken>>(market_addr),
            E_MARKET_NOT_FOUND
        );

        let who = signer::address_of(provider);
        let m = borrow_global_mut<PredictionMarket<YesToken, NoToken>>(market_addr);

        assert!(lp_to_burn > 0, E_ZERO);

        let is_dynamic = pool_state::is_dynamic(&m.pool);

        // Dynamic liquidity remains locked while the market is live.
        if (is_dynamic) {
            assert!(m.resolved, E_DYNAMIC_LP_REMOVAL_BEFORE_RESOLUTION);
        };

        let acc = load_lp_acc(&mut m.lp_accounts, who);
        assert!(acc.lp_balance >= lp_to_burn, E_INSUFF_LP);

        let total_lp_supply = pool_state::get_lp_supply(&m.pool);
        assert!(total_lp_supply > 0, E_INSUFF_LP);
        assert!(lp_to_burn <= total_lp_supply, E_INSUFF_LP);

        let lp_ratio = fixed_point::from_fraction(
            lp_to_burn as u64,
            total_lp_supply as u64
        );

        // Fee vaults are distributed according to the LP amount being burned.
        let total_yes_fees = fa::balance(m.yes_fee_vault);
        let total_no_fees = fa::balance(m.no_fee_vault);

        let yes_fee_share = fixed_point::mul(
            &fixed_point::from_u64(total_yes_fees),
            &lp_ratio
        );
        let no_fee_share = fixed_point::mul(
            &fixed_point::from_u64(total_no_fees),
            &lp_ratio
        );

        let yes_fees_to_claim = fixed_point::to_u64(&yes_fee_share);
        let no_fees_to_claim = fixed_point::to_u64(&no_fee_share);

        let provider_yes_store =
            pfs::ensure_primary_store_exists(who, m.yes_metadata);
        let provider_no_store =
            pfs::ensure_primary_store_exists(who, m.no_metadata);

        if (yes_fees_to_claim > 0) {
            let yes_fees = fa::withdraw_with_ref(
                &m.yes_transfer_ref,
                m.yes_fee_vault,
                yes_fees_to_claim
            );
            fa::deposit_with_ref(
                &m.yes_transfer_ref,
                provider_yes_store,
                yes_fees
            );
        };

        if (no_fees_to_claim > 0) {
            let no_fees = fa::withdraw_with_ref(
                &m.no_transfer_ref,
                m.no_fee_vault,
                no_fees_to_claim
            );
            fa::deposit_with_ref(
                &m.no_transfer_ref,
                provider_no_store,
                no_fees
            );
        };

        // A resolved market is terminal. Withdraw proportional physical
        // reserves directly rather than invoking live AMM liquidity math.
        let (yes_out_amount, no_out_amount) = if (m.resolved) {
            pool_state::remove_liquidity_after_resolution_direct(
                &mut m.pool,
                lp_to_burn
            )
        } else {
            pool_state::remove_liquidity_proportional_direct(
                &mut m.pool,
                lp_to_burn
            )
        };

        acc.lp_balance = acc.lp_balance - lp_to_burn;

        let provider_lp_store = pfs::primary_store(who, m.lp_metadata);
        let lp_tokens = fa::withdraw(
            provider,
            provider_lp_store,
            lp_to_burn as u64
        );
        fa::burn(&m.lp_burn_ref, lp_tokens);

        if (yes_out_amount > 0) {
            let yes_out = fa::withdraw_with_ref(
                &m.yes_transfer_ref,
                m.yes_reserve,
                yes_out_amount
            );
            fa::deposit_with_ref(
                &m.yes_transfer_ref,
                provider_yes_store,
                yes_out
            );
        };

        if (no_out_amount > 0) {
            let no_out = fa::withdraw_with_ref(
                &m.no_transfer_ref,
                m.no_reserve,
                no_out_amount
            );
            fa::deposit_with_ref(
                &m.no_transfer_ref,
                provider_no_store,
                no_out
            );
        };
    }

    /// Check if trading can begin for dynamic pool 
    public fun can_start_trading<YesToken, NoToken>(market_addr: address): bool acquires PredictionMarket {
        if (!exists<PredictionMarket<YesToken, NoToken>>(market_addr)) {
            return false
        };
        
        let m = borrow_global<PredictionMarket<YesToken, NoToken>>(market_addr);
        
        // Only applies to dynamic pools
        if (!pool_state::is_dynamic(&m.pool)) {
            return true // Static pools can always trade
        };
        
        // Check if liquidity period has ended
        if (option::is_some(&m.liquidity_period_ends_at)) {
            let liquidity_deadline = *option::borrow(&m.liquidity_period_ends_at);
            timestamp::now_seconds() >= liquidity_deadline
        } else {
            true // No liquidity period set
        }
    }

    /// Get liquidity period end time for dynamic pools
    public fun get_liquidity_period_end<YesToken, NoToken>(market_addr: address): Option<u64> acquires PredictionMarket {
        assert!(exists<PredictionMarket<YesToken, NoToken>>(market_addr), E_MARKET_NOT_FOUND);
        let m = borrow_global<PredictionMarket<YesToken, NoToken>>(market_addr);
        m.liquidity_period_ends_at
    }

        /// Frontend runtime configuration for a prediction market.
    ///
    /// Returns:
    /// - whether the market uses dynamic liquidity,
    /// - swap fee in basis points,
    /// - dynamic pretrade liquidity deadline, if one exists.
    public fun get_market_runtime_config<YesToken, NoToken>(
        market_addr: address
    ): (bool, u16, Option<u64>) acquires PredictionMarket {
        assert!(
            exists<PredictionMarket<YesToken, NoToken>>(market_addr),
            E_MARKET_NOT_FOUND
        );

        let m = borrow_global<PredictionMarket<YesToken, NoToken>>(market_addr);

        (
            pool_state::is_dynamic(&m.pool),
            m.fee_bps,
            m.liquidity_period_ends_at
        )
    }


    /// Complete position settlement after market resolution 
    public fun settle_tokens_with_collateral<YesToken, NoToken>(
        holder: &signer, market_addr: address, yes_amount: u64, no_amount: u64
    ) acquires PredictionMarket {
        assert!(exists<PredictionMarket<YesToken, NoToken>>(market_addr), E_MARKET_NOT_FOUND);
        assert!(yes_amount > 0 || no_amount > 0, E_ZERO);
        
        let m = borrow_global_mut<PredictionMarket<YesToken, NoToken>>(market_addr);
        assert!(m.resolved, E_MARKET_NOT_RESOLVED);
        
        let holder_addr = signer::address_of(holder);
        let winning_outcome = *option::borrow(&m.outcome_yes);
        
        // Withdraw ALL tokens user wants to settle
        let holder_yes_store = pfs::primary_store(holder_addr, m.yes_metadata);
        let holder_no_store = pfs::primary_store(holder_addr, m.no_metadata);
        
        let yes_tokens = if (yes_amount > 0) {
            fa::withdraw(holder, holder_yes_store, yes_amount)
        } else {
            fa::zero(m.yes_metadata)
        };
        let no_tokens = if (no_amount > 0) {
            fa::withdraw(holder, holder_no_store, no_amount)
        } else {
            fa::zero(m.no_metadata)
        };
        
        // Calculate payout: only winning tokens have value (1 token = 1 APT)
        let winning_token_count = if (winning_outcome) { yes_amount } else { no_amount };
        let octa_payout = winning_token_count ;
        
        // Burn ALL tokens (winners + losers) for complete position settlement
        fa::burn(&m.yes_burn_ref, yes_tokens);
        fa::burn(&m.no_burn_ref, no_tokens);
        
        // Pay out APT collateral for winning tokens only
        if (octa_payout > 0) {
            let market_signer = account::create_signer_with_capability(&m.market_signer_cap);
            pfs::transfer(&market_signer, m.apt_metadata, holder_addr, octa_payout);
        };
    }

    // ===== Resolution =====
    public fun resolve_market<YesToken, NoToken>(
        resolver: &signer, market_addr: address, outcome_yes: bool
    ) acquires PredictionMarket, MarketRegistry {
        assert!(exists<PredictionMarket<YesToken, NoToken>>(market_addr), E_MARKET_NOT_FOUND);

        let raddr = signer::address_of(resolver);
        let m = borrow_global_mut<PredictionMarket<YesToken, NoToken>>(market_addr);

        assert!(!m.resolved, E_MARKET_ALREADY_RESOLVED);
        assert!(timestamp::now_seconds() >= m.expires_at, E_MARKET_NOT_EXPIRED);
        assert!(raddr == m.creator, E_NOT_AUTHORIZED); // V1: only creator can resolve

        m.resolved = true;
        m.resolved_at = option::some(timestamp::now_seconds());
        m.outcome_yes = option::some(outcome_yes);

        event::emit_event(&mut m.ev_resolve, ResolutionEvent {
            market_id: m.market_id, resolver: raddr, outcome_yes, timestamp: timestamp::now_seconds(),
        });

        let reg = borrow_global_mut<MarketRegistry>(m.creator);
        reg.total_markets_resolved = reg.total_markets_resolved + 1;

        
    }

    // ===== Views =====
    public fun get_current_probability<YesToken, NoToken>(market_addr: address): FixedPoint128
    acquires PredictionMarket {
        assert!(exists<PredictionMarket<YesToken, NoToken>>(market_addr), E_MARKET_NOT_FOUND);
        let m = borrow_global_mut<PredictionMarket<YesToken, NoToken>>(market_addr);
        pool_state::get_spot_price_direct(&mut m.pool)
    }

    /// Legacy analytics endpoint retained for API compatibility.
    ///
    /// The previous implementation exposed synthetic automatic-withdrawal
    /// accounting that was not synchronized with physical pool reserves.
    /// Automatic withdrawals are not an executable feature of the repaired
    /// settlement path. Return zero synthetic analytics rather than exposing
    /// unbacked or aborting values.
    public fun get_lp_loss_analytics<YesToken, NoToken>(
        market_addr: address,
        _lp_address: address,
        _lp_tokens: u128
    ): (FixedPoint128, FixedPoint128, FixedPoint128, FixedPoint128)
    {
        assert!(
            exists<PredictionMarket<YesToken, NoToken>>(market_addr),
            E_MARKET_NOT_FOUND
        );

        let zero = fixed_point::zero();
        (zero, zero, zero, zero)
    }

    /// Return executable terminal settlement information for a resolved LP
    /// position.
    ///
    /// Automatic lifetime withdrawals are not part of the repaired settlement
    /// model, so total_withdrawn is zero. Settlement equals the winning-token
    /// portion of the exact remove-liquidity preview, including fee-vault
    /// distributions. Historical loss is not tracked per LP and is returned
    /// as zero rather than fabricated.
    public fun get_final_settlement_with_loss<YesToken, NoToken>(
        market_addr: address,
        _lp_address: address,
        lp_tokens: u128
    ): (FixedPoint128, FixedPoint128, FixedPoint128)
    acquires PredictionMarket {
        assert!(
            exists<PredictionMarket<YesToken, NoToken>>(market_addr),
            E_MARKET_NOT_FOUND
        );

        let m = borrow_global<PredictionMarket<YesToken, NoToken>>(market_addr);
        assert!(m.resolved, E_MARKET_NOT_RESOLVED);

        let outcome_yes = *option::borrow(&m.outcome_yes);

        let (yes_out, no_out) =
            preview_remove_liquidity<YesToken, NoToken>(
                market_addr,
                lp_tokens
            );

        let winning_tokens = if (outcome_yes) {
            yes_out
        } else {
            no_out
        };

        (
            fixed_point::zero(),
            fixed_point::from_u64(winning_tokens),
            fixed_point::zero()
        )
    }

    /// Preview add liquidity using the same path that public execution uses.
    ///
    /// Static markets preview normal PM-AMM liquidity addition.
    /// Dynamic markets preview pretrade addition only while trading is inactive.
    public fun preview_add_liquidity<YesToken, NoToken>(
        market_addr: address,
        desired_value_increase: FixedPoint128
    ): (u64, u64, u128, FixedPoint128) acquires PredictionMarket {
        assert!(
            exists<PredictionMarket<YesToken, NoToken>>(market_addr),
            E_MARKET_NOT_FOUND
        );
        assert!(
            fixed_point::greater_than(&desired_value_increase, &fixed_point::zero()),
            E_ZERO
        );

        let m = borrow_global_mut<PredictionMarket<YesToken, NoToken>>(market_addr);
        assert!(!m.resolved, E_MARKET_ALREADY_RESOLVED);
        assert!(timestamp::now_seconds() < m.expires_at, E_MARKET_EXPIRED);

        let outcome = if (pool_state::is_dynamic(&m.pool)) {
            let is_market_active = if (option::is_some(&m.liquidity_period_ends_at)) {
                let liquidity_deadline = *option::borrow(&m.liquidity_period_ends_at);
                timestamp::now_seconds() >= liquidity_deadline
            } else {
                false
            };

            assert!(!is_market_active, E_TRADING_ALREADY_STARTED);

            pool_state::preview_pretrade_liquidity(
                &m.pool,
                &desired_value_increase,
                is_market_active
            )
        } else {
            let current_price = pool_state::get_spot_price_direct(&mut m.pool);

            pool_state::preview_add_liquidity_direct(
                &m.pool,
                &desired_value_increase,
                &current_price
            )
        };

        let required_x = pool_state::get_actual_x(&outcome);
        let required_y = pool_state::get_actual_y(&outcome);
        let minted_lp = pool_state::get_minted_lp(&outcome);

        let current_lp_supply = pool_state::get_lp_supply(&m.pool);
        let total_lp_after = current_lp_supply + minted_lp;
        let share_of_pool = if (total_lp_after > 0) {
            fixed_point::from_fraction(
                minted_lp as u64,
                total_lp_after as u64
            )
        } else {
            fixed_point::zero()
        };

        (required_x, required_y, minted_lp, share_of_pool)
    }

    /// Preview remove liquidity without executing.
    ///
    /// Returns the exact YES and NO amounts transferred by remove_liquidity:
    ///
    ///     proportional reserve withdrawal + proportional accumulated fee share
    ///
    /// Dynamic pools are withdrawable only after resolution, matching execution.
    public fun preview_remove_liquidity<YesToken, NoToken>(
        market_addr: address,
        lp_tokens_to_burn: u128
    ): (u64, u64) acquires PredictionMarket {
        assert!(
            exists<PredictionMarket<YesToken, NoToken>>(market_addr),
            E_MARKET_NOT_FOUND
        );
        assert!(lp_tokens_to_burn > 0, E_ZERO);

        let m = borrow_global<PredictionMarket<YesToken, NoToken>>(market_addr);

        if (pool_state::is_dynamic(&m.pool)) {
            assert!(m.resolved, E_DYNAMIC_LP_REMOVAL_BEFORE_RESOLUTION);
        };

        let (reserve_x, reserve_y) = pool_state::get_reserves(&m.pool);
        let lp_supply = pool_state::get_lp_supply(&m.pool);

        assert!(lp_supply > 0, E_INSUFF_LP);
        assert!(lp_tokens_to_burn <= lp_supply, E_INSUFF_LP);

        let reserve_yes_out = if (lp_tokens_to_burn == lp_supply) {
            reserve_x
        } else {
            (
                ((reserve_x as u128) * lp_tokens_to_burn)
                    / lp_supply
            ) as u64
        };

        let reserve_no_out = if (lp_tokens_to_burn == lp_supply) {
            reserve_y
        } else {
            (
                ((reserve_y as u128) * lp_tokens_to_burn)
                    / lp_supply
            ) as u64
        };

        // Mirror remove_liquidity fee distribution exactly.
        let lp_ratio = fixed_point::from_fraction(
            lp_tokens_to_burn as u64,
            lp_supply as u64
        );

        let total_yes_fees = fa::balance(m.yes_fee_vault);
        let total_no_fees = fa::balance(m.no_fee_vault);

        let yes_fee_share = fixed_point::mul(
            &fixed_point::from_u64(total_yes_fees),
            &lp_ratio
        );
        let no_fee_share = fixed_point::mul(
            &fixed_point::from_u64(total_no_fees),
            &lp_ratio
        );

        let yes_fees_out = fixed_point::to_u64(&yes_fee_share);
        let no_fees_out = fixed_point::to_u64(&no_fee_share);

        (
            reserve_yes_out + yes_fees_out,
            reserve_no_out + no_fees_out
        )
    }

    /// Get user's LP position.
    ///
    /// A user who has never received LP tokens does not yet have a primary
    /// fungible store for this market's LP asset. That is a valid zero-position
    /// state and must return zero rather than abort.
    public fun get_user_lp_position<YesToken, NoToken>(
        user_addr: address,
        market_addr: address
    ): (u64, FixedPoint128, u64, u64) acquires PredictionMarket {
        assert!(
            exists<PredictionMarket<YesToken, NoToken>>(market_addr),
            E_MARKET_NOT_FOUND
        );

        let m = borrow_global<PredictionMarket<YesToken, NoToken>>(market_addr);

        let user_lp_tokens = if (pfs::primary_store_exists(user_addr, m.lp_metadata)) {
            let lp_store = pfs::primary_store(user_addr, m.lp_metadata);
            fa::balance(lp_store)
        } else {
            0
        };

        let total_lp_supply = pool_state::get_lp_supply(&m.pool);

        let share_of_pool = if (total_lp_supply > 0) {
            fixed_point::from_fraction(
                user_lp_tokens,
                total_lp_supply as u64
            )
        } else {
            fixed_point::zero()
        };

        let (reserve_x, reserve_y) = pool_state::get_reserves(&m.pool);

        let user_yes_value = if (total_lp_supply > 0) {
            (
                ((reserve_x as u128) * (user_lp_tokens as u128))
                    / total_lp_supply
            ) as u64
        } else {
            0
        };

        let user_no_value = if (total_lp_supply > 0) {
            (
                ((reserve_y as u128) * (user_lp_tokens as u128))
                    / total_lp_supply
            ) as u64
        } else {
            0
        };

        (
            user_lp_tokens,
            share_of_pool,
            user_yes_value,
            user_no_value
        )
    }

    #[test_only]
    public fun authority_apt_balance_for_test<YesToken, NoToken>(
        market_addr: address
    ): u64 acquires PredictionMarket {
        assert!(exists<PredictionMarket<YesToken, NoToken>>(market_addr), E_MARKET_NOT_FOUND);
        let m = borrow_global<PredictionMarket<YesToken, NoToken>>(market_addr);
        let market_signer = account::create_signer_with_capability(&m.market_signer_cap);
        pfs::balance(signer::address_of(&market_signer), m.apt_metadata)
    }

    #[test_only]
    public fun lp_supply_for_test<YesToken, NoToken>(
        market_addr: address
    ): u128 acquires PredictionMarket {
        assert!(exists<PredictionMarket<YesToken, NoToken>>(market_addr), E_MARKET_NOT_FOUND);
        let m = borrow_global<PredictionMarket<YesToken, NoToken>>(market_addr);
        pool_state::get_lp_supply(&m.pool)
    }

    #[test_only]
    public fun internal_lp_balance_for_test<YesToken, NoToken>(
        user_addr: address,
        market_addr: address
    ): u128 acquires PredictionMarket {
        assert!(exists<PredictionMarket<YesToken, NoToken>>(market_addr), E_MARKET_NOT_FOUND);
        let m = borrow_global<PredictionMarket<YesToken, NoToken>>(market_addr);
        if (atable::contains(&m.lp_accounts, user_addr)) {
            atable::borrow(&m.lp_accounts, user_addr).lp_balance
        } else {
            0
        }
    }

    #[test_only]
    public fun effective_liquidity_for_test<YesToken, NoToken>(
        market_addr: address
    ): FixedPoint128 acquires PredictionMarket {
        assert!(
            exists<PredictionMarket<YesToken, NoToken>>(market_addr),
            E_MARKET_NOT_FOUND
        );

        let m = borrow_global<PredictionMarket<YesToken, NoToken>>(market_addr);
        pool_state::get_liquidity_parameter(&m.pool)
    }

    #[test_only]
    public fun lp_asset_balance_for_test<YesToken, NoToken>(
        user_addr: address,
        market_addr: address
    ): u64 acquires PredictionMarket {
        assert!(exists<PredictionMarket<YesToken, NoToken>>(market_addr), E_MARKET_NOT_FOUND);
        let m = borrow_global<PredictionMarket<YesToken, NoToken>>(market_addr);
        if (pfs::primary_store_exists(user_addr, m.lp_metadata)) {
            let lp_store = pfs::primary_store(user_addr, m.lp_metadata);
            fa::balance(lp_store)
        } else {
            0
        }
    }

}