/**
 * Aptos Service - Clean, simple blockchain interactions
 * Mirrors the Go backend's approach with proper u128 handling
 *
 * ALL FUNCTIONS FULLY IMPLEMENTED
 */

import { Aptos, AptosConfig, Network, InputViewFunctionData } from '@aptos-labs/ts-sdk';
import type { Market } from '@/types/market';
import { aptToOctas, formatOutcome } from '@/lib/amounts';

// ===== CONFIGURATION =====

export const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
  '0xf95728f054fc19c29a9015073408d46b3c18a5c0d9dda993be3ef35280f20f78';

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
  export interface MarketRuntimeConfig {
  isDynamic: boolean;
  feeRateBps: number;
  liquidityPeriodEndsAt: number | null;
}

export interface UserLpPosition {
  lpTokens: string;
  shareOfPool: string;
  yesReserveShare: string;
  noReserveShare: string;
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
 * Convert an APT-denominated liquidity value into the contract's raw
 * FixedPoint128 value.
 *
 * Contract convention:
 *   integer component = raw 8-decimal collateral/outcome units
 *
 * Example:
 *   "0.1" APT = 10_000_000 octas
 *   encoded argument = 10_000_000 * 2^64
 */
export function liquidityValueAptToU128(aptValue: string): string {
  const rawOctas = aptToOctas(aptValue);

  if (rawOctas <= 0n) {
    throw new Error('Liquidity value must be greater than zero APT');
  }

  const scale = 18_446_744_073_709_551_616n; // 2^64
  const result = rawOctas * scale;
  const u128Max = 340_282_366_920_938_463_463_374_607_431_768_211_455n;

  if (result > u128Max) {
    throw new Error('Liquidity value exceeds the contract u128 limit');
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
        ? (u128Value as { value: unknown }).value
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
  return formatOutcome(balance);
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

        const [priceInfo, runtimeConfig, reserves, marketCreator] = await Promise.all([
          getMarketPriceInfo(marketAddress),
          getMarketRuntimeConfig(marketAddress),
          getMarketReserves(marketAddress),
          getMarketCreator(marketAddress),
        ]);

        if (!runtimeConfig || !marketCreator) {
          console.error(`Missing runtime market data for market ${record.pool_id}`);
          continue;
        }

        const probability = priceInfo
          ? parseFloat(priceInfo.probability) / 100
          : 0.5;

        const totalVolume = priceInfo
          ? Number(formatOutcome(priceInfo.totalVolume))
          : 0;

        // This is displayed as reserve inventory, not USD TVL.
        const reserveInventory = reserves
          ? Number(formatOutcome(reserves.yes)) + Number(formatOutcome(reserves.no))
          : 0;

        markets.push({
          id: record.pool_id.toString(),
          poolAddress: marketAddress,
          question: info.question,
          description: info.description,
          category: info.category,
          createdAt: new Date(info.createdAt * 1000),
          expiresAt: new Date(info.expiresAt * 1000),
          resolved: info.resolved,
          outcome: info.outcome ?? undefined,
          creator: marketCreator,
          probability,
          totalVolume,
          liquidity: reserveInventory,
          totalTraders: 0,
          isDynamic: runtimeConfig.isDynamic,
          liquidityPeriodEndsAt: runtimeConfig.liquidityPeriodEndsAt === null
            ? undefined
            : new Date(runtimeConfig.liquidityPeriodEndsAt * 1000),
          feeRate: runtimeConfig.feeRateBps,
          initialProbability: probability,
          yesTokenAddress: record.token_x_type,
          noTokenAddress: record.token_y_type,
          lpTokenAddress: '',
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
 * Get the wallet address authorized to resolve a market.
 */
export async function getMarketCreator(
  marketAddress: string
): Promise<string | null> {
  try {
    const payload: InputViewFunctionData = {
      function: `${CONTRACT_ADDRESS}::pm_amm::get_market_creator`,
      typeArguments: [
        '0x1::string::String',
        '0x1::string::String',
      ],
      functionArguments: [marketAddress],
    };

    const result = await aptos.view({ payload });

    if (!result || result.length < 1) {
      return null;
    }

    return String(result[0]);
  } catch (error) {
    console.error('Error fetching market creator:', error);
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
 * Get real market runtime configuration.
 * Returns whether the market is dynamic, its swap fee in basis points,
 * and its pretrade-liquidity deadline when applicable.
 */
export async function getMarketRuntimeConfig(
  marketAddress: string
): Promise<MarketRuntimeConfig | null> {
  try {
    const payload: InputViewFunctionData = {
      function: `${CONTRACT_ADDRESS}::pm_amm::get_market_runtime_config`,
      typeArguments: [
        '0x1::string::String',
        '0x1::string::String',
      ],
      functionArguments: [marketAddress],
    };

    const result = await aptos.view({ payload });

    if (!result || result.length < 3) {
      return null;
    }

    const deadlineOption = result[2] as { vec?: Array<string | number> } | null;
    const deadlineValue = deadlineOption?.vec?.[0];

    return {
      isDynamic: Boolean(result[0]),
      feeRateBps: Number(result[1]),
      liquidityPeriodEndsAt:
        deadlineValue === undefined ? null : Number(deadlineValue),
    };
  } catch (error) {
    console.error('Error fetching market runtime config:', error);
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
      yes: String(result[0]),
      no: String(result[1]),
      lp: '0',
    };
  } catch (error) {
    console.error('Error fetching user balances:', error);
    return null;
  }
}

/**
 * Get the user's real LP position from the contract.
 *
 * The YES/NO amounts are the user's proportional reserve share. The exact
 * amount received when burning LP must be obtained through
 * previewRemoveLiquidity because it also includes fee-vault distributions.
 */
export async function getUserLpPosition(
  userAddress: string,
  marketAddress: string
): Promise<UserLpPosition | null> {
  try {
    const payload: InputViewFunctionData = {
      function: `${CONTRACT_ADDRESS}::pm_amm::get_user_lp_position`,
      typeArguments: [
        '0x1::string::String',
        '0x1::string::String',
      ],
      functionArguments: [userAddress, marketAddress],
    };

    const result = await aptos.view({ payload });

    if (!result || result.length < 4) {
      return null;
    }

    return {
      lpTokens: String(result[0]),
      shareOfPool: String(result[1]),
      yesReserveShare: String(result[2]),
      noReserveShare: String(result[3]),
    };
  } catch (error) {
    console.error('Error fetching user LP position:', error);
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
 * Get an executable swap quote from the prediction market's embedded pool.
 *
 * YES = X and NO = Y:
 * - isXToY = true  => YES -> NO
 * - isXToY = false => NO -> YES
 *
 * Returns raw output token units and raw FixedPoint128 price impact.
 */
export async function getSwapQuote(
  marketAddress: string,
  amountIn: string,
  isXToY: boolean
): Promise<SwapQuote | null> {
  try {
    const amountInRaw = BigInt(amountIn);

    if (amountInRaw <= 0n) {
      return null;
    }

    const payload: InputViewFunctionData = {
      function: `${CONTRACT_ADDRESS}::pm_amm::get_swap_quote`,
      typeArguments: [
        '0x1::string::String',
        '0x1::string::String'
      ],
      functionArguments: [
        marketAddress,
        amountInRaw.toString(),
        isXToY
      ],
    };

    const result = await aptos.view({ payload });

    if (!result || result.length < 2) {
      return null;
    }

    return {
      outputAmount: String(result[0]),
      priceImpact: result[1] as string,
    };
  } catch (error) {
    console.error('Error getting executable swap quote:', error);
    return null;
  }
}

/**
 * Preview add liquidity quote
 * Contract: preview_add_liquidity_quote<YesToken, NoToken>(market_addr, desired_value_increase)
 * Returns: (u64, u64, u64, FixedPoint128) - (required_yes, required_no, lp_tokens, share_of_pool)
 */
export async function previewAddLiquidity(
  marketAddress: string,
  desiredValueIncreaseApt: string
): Promise<LiquidityQuote | null> {
  try {
    const desiredValueU128 = liquidityValueAptToU128(desiredValueIncreaseApt);

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
      requiredYes: String(result[0]),
      requiredNo: String(result[1]),
      lpTokens: String(result[2]),
      shareOfPool: String(result[3]),
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
  const amountInNoInt = BigInt(amountInNo).toString();
  const minOutYesInt = BigInt(minOutYes).toString();

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
  const amountInYesInt = BigInt(amountInYes).toString();
  const minOutNoInt = BigInt(minOutNo).toString();

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
  desiredValueIncreaseApt: string
) {
  const desiredValueU128 = liquidityValueAptToU128(desiredValueIncreaseApt);

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
