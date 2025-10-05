/**
 * Backend Service - Simple API calls to Go backend
 *
 * Flow:
 * 1. Frontend sends human-readable values
 * 2. Backend converts to u128 and builds transaction
 * 3. Frontend signs transaction
 * 4. Backend submits to blockchain
 */

const BACKEND_URL = 'http://localhost:8000';

export interface CreateMarketParams {
  question: string;
  description: string;
  category: string;
  expirationDays: number;
  initialProbabilityPercent: number;  // e.g., 60 for 60%
  initialLiquidityUSD: number;        // e.g., 10000
  feeRatePercent: number;             // e.g., 0.3 for 0.3%
  resolutionSource: string;
  isDynamic: boolean;
}

export interface BuildTransactionResponse {
  success: boolean;
  raw_txn_bytes?: string;
  error?: string;
}

export interface SubmitTransactionResponse {
  success: boolean;
  txn_hash?: string;
  error?: string;
}

/**
 * Step 1: Build raw transaction
 * Backend converts all human values to u128 and builds the transaction
 */
export async function buildCreateMarketTransaction(
  params: CreateMarketParams,
  senderAddress: string,
  contractAddress: string,
  network: string = 'testnet'
): Promise<string> {
  const response = await fetch(`${BACKEND_URL}/createmarket`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question: params.question,
      description: params.description,
      category: params.category,
      expiration_days: params.expirationDays,
      initial_probability_percent: params.initialProbabilityPercent,
      initial_liquidity_usd: params.initialLiquidityUSD,
      fee_rate_percent: params.feeRatePercent,
      resolution_source: params.resolutionSource,
      is_dynamic: params.isDynamic,
      network: network,
      sender_address: senderAddress,
      contract_address: contractAddress,
    }),
  });

  if (!response.ok) {
    throw new Error(`Backend error: ${response.statusText}`);
  }

  const data: BuildTransactionResponse = await response.json();

  if (!data.success || !data.raw_txn_bytes) {
    throw new Error(data.error || 'Failed to build transaction');
  }

  return data.raw_txn_bytes;
}

/**
 * Step 2: Submit signed transaction
 * After frontend signs with wallet, send back to backend for submission
 */
export async function submitSignedTransaction(
  signedTxnBytes: string,
  network: string = 'testnet'
): Promise<string> {
  const response = await fetch(`${BACKEND_URL}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      signed_txn_bytes: signedTxnBytes,
      network: network,
    }),
  });

  if (!response.ok) {
    throw new Error(`Backend error: ${response.statusText}`);
  }

  const data: SubmitTransactionResponse = await response.json();

  if (!data.success || !data.txn_hash) {
    throw new Error(data.error || 'Failed to submit transaction');
  }

  return data.txn_hash;
}

// ===== Helper Functions =====

export function hexToUint8Array(hex: string): Uint8Array {
  const hexString = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(hexString.length / 2);
  for (let i = 0; i < hexString.length; i += 2) {
    bytes[i / 2] = parseInt(hexString.slice(i, i + 2), 16);
  }
  return bytes;
}

export function uint8ArrayToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
