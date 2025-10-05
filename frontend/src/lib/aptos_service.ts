import { Aptos, AptosConfig, Network, InputViewFunctionData } from '@aptos-labs/ts-sdk';
import type { Market } from '@/types/market';

// ===== CONFIGURATION =====

export const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
  '0xc0fbad461e157cd14dab258c79368cf81040e1b80c38f0a95fa4545824cb12fa';

const config = new AptosConfig({
  network: Network.TESTNET,
});

export const aptos = new Aptos(config);

// ===== TYPE DEFINITIONS =====

export interface UserBalances {
  yes: string;
  no: string;
  lp: string;
}

export interface SwapQuote {
  outputAmount: string;
  priceImpact: string; // u128 FixedPoint128
}

export interface LiquidityQuote {
  requiredYes: string;
  requiredNo: string;
  lpTokens: string;
  shareOfPool: string;
}

// ===== CONVERSION HELPERS =====

/**
 * Convert probability percentage (0-100) to u128 FixedPoint128
 * Formula: (percent / 100) * 2^64
 */
export function probabilityToU128(percentFloat: number): string {
  if (percentFloat < 1 || percentFloat > 99) {
    throw new Error(`Probability must be between 1-99, got ${percentFloat}`);
  }

  // Use BigInt for safety
  const percent = BigInt(Math.floor(percentFloat * 1000000)); // Scale for precision
  const scale = BigInt('18446744073709551616'); // 2^64
  const result = (percent * scale) / BigInt(100000000); // percent / 100 * 2^64

  return result.toString();
}

/**
 * Convert USD liquidity to u128 FixedPoint128
 * Formula: amount * 2^64
 */
export function liquidityToU128(usdAmount: number): string {
  if (usdAmount <= 0) {
    throw new Error(`Liquidity must be positive, got ${usdAmount}`);
  }

  const amount = BigInt(Math.floor(usdAmount));
  const scale = BigInt('18446744073709551616'); // 2^64
  const result = amount * scale;

  // Check for overflow (u128 max)
  const U128_MAX = BigInt('340282366920938463463374607431768211455');
  if (result > U128_MAX) {
    throw new Error(`Liquidity ${usdAmount} too large, exceeds u128 max`);
  }

  return result.toString();
}

/**
 * Convert u128 FixedPoint128 to human-readable number
 * Formula: value / 2^64
 */
// export function u128ToNumber(u128String: string): number {
//   const str =
//       typeof u128String === "object" && u128String !== null && "value" in u128String
//         ? (u128String as any).value
//         : u128String;

//     // Ensure it's a valid string
//     if (typeof str !== "string" && typeof str !== "number") {
//       console.warn("u128ToNumber: invalid input", u128String);
//       return 0;
//     }

//     const value = BigInt(str.toString());
//   const scale = BigInt('18446744073709551616'); // 2^64
//   return Number(value) / Number(scale);
// }
export function u128ToNumber(u128Value: unknown): number {
  try {
    // Extract string or numeric value
    const str =
      typeof u128Value === "object" && u128Value !== null && "value" in u128Value
        ? (u128Value as any).value
        : u128Value;

    if (str === null || str === undefined) return 0;

    // Convert to string for uniform processing
    const s = String(str).trim();

    // If it looks like a float (contains "."), parse normally
    if (s.includes(".")) {
      return parseFloat(s);
    }

    // Otherwise, treat as u128 integer
    const value = BigInt(s);
    const scale = Number('18446744073709551616'); // 2^64
    return Number(value) / Number(scale);
  } catch (e) {
    console.error("u128ToNumber failed:", e, u128Value);
    return 0;
  }
}

/**
 * Convert u128 FixedPoint128 to percentage string
 */
export function u128ToPercentage(u128String: string): string {
  const decimal = u128ToNumber(u128String);
  return (decimal * 100).toFixed(2);
}

/**
 * Format balance for display (8 decimals)
 */
export function formatBalance(balance: string): string {
  const balanceNum = parseFloat(balance) / Math.pow(10, 8);
  return balanceNum.toFixed(2);
}

