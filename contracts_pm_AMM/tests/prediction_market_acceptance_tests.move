#[test_only]
module pm_amm::prediction_market_acceptance_tests {
    use std::signer;
    use std::string;
    use std::option;

    use aptos_framework::account;
    use aptos_framework::aptos_coin;
    use aptos_framework::primary_fungible_store;
    use aptos_framework::timestamp;

    use pm_amm::fixed_point;
    use pm_amm::pm_amm;
    use pm_amm::prediction_market;

    const E_AUTHORITY_COLLATERAL_MISMATCH: u64 = 1;
    const E_INITIAL_LP_SUPPLY_ZERO: u64 = 2;
    const E_INTERNAL_LP_MISMATCH: u64 = 3;
    const E_LP_ASSET_MISMATCH: u64 = 4;
    const E_EXPECTED_SWAP_OUTPUT: u64 = 5;
    const E_SETTLEMENT_PAYOUT_MISMATCH: u64 = 6;
    const E_SECOND_MARKET_MISSING: u64 = 7;
    const E_QUOTE_EXECUTION_MISMATCH: u64 = 8;
    const E_ADD_LIQ_BALANCE_MISMATCH: u64 = 9;
    const E_ADD_LIQ_LP_MISMATCH: u64 = 10;
    const E_DYNAMIC_L_DECAYED_DURING_PRETRADE: u64 = 11;
    const E_DYNAMIC_TRADING_NOT_ACTIVE_AT_DEADLINE: u64 = 12;
    const E_DYNAMIC_L_DID_NOT_DECAY_AFTER_START: u64 = 13;
    const E_DYNAMIC_SWAP_OUTPUT_ZERO: u64 = 14;
    const E_DYNAMIC_REMOVE_PREVIEW_MISMATCH: u64 = 15;
    const E_DYNAMIC_LP_NOT_BURNED: u64 = 16;
    const E_DYNAMIC_WINNING_TOKENS_NOT_REDEEMABLE: u64 = 17;
    const E_REMOVE_PREVIEW_FEE_MISMATCH: u64 = 18;
    const E_RUNTIME_CONFIG_DYNAMIC_MISMATCH: u64 = 19;
    const E_RUNTIME_CONFIG_FEE_MISMATCH: u64 = 20;
    const E_RUNTIME_CONFIG_DEADLINE_MISSING: u64 = 21;

    const FUND_AMOUNT: u64 = 100_000_000_000;
    const INITIAL_POOL_VALUE: u64 = 1_000_000_000;
    const ONE_APT: u64 = 100_000_000;
    const SWAP_AMOUNT: u64 = 1_000;
    const MARKET_DURATION_SECS: u64 = 10;
    const FEE_BPS: u16 = 30;
    const ADD_LIQ_VALUE: u64 = 50_000;
    const FEE_GENERATING_SWAP_AMOUNT: u64 = 100_000;

    struct TestYes has drop {}
    struct TestNo has drop {}
    struct TestCollateral has drop {}

    fun setup(
        aptos_framework: &signer,
        creator: &signer,
        user: &signer
    ) {
        timestamp::set_time_has_started_for_testing(aptos_framework);
        if (timestamp::now_seconds() == 0) {
            timestamp::update_global_time_for_test_secs(1);
        };
        aptos_coin::ensure_initialized_with_apt_fa_metadata_for_test();

        account::create_account_for_test(signer::address_of(creator));
        account::create_account_for_test(signer::address_of(user));

        primary_fungible_store::deposit(
            signer::address_of(creator),
            aptos_coin::mint_apt_fa_for_test(FUND_AMOUNT)
        );
        primary_fungible_store::deposit(
            signer::address_of(user),
            aptos_coin::mint_apt_fa_for_test(FUND_AMOUNT)
        );
    }

    fun create_test_market(creator: &signer): address {
        let market_addr = prediction_market::next_market_address(signer::address_of(creator));
        let expires_at = timestamp::now_seconds() + MARKET_DURATION_SECS;
        prediction_market::create_market<TestYes, TestNo, TestCollateral>(
            creator,
            string::utf8(b"Will acceptance tests pass?"),
            string::utf8(b"Acceptance test market"),
            string::utf8(b"Testing"),
            expires_at,
            fixed_point::from_fraction(3, 5),
            fixed_point::from_u64(INITIAL_POOL_VALUE),
            FEE_BPS,
            false
        );
        market_addr
    }