// ===== VIEW FUNCTIONS =====

/**
 * Get all markets from registry
 * Contract: get_all_markets()
 */
export async function getAllMarkets(): Promise<Market[]> {
  try {
    const payload: InputViewFunctionData = {
      function: `${CONTRACT_ADDRESS}::pm_amm::get_all_markets`,
    };

    const result = await aptos.view({ payload });

    // Parse result - expecting vector<PoolRecord>
    if (!result || !result[0] || !Array.isArray(result[0])) {
      return [];
    }

    const poolRecords = result[0] as Array<{
      pool_id: string;
      token_x_type: string;
      token_y_type: string;
      creator: string;
      is_prediction_market: boolean;
      created_at: string;
    }>;

    // Filter only prediction markets and fetch their details
    const markets: Market[] = [];
    for (const record of poolRecords) {
      if (!record.is_prediction_market) continue;

      try {
        // Derive market address from pool_id and creator
        const marketAddress = record.creator; // Pool owner address is the market address

        // Fetch market info
        const info = await getMarketInfo(marketAddress);
        if (!info) continue;

        // Fetch price info
        const priceInfo = await getMarketPriceInfo(marketAddress);
        const probability = priceInfo ? parseFloat(priceInfo.probability) / 100 : 0.5;
        const totalVolume = priceInfo ? parseFloat(priceInfo.totalVolume) : 0;

        markets.push({
          id: record.pool_id.toString(),
          poolAddress: marketAddress,
          question: info.question,
          description: info.description,
          category: info.category,
          createdAt: new Date(info.createdAt * 1000), // Convert Unix timestamp to Date
          expiresAt: new Date(info.expiresAt * 1000), // Convert Unix timestamp to Date
          resolved: info.resolved,
          outcome: info.outcome ?? undefined, // Convert null to undefined for optional field
          creator: record.creator,
          probability,
          totalVolume,
          liquidity: 0, // Would need reserves calculation
          totalTraders: 0, // Would need separate tracking
          isDynamic: false, // Default to static
          feeRate: 0, // Would need separate call
          initialProbability: probability,
          yesTokenAddress: record.token_x_type,
          noTokenAddress: record.token_y_type,
          lpTokenAddress: '', // Would need separate call
          marketAuthority: marketAddress,
        });
      } catch (err) {
        console.error(`Error fetching details for pool ${record.pool_id}:`, err);
        continue;
      }
    }

    return markets;
  } catch (error) {
    console.error('Error fetching markets:', error);
    return [];
  }
}

/**
 * Get market info
 * Contract: get_market_info<YesToken, NoToken>(market_addr: address)
 * Returns: (String, String, String, u64, u64, bool, Option<bool>)
 * (question, description, category, created_at, expires_at, resolved, outcome)
 */
export async function getMarketInfo(
  marketAddress: string
): Promise<{
  question: string;
  description: string;
  category: string;
  createdAt: number;
  expiresAt: number;
  resolved: boolean;
  outcome: boolean | null;
} | null> {
  try {
    const payload: InputViewFunctionData = {
      function: `${CONTRACT_ADDRESS}::pm_amm::get_market_info`,
      typeArguments: [
        '0x1::string::String',
        '0x1::string::String'
      ],
      functionArguments: [marketAddress],
    };

    const result = await aptos.view({ payload });

    if (!result || result.length < 7) {
      return null;
    }

    // Parse tuple: (question, description, category, created_at, expires_at, resolved, outcome)
    const [question, description, category, createdAt, expiresAt, resolved, outcome] = result;

    return {
      question: question as string,
      description: description as string,
      category: category as string,
      createdAt: Number(createdAt),
      expiresAt: Number(expiresAt),
      resolved: resolved as boolean,
      outcome: outcome ? (outcome as { vec?: boolean[] }).vec?.[0] as boolean : null, // Handle Option<bool>
    };
  } catch (error) {
    console.error('Error fetching market info:', error);
    return null;
  }
}

/**
 * Get market price info
 * Contract: get_market_price_info<YesToken, NoToken>(market_addr: address)
 * Returns: (FixedPoint128, u128) - (current_price, total_volume)
 */
export async function getMarketPriceInfo(
  marketAddress: string
): Promise<{ probability: string; totalVolume: string } | null> {
  try {
    const payload: InputViewFunctionData = {
      function: `${CONTRACT_ADDRESS}::pm_amm::get_market_price_info`,
      typeArguments: [
        '0x1::string::String',
        '0x1::string::String'
      ],
      functionArguments: [marketAddress],
    };

    const result = await aptos.view({ payload });

    if (!result || result.length < 2) {
      return null;
    }

    // Parse tuple: (FixedPoint128, u128)
    const probabilityU128 = result[0] as string;
    const totalVolume = result[1] as string;

    return {
      probability: u128ToPercentage(probabilityU128),
      totalVolume,
    };
  } catch (error) {
    console.error('Error fetching market price info:', error);
    return null;
  }
}

/**
 * Get market probability
 * Contract: get_market_probability<YesToken, NoToken>(market_addr: address)
 * Returns: FixedPoint128
 */
export async function getMarketProbability(
  marketAddress: string
): Promise<string | null> {
  try {
    const payload: InputViewFunctionData = {
      function: `${CONTRACT_ADDRESS}::pm_amm::get_market_probability`,
      typeArguments: [
        '0x1::string::String',
        '0x1::string::String'
      ],
      functionArguments: [marketAddress],
    };

    const result = await aptos.view({ payload });

    if (!result || result.length === 0) {
      return null;
    }

    // Result is a FixedPoint128 value (u128)
    const probabilityU128 = result[0] as string;
    return u128ToPercentage(probabilityU128);
  } catch (error) {
    console.error('Error fetching market probability:', error);
    return null;
  }
}

/**
 * Get market reserves
 * Contract: get_market_reserves<YesToken, NoToken>(market_addr: address)
 * Returns: (u64, u64) - (yes_reserves, no_reserves)
 */
export async function getMarketReserves(
  marketAddress: string
): Promise<{ yes: string; no: string } | null> {
  try {
    const payload: InputViewFunctionData = {
      function: `${CONTRACT_ADDRESS}::pm_amm::get_market_reserves`,
      typeArguments: [
        '0x1::string::String',
        '0x1::string::String'
      ],
      functionArguments: [marketAddress],
    };

    const result = await aptos.view({ payload });

    if (!result || result.length < 2) {
      return null;
    }

    return {
      yes: result[0] as string,
      no: result[1] as string,
    };
  } catch (error) {
    console.error('Error fetching market reserves:', error);
    return null;
  }
}

/**
 * Get user prediction token balances
 * Contract: get_user_prediction_balances<YesToken, NoToken>(user_addr, market_addr)
 * Returns: (u64, u64) - (yes_balance, no_balance)
 */
export async function getUserBalances(
  userAddress: string,
  marketAddress: string
): Promise<UserBalances | null> {
  try {
    const payload: InputViewFunctionData = {
      function: `${CONTRACT_ADDRESS}::pm_amm::get_user_prediction_balances`,
      typeArguments: [
        '0x1::string::String',
        '0x1::string::String'
      ],
      functionArguments: [userAddress, marketAddress],
    };

    const result = await aptos.view({ payload });

    if (!result || result.length < 2) {
      return null;
    }

    return {
      yes: result[0] as string,
      no: result[1] as string,
      lp: '0', // Fetch separately if needed
    };
  } catch (error) {
    console.error('Error fetching user balances:', error);
    return null;
  }
}

/**
 * Check if market exists
 * Contract: market_exists<YesToken, NoToken>(market_addr)
 */