    fun create_second_test_market(creator: &signer): address {
        let market_addr = prediction_market::next_market_address(signer::address_of(creator));
        let expires_at = timestamp::now_seconds() + MARKET_DURATION_SECS;
        prediction_market::create_market<TestYes, TestNo, TestCollateral>(
            creator,
            string::utf8(b"Will a second market be created?"),
            string::utf8(b"Second acceptance test market"),
            string::utf8(b"Testing"),
            expires_at,
            fixed_point::from_fraction(1, 2),
            fixed_point::from_u64(INITIAL_POOL_VALUE),
            FEE_BPS,
            false
        );
        market_addr
    }

        fun create_dynamic_test_market(creator: &signer): address {
        let market_addr =
            prediction_market::next_market_address(signer::address_of(creator));
        let expires_at = timestamp::now_seconds() + 600;

        prediction_market::create_market<TestYes, TestNo, TestCollateral>(
            creator,
            string::utf8(b"Will dynamic liquidity preview match execution?"),
            string::utf8(b"Dynamic acceptance test market"),
            string::utf8(b"Testing"),
            expires_at,
            fixed_point::from_fraction(3, 5),
            fixed_point::from_u64(INITIAL_POOL_VALUE),
            FEE_BPS,
            true
        );

        market_addr
    }

    fun max_u64(a: u64, b: u64): u64 {
        if (a >= b) { a } else { b }
    }