export async function marketExists(marketAddress: string): Promise<boolean> {
  try {
    const payload: InputViewFunctionData = {
      function: `${CONTRACT_ADDRESS}::pm_amm::market_exists`,
      typeArguments: [
        '0x1::string::String',
        '0x1::string::String'
      ],
      functionArguments: [marketAddress],
    };

    const result = await aptos.view({ payload });
    return result[0] as boolean;
  } catch (error) {
    console.error('Error checking market existence:', error);
    return false;
  }
}

/**
 * Get swap quote
 * Contract: get_swap_quote<X, Y>(pool_owner, amount_in, is_x_to_y)
 * Returns: (u64, FixedPoint128) - (output_amount, price_impact)
 *
 * NOTE: The contract's get_swap_quote view function doesn't work for prediction markets
 * because the Pool is stored INSIDE the PredictionMarket struct, not as a standalone resource.
 * The view function checks for Pool<X,Y> with has_key, but it doesn't exist separately.
 *
 * Swaps still work because they use prediction_market::buy_yes/buy_no which access
 * the pool through the PredictionMarket struct.
 *
 * This function returns null to indicate quotes are unavailable.
 */
export async function getSwapQuote(
  poolOwner: string,
  amountIn: string,
  isXToY: boolean
): Promise<SwapQuote | null> {
  // The view function doesn't work for prediction markets (pool is embedded in PredictionMarket struct)
  // Return null to let UI show fallback
  console.log('getSwapQuote: View function not available for prediction markets (pool is embedded)');
  return null;

  /* Original code that doesn't work:
  try {
    const payload: InputViewFunctionData = {
      function: `${CONTRACT_ADDRESS}::pm_amm::get_swap_quote`,
      typeArguments: [
        '0x1::string::String', // X = YesToken
        '0x1::string::String'  // Y = NoToken
      ],
      functionArguments: [poolOwner, amountIn, isXToY],
    };

    const result = await aptos.view({ payload });

    if (!result || result.length < 2) {
      return null;
    }

    return {
      outputAmount: result[0] as string,
      priceImpact: result[1] as string, // FixedPoint128
    };
  } catch (error) {
    console.error('Error getting swap quote:', error);
    return null;
  }
  */
}

/**
 * Preview add liquidity quote
 * Contract: preview_add_liquidity_quote<YesToken, NoToken>(market_addr, desired_value_increase)
 * Returns: (u64, u64, u64, FixedPoint128) - (required_yes, required_no, lp_tokens, share_of_pool)
 */
export async function previewAddLiquidity(
  marketAddress: string,
  desiredValueIncreaseUSD: number
): Promise<LiquidityQuote | null> {
  try {
    const desiredValueU128 = liquidityToU128(desiredValueIncreaseUSD);

    const payload: InputViewFunctionData = {
      function: `${CONTRACT_ADDRESS}::pm_amm::preview_add_liquidity_quote`,
      typeArguments: [
        '0x1::string::String',
        '0x1::string::String'
      ],
      functionArguments: [marketAddress, desiredValueU128],
    };

    const result = await aptos.view({ payload });

    if (!result || result.length < 4) {
      return null;
    }

    return {
      requiredYes: result[0] as string,
      requiredNo: result[1] as string,
      lpTokens: result[2] as string,
      shareOfPool: u128ToPercentage(result[3] as string),
    };
  } catch (error) {
    console.error('Error previewing add liquidity:', error);
    return null;
  }
}

/**
 * Preview remove liquidity quote
 * Contract: preview_remove_liquidity_quote<YesToken, NoToken>(market_addr, lp_tokens_to_burn)
 * Returns: (u64, u64) - (yes_out, no_out)
 */
export async function previewRemoveLiquidity(
  marketAddress: string,
  lpTokensToBurn: string
): Promise<{ yesOut: string; noOut: string } | null> {
  try {
    const payload: InputViewFunctionData = {
      function: `${CONTRACT_ADDRESS}::pm_amm::preview_remove_liquidity_quote`,
      typeArguments: [
        '0x1::string::String',
        '0x1::string::String'
      ],
      functionArguments: [marketAddress, lpTokensToBurn],
    };

    const result = await aptos.view({ payload });

    if (!result || result.length < 2) {
      return null;
    }

    return {
      yesOut: result[0] as string,
      noOut: result[1] as string,
    };
  } catch (error) {
    console.error('Error previewing remove liquidity:', error);
    return null;
  }
}

// ===== TRANSACTION FUNCTIONS =====
// These functions build transaction payloads for wallet signing

/**
 * Mint prediction tokens (APT → YES + NO)
 */
export function buildMintTokensPayload(
  marketAddress: string,
  aptAmount: string // in octas
) {
  return {
    function: `${CONTRACT_ADDRESS}::pm_amm::mint_prediction_tokens` as const,
    typeArguments: [
      '0x1::string::String',
      '0x1::string::String'
    ],
    functionArguments: [marketAddress, aptAmount],
  };
}

/**
 * Buy YES tokens with NO tokens
 */
export function buildBuyYesPayload(
  marketAddress: string,
  amountInNo: string,
  minOutYes: string
) {
  // Parse amounts to ensure they're valid integers (no decimals)
  const amountInNoInt = Math.floor(parseFloat(amountInNo)).toString();
  const minOutYesInt = Math.floor(parseFloat(minOutYes)).toString();

  return {
    function: `${CONTRACT_ADDRESS}::pm_amm::buy_yes_tokens` as const,
    typeArguments: [
      '0x1::string::String',
      '0x1::string::String'
    ],
    functionArguments: [marketAddress, amountInNoInt, minOutYesInt],
  };
}

/**
 * Buy NO tokens with YES tokens
 */
export function buildBuyNoPayload(
  marketAddress: string,
  amountInYes: string,
  minOutNo: string
) {
  // Parse amounts to ensure they're valid integers (no decimals)
  const amountInYesInt = Math.floor(parseFloat(amountInYes)).toString();
  const minOutNoInt = Math.floor(parseFloat(minOutNo)).toString();

  return {
    function: `${CONTRACT_ADDRESS}::pm_amm::buy_no_tokens` as const,
    typeArguments: [
      '0x1::string::String',
      '0x1::string::String'
    ],
    functionArguments: [marketAddress, amountInYesInt, minOutNoInt],
  };
}

/**
 * Add liquidity to market
 */
export function buildAddLiquidityPayload(
  marketAddress: string,
  desiredValueIncreaseUSD: number
) {
  const desiredValueU128 = liquidityToU128(desiredValueIncreaseUSD);

  return {
    function: `${CONTRACT_ADDRESS}::pm_amm::add_market_liquidity` as const,
    typeArguments: [
      '0x1::string::String',
      '0x1::string::String'
    ],
    functionArguments: [marketAddress, desiredValueU128],
  };
}

/**
 * Remove liquidity from market
 */
export function buildRemoveLiquidityPayload(
  marketAddress: string,
  lpTokensToBurn: string
) {
  return {
    function: `${CONTRACT_ADDRESS}::pm_amm::remove_market_liquidity` as const,
    typeArguments: [
      '0x1::string::String',
      '0x1::string::String'
    ],
    functionArguments: [marketAddress, lpTokensToBurn],
  };
}

/**
 * Resolve prediction market
 */
export function buildResolveMarketPayload(
  marketAddress: string,
  outcomeYes: boolean
) {
  return {
    function: `${CONTRACT_ADDRESS}::pm_amm::resolve_prediction_market` as const,
    typeArguments: [
      '0x1::string::String',
      '0x1::string::String'
    ],
    functionArguments: [marketAddress, outcomeYes],
  };
}

/**
 * Settle tokens after resolution
 */
export function buildSettleTokensPayload(
  marketAddress: string,
  yesAmount: string,
  noAmount: string
) {
  return {
    function: `${CONTRACT_ADDRESS}::pm_amm::settle_tokens_with_collateral` as const,
    typeArguments: [
      '0x1::string::String',
      '0x1::string::String'
    ],
    functionArguments: [marketAddress, yesAmount, noAmount],
  };
}

// CONTRACT_ADDRESS is already exported at the top of the file