    #[test(
        aptos_framework = @aptos_framework,
        creator = @0xCAFE,
        user = @0xBEEF
    )]
    fun initial_amm_reserves_are_backed(
        aptos_framework: &signer,
        creator: &signer,
        user: &signer
    ) {
        setup(aptos_framework, creator, user);
        let market_addr = create_test_market(creator);

        let (yes_reserve, no_reserve) =
            prediction_market::get_market_reserves<TestYes, TestNo>(market_addr);
        let authority_apt =
            prediction_market::authority_apt_balance_for_test<TestYes, TestNo>(market_addr);

        assert!(
            authority_apt == max_u64(yes_reserve, no_reserve),
            E_AUTHORITY_COLLATERAL_MISMATCH
        );
    }

    #[test(
        aptos_framework = @aptos_framework,
        creator = @0xCAFE,
        user = @0xBEEF
    )]
    fun same_creator_can_create_multiple_markets(
        aptos_framework: &signer,
        creator: &signer,
        user: &signer
    ) {
        setup(aptos_framework, creator, user);
        let market_addr = create_test_market(creator);
        let second_market_addr = create_second_test_market(creator);

        assert!(
            prediction_market::market_exists<TestYes, TestNo>(market_addr),
            E_SECOND_MARKET_MISSING
        );
        assert!(
            prediction_market::market_exists<TestYes, TestNo>(second_market_addr),
            E_SECOND_MARKET_MISSING
        );
    }

    

        #[test(
        aptos_framework = @aptos_framework,
        creator = @0xCAFE,
        user = @0xBEEF
    )]
    fun dynamic_liquidity_decay_starts_only_when_trading_starts(
        aptos_framework: &signer,
        creator: &signer,
        user: &signer
    ) {
        setup(aptos_framework, creator, user);

        let market_addr = create_dynamic_test_market(creator);

        let initial_l =
            prediction_market::effective_liquidity_for_test<TestYes, TestNo>(
                market_addr
            );

        // Still inside the 300-second pretrade liquidity period.
        timestamp::fast_forward_seconds(299);

        let l_before_trading =
            prediction_market::effective_liquidity_for_test<TestYes, TestNo>(
                market_addr
            );

        assert!(
            fixed_point::equal(&initial_l, &l_before_trading),
            E_DYNAMIC_L_DECAYED_DURING_PRETRADE
        );

        // The exact deadline is now a valid trading start point.
        timestamp::fast_forward_seconds(1);

        assert!(
            prediction_market::can_start_trading<TestYes, TestNo>(market_addr),
            E_DYNAMIC_TRADING_NOT_ACTIVE_AT_DEADLINE
        );

        let l_at_trading_start =
            prediction_market::effective_liquidity_for_test<TestYes, TestNo>(
                market_addr
            );

        assert!(
            fixed_point::equal(&initial_l, &l_at_trading_start),
            E_DYNAMIC_L_DECAYED_DURING_PRETRADE
        );

        // Once trading time progresses, dynamic liquidity must decay.
        timestamp::fast_forward_seconds(1);

        let l_after_trading_start =
            prediction_market::effective_liquidity_for_test<TestYes, TestNo>(
                market_addr
            );

        assert!(
            fixed_point::less_than(&l_after_trading_start, &l_at_trading_start),
            E_DYNAMIC_L_DID_NOT_DECAY_AFTER_START
        );
    }

        #[test(
        aptos_framework = @aptos_framework,
        creator = @0xCAFE,
        user = @0xBEEF
    )]
    fun dynamic_swap_executes_at_trading_start(
        aptos_framework: &signer,
        creator: &signer,
        user: &signer
    ) {
        setup(aptos_framework, creator, user);

        let market_addr = create_dynamic_test_market(creator);
        let user_addr = signer::address_of(user);

        prediction_market::mint_prediction_tokens<TestYes, TestNo>(
            user,
            market_addr,
            ONE_APT
        );

        // Trading starts exactly at the 300-second liquidity deadline.
        timestamp::fast_forward_seconds(300);

        let (quoted_yes, _) =
            prediction_market::get_swap_quote<TestYes, TestNo>(
                market_addr,
                SWAP_AMOUNT,
                false
            );

        assert!(quoted_yes > 0, E_DYNAMIC_SWAP_OUTPUT_ZERO);

        prediction_market::buy_yes<TestYes, TestNo>(
            user,
            market_addr,
            SWAP_AMOUNT,
            quoted_yes
        );

        let (yes_balance, _) =
            prediction_market::get_user_balances<TestYes, TestNo>(
                user_addr,
                market_addr
            );

        assert!(yes_balance > ONE_APT, E_DYNAMIC_SWAP_OUTPUT_ZERO);
    }

        #[test(
        aptos_framework = @aptos_framework,
        creator = @0xCAFE,
        user = @0xBEEF
    )]
    fun dynamic_lp_removal_after_resolution_matches_preview_and_redeems(
        aptos_framework: &signer,
        creator: &signer,
        user: &signer
    ) {
        setup(aptos_framework, creator, user);

        let market_addr = create_dynamic_test_market(creator);
        let user_addr = signer::address_of(user);

        prediction_market::mint_prediction_tokens<TestYes, TestNo>(
            user,
            market_addr,
            ONE_APT
        );

        let contribution = fixed_point::from_u64(ADD_LIQ_VALUE);
        let contribution_raw = fixed_point::raw_value(&contribution);

        let (_, _, minted_lp, _) =
            prediction_market::preview_add_liquidity<TestYes, TestNo>(
                market_addr,
                contribution
            );

        assert!(minted_lp > 0, E_DYNAMIC_LP_NOT_BURNED);

        pm_amm::add_market_liquidity<TestYes, TestNo>(
            user,
            market_addr,
            contribution_raw
        );

        let internal_lp_before =
            prediction_market::internal_lp_balance_for_test<TestYes, TestNo>(
                user_addr,
                market_addr
            );

        assert!(internal_lp_before == minted_lp, E_DYNAMIC_LP_NOT_BURNED);

        // Dynamic test-market duration is 600 seconds:
        // 300 seconds pretrade, followed by 300 seconds live trading window.
        timestamp::fast_forward_seconds(600);

        prediction_market::resolve_market<TestYes, TestNo>(
            creator,
            market_addr,
            true
        );

        let (expected_yes_out, expected_no_out) =
            prediction_market::preview_remove_liquidity<TestYes, TestNo>(
                market_addr,
                minted_lp
            );

        assert!(expected_yes_out > 0, E_DYNAMIC_REMOVE_PREVIEW_MISMATCH);

        let (yes_before, no_before) =
            prediction_market::get_user_balances<TestYes, TestNo>(
                user_addr,
                market_addr
            );

        pm_amm::remove_market_liquidity<TestYes, TestNo>(
            user,
            market_addr,
            minted_lp
        );

        let (yes_after, no_after) =
            prediction_market::get_user_balances<TestYes, TestNo>(
                user_addr,
                market_addr
            );

        assert!(
            yes_after - yes_before == expected_yes_out
                && no_after - no_before == expected_no_out,
            E_DYNAMIC_REMOVE_PREVIEW_MISMATCH
        );

        let internal_lp_after =
            prediction_market::internal_lp_balance_for_test<TestYes, TestNo>(
                user_addr,
                market_addr
            );

        assert!(internal_lp_after == 0, E_DYNAMIC_LP_NOT_BURNED);

        // Winning YES tokens withdrawn from the resolved LP position must be
        // redeemable one-for-one against collateral.
        let apt_before =
            primary_fungible_store::balance(
                user_addr,
                prediction_market::apt_metadata()
            );

        prediction_market::settle_tokens_with_collateral<TestYes, TestNo>(
            user,
            market_addr,
            expected_yes_out,
            0
        );

        let apt_after =
            primary_fungible_store::balance(
                user_addr,
                prediction_market::apt_metadata()
            );

        assert!(
            apt_after - apt_before == expected_yes_out,
            E_DYNAMIC_WINNING_TOKENS_NOT_REDEEMABLE
        );
    }
    
    #[test(
        aptos_framework = @aptos_framework,
        creator = @0xCAFE,
        user = @0xBEEF
    )]

    fun dynamic_pretrade_add_liquidity_preview_matches_execution(
        aptos_framework: &signer,
        creator: &signer,
        user: &signer
    ) {
        setup(aptos_framework, creator, user);

        let market_addr = create_dynamic_test_market(creator);
        let user_addr = signer::address_of(user);

        prediction_market::mint_prediction_tokens<TestYes, TestNo>(
            user,
            market_addr,
            ONE_APT
        );

        let contribution = fixed_point::from_u64(ADD_LIQ_VALUE);
        let contribution_raw = fixed_point::raw_value(&contribution);

        let (required_yes, required_no, quoted_lp, _) =
            prediction_market::preview_add_liquidity<TestYes, TestNo>(
                market_addr,
                contribution
            );

        let (yes_before, no_before) =
            prediction_market::get_user_balances<TestYes, TestNo>(
                user_addr,
                market_addr
            );
        let (lp_before, _, _, _) =
            prediction_market::get_user_lp_position<TestYes, TestNo>(
                user_addr,
                market_addr
            );

        pm_amm::add_market_liquidity<TestYes, TestNo>(
            user,
            market_addr,
            contribution_raw
        );

        let (yes_after, no_after) =
            prediction_market::get_user_balances<TestYes, TestNo>(
                user_addr,
                market_addr
            );
        let (lp_after, _, _, _) =
            prediction_market::get_user_lp_position<TestYes, TestNo>(
                user_addr,
                market_addr
            );

        assert!(
            yes_before - yes_after == required_yes
                && no_before - no_after == required_no,
            E_ADD_LIQ_BALANCE_MISMATCH
        );
        assert!(
            lp_after - lp_before == (quoted_lp as u64),
            E_ADD_LIQ_LP_MISMATCH
        );
    }

        #[test(
        aptos_framework = @aptos_framework,
        creator = @0xCAFE,
        user = @0xBEEF
    )]
    fun dynamic_market_runtime_config_exposes_real_phase_data(
        aptos_framework: &signer,
        creator: &signer,
        user: &signer
    ) {
        setup(aptos_framework, creator, user);

        let market_addr = create_dynamic_test_market(creator);

        let (is_dynamic, fee_bps, liquidity_period_ends_at) =
            prediction_market::get_market_runtime_config<TestYes, TestNo>(
                market_addr
            );

        assert!(is_dynamic, E_RUNTIME_CONFIG_DYNAMIC_MISMATCH);
        assert!(fee_bps == FEE_BPS, E_RUNTIME_CONFIG_FEE_MISMATCH);
        assert!(
            option::is_some(&liquidity_period_ends_at),
            E_RUNTIME_CONFIG_DEADLINE_MISSING
        );
    }

    #[test(
        aptos_framework = @aptos_framework,
        creator = @0xCAFE,
        user = @0xBEEF
    )]
    fun creator_receives_removable_initial_lp_position(
        aptos_framework: &signer,
        creator: &signer,
        user: &signer
    ) {
        setup(aptos_framework, creator, user);
        let market_addr = create_test_market(creator);
        let creator_addr = signer::address_of(creator);

        let initial_lp_supply =
            prediction_market::lp_supply_for_test<TestYes, TestNo>(market_addr);
        assert!(initial_lp_supply > 1, E_INITIAL_LP_SUPPLY_ZERO);

        let internal_lp =
            prediction_market::internal_lp_balance_for_test<TestYes, TestNo>(
                creator_addr,
                market_addr
            );
        let lp_asset =
            prediction_market::lp_asset_balance_for_test<TestYes, TestNo>(
                creator_addr,
                market_addr
            );

        assert!(internal_lp == initial_lp_supply, E_INTERNAL_LP_MISMATCH);
        assert!(lp_asset == (initial_lp_supply as u64), E_LP_ASSET_MISMATCH);

        prediction_market::remove_liquidity<TestYes, TestNo>(
            creator,
            market_addr,
            initial_lp_supply / 2
        );
    }

        #[test(
        aptos_framework = @aptos_framework,
        creator = @0xCAFE,
        user = @0xBEEF
    )]
    fun static_add_liquidity_preview_matches_public_execution(
        aptos_framework: &signer,
        creator: &signer,
        user: &signer
    ) {
        setup(aptos_framework, creator, user);

        let market_addr = create_test_market(creator);
        let user_addr = signer::address_of(user);

        prediction_market::mint_prediction_tokens<TestYes, TestNo>(
            user,
            market_addr,
            ONE_APT
        );

        let contribution = fixed_point::from_u64(ADD_LIQ_VALUE);
        let contribution_raw = fixed_point::raw_value(&contribution);

        let (required_yes, required_no, quoted_lp, _) =
            prediction_market::preview_add_liquidity<TestYes, TestNo>(
                market_addr,
                contribution
            );

        let (yes_before, no_before) =
            prediction_market::get_user_balances<TestYes, TestNo>(
                user_addr,
                market_addr
            );
        let (lp_before, _, _, _) =
            prediction_market::get_user_lp_position<TestYes, TestNo>(
                user_addr,
                market_addr
            );

        pm_amm::add_market_liquidity<TestYes, TestNo>(
            user,
            market_addr,
            contribution_raw
        );

        let (yes_after, no_after) =
            prediction_market::get_user_balances<TestYes, TestNo>(
                user_addr,
                market_addr
            );
        let (lp_after, _, _, _) =
            prediction_market::get_user_lp_position<TestYes, TestNo>(
                user_addr,
                market_addr
            );

        assert!(
            yes_before - yes_after == required_yes
                && no_before - no_after == required_no,
            E_ADD_LIQ_BALANCE_MISMATCH
        );
        assert!(
            lp_after - lp_before == (quoted_lp as u64),
            E_ADD_LIQ_LP_MISMATCH
        );
    }

        #[test(
        aptos_framework = @aptos_framework,
        creator = @0xCAFE,
        user = @0xBEEF
    )]
    fun remove_liquidity_preview_includes_accumulated_fees(
        aptos_framework: &signer,
        creator: &signer,
        user: &signer
    ) {
        setup(aptos_framework, creator, user);

        let market_addr = create_test_market(creator);
        let creator_addr = signer::address_of(creator);

        // Create a real trade so the NO fee vault receives non-zero fees.
        prediction_market::mint_prediction_tokens<TestYes, TestNo>(
            user,
            market_addr,
            ONE_APT
        );

        let (quoted_yes, _) =
            prediction_market::get_swap_quote<TestYes, TestNo>(
                market_addr,
                FEE_GENERATING_SWAP_AMOUNT,
                false
            );

        prediction_market::buy_yes<TestYes, TestNo>(
            user,
            market_addr,
            FEE_GENERATING_SWAP_AMOUNT,
            quoted_yes
        );

        let creator_lp =
            prediction_market::internal_lp_balance_for_test<TestYes, TestNo>(
                creator_addr,
                market_addr
            );

        let lp_to_burn = creator_lp / 2;
        assert!(lp_to_burn > 0, E_REMOVE_PREVIEW_FEE_MISMATCH);

        let (expected_yes_out, expected_no_out) =
            prediction_market::preview_remove_liquidity<TestYes, TestNo>(
                market_addr,
                lp_to_burn
            );

        let (yes_before, no_before) =
            prediction_market::get_user_balances<TestYes, TestNo>(
                creator_addr,
                market_addr
            );

        prediction_market::remove_liquidity<TestYes, TestNo>(
            creator,
            market_addr,
            lp_to_burn
        );

        let (yes_after, no_after) =
            prediction_market::get_user_balances<TestYes, TestNo>(
                creator_addr,
                market_addr
            );

        assert!(
            yes_after - yes_before == expected_yes_out
                && no_after - no_before == expected_no_out,
            E_REMOVE_PREVIEW_FEE_MISMATCH
        );
    }

    #[test(
        aptos_framework = @aptos_framework,
        creator = @0xCAFE,
        user = @0xBEEF
    )]
    fun yes_reserve_tokens_remain_redeemable_after_swap(
        aptos_framework: &signer,
        creator: &signer,
        user: &signer
    ) {
        setup(aptos_framework, creator, user);
        let market_addr = create_test_market(creator);
        let user_addr = signer::address_of(user);

        prediction_market::mint_prediction_tokens<TestYes, TestNo>(
            user,
            market_addr,
            ONE_APT
        );
        prediction_market::buy_yes<TestYes, TestNo>(
            user,
            market_addr,
            SWAP_AMOUNT,
            1
        );

        let (yes_balance, _) =
            prediction_market::get_user_balances<TestYes, TestNo>(user_addr, market_addr);
        assert!(yes_balance > ONE_APT, E_EXPECTED_SWAP_OUTPUT);

        timestamp::fast_forward_seconds(MARKET_DURATION_SECS);
        prediction_market::resolve_market<TestYes, TestNo>(
            creator,
            market_addr,
            true
        );

        let apt_before =
            primary_fungible_store::balance(user_addr, prediction_market::apt_metadata());
        prediction_market::settle_tokens_with_collateral<TestYes, TestNo>(
            user,
            market_addr,
            yes_balance,
            0
        );
        let apt_after =
            primary_fungible_store::balance(user_addr, prediction_market::apt_metadata());

        assert!(apt_after - apt_before == yes_balance, E_SETTLEMENT_PAYOUT_MISMATCH);
    }

        #[test(
        aptos_framework = @aptos_framework,
        creator = @0xCAFE,
        user = @0xBEEF
    )]
    fun quoted_yes_output_matches_executed_swap(
        aptos_framework: &signer,
        creator: &signer,
        user: &signer
    ) {
        setup(aptos_framework, creator, user);
        let market_addr = create_test_market(creator);
        let user_addr = signer::address_of(user);

        prediction_market::mint_prediction_tokens<TestYes, TestNo>(
            user,
            market_addr,
            ONE_APT
        );

        // false = Y -> X = NO -> YES
        let (quoted_yes, _price_impact) =
            prediction_market::get_swap_quote<TestYes, TestNo>(
                market_addr,
                SWAP_AMOUNT,
                false
            );

        assert!(quoted_yes > 0, E_EXPECTED_SWAP_OUTPUT);

        prediction_market::buy_yes<TestYes, TestNo>(
            user,
            market_addr,
            SWAP_AMOUNT,
            quoted_yes
        );

        let (yes_balance, _) =
            prediction_market::get_user_balances<TestYes, TestNo>(
                user_addr,
                market_addr
            );

        assert!(
            yes_balance == ONE_APT + quoted_yes,
            E_QUOTE_EXECUTION_MISMATCH
        );
    }

    #[test(
        aptos_framework = @aptos_framework,
        creator = @0xCAFE,
        user = @0xBEEF
    )]
    fun no_reserve_tokens_remain_redeemable_after_swap(
        aptos_framework: &signer,
        creator: &signer,
        user: &signer
    ) {
        setup(aptos_framework, creator, user);
        let market_addr = create_test_market(creator);
        let user_addr = signer::address_of(user);

        prediction_market::mint_prediction_tokens<TestYes, TestNo>(
            user,
            market_addr,
            ONE_APT
        );
        prediction_market::buy_no<TestYes, TestNo>(
            user,
            market_addr,
            SWAP_AMOUNT,
            1
        );

        let (_, no_balance) =
            prediction_market::get_user_balances<TestYes, TestNo>(user_addr, market_addr);
        assert!(no_balance > ONE_APT, E_EXPECTED_SWAP_OUTPUT);

        timestamp::fast_forward_seconds(MARKET_DURATION_SECS);
        prediction_market::resolve_market<TestYes, TestNo>(
            creator,
            market_addr,
            false
        );

        let apt_before =
            primary_fungible_store::balance(user_addr, prediction_market::apt_metadata());
        prediction_market::settle_tokens_with_collateral<TestYes, TestNo>(
            user,
            market_addr,
            0,
            no_balance
        );
        let apt_after =
            primary_fungible_store::balance(user_addr, prediction_market::apt_metadata());

        assert!(apt_after - apt_before == no_balance, E_SETTLEMENT_PAYOUT_MISMATCH);
    }

        #[test(
        aptos_framework = @aptos_framework,
        creator = @0xCAFE,
        user = @0xBEEF
    )]
    fun quoted_no_output_matches_executed_swap(
        aptos_framework: &signer,
        creator: &signer,
        user: &signer
    ) {
        setup(aptos_framework, creator, user);
        let market_addr = create_test_market(creator);
        let user_addr = signer::address_of(user);

        prediction_market::mint_prediction_tokens<TestYes, TestNo>(
            user,
            market_addr,
            ONE_APT
        );

        // true = X -> Y = YES -> NO
        let (quoted_no, _price_impact) =
            prediction_market::get_swap_quote<TestYes, TestNo>(
                market_addr,
                SWAP_AMOUNT,
                true
            );

        assert!(quoted_no > 0, E_EXPECTED_SWAP_OUTPUT);

        prediction_market::buy_no<TestYes, TestNo>(
            user,
            market_addr,
            SWAP_AMOUNT,
            quoted_no
        );

        let (_, no_balance) =
            prediction_market::get_user_balances<TestYes, TestNo>(
                user_addr,
                market_addr
            );

        assert!(
            no_balance == ONE_APT + quoted_no,
            E_QUOTE_EXECUTION_MISMATCH
        );
    }

    #[test(
        aptos_framework = @aptos_framework,
        creator = @0xCAFE,
        user = @0xBEEF
    )]
    fun settlement_remains_raw_unit_one_to_one(
        aptos_framework: &signer,
        creator: &signer,
        user: &signer
    ) {
        setup(aptos_framework, creator, user);
        let market_addr = create_test_market(creator);
        let user_addr = signer::address_of(user);

        prediction_market::mint_prediction_tokens<TestYes, TestNo>(
            user,
            market_addr,
            ONE_APT
        );

        let apt_before =
            primary_fungible_store::balance(user_addr, prediction_market::apt_metadata());

        timestamp::fast_forward_seconds(MARKET_DURATION_SECS);
        prediction_market::resolve_market<TestYes, TestNo>(
            creator,
            market_addr,
            true
        );
        prediction_market::settle_tokens_with_collateral<TestYes, TestNo>(
            user,
            market_addr,
            ONE_APT,
            0
        );

        let apt_after =
            primary_fungible_store::balance(user_addr, prediction_market::apt_metadata());

        assert!(apt_after - apt_before == ONE_APT, E_SETTLEMENT_PAYOUT_MISMATCH);
    }
}