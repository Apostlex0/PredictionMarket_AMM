export const APT_DECIMALS = 8;
export const OUTCOME_DECIMALS = 8;
export const LP_DECIMALS = 8;

export function parseDecimalToAtomic(
  value: string,
  decimals: number,
): bigint {
  const trimmed = value.trim();

  if (!/^\d+(\.\d*)?$/.test(trimmed)) {
    throw new Error("Invalid decimal amount");
  }

  const [wholePart, fractionPart = ""] = trimmed.split(".");

  if (fractionPart.length > decimals) {
    throw new Error(`Amount exceeds ${decimals} decimal places`);
  }

  const scale = 10n ** BigInt(decimals);
  const paddedFraction = fractionPart.padEnd(decimals, "0");

  return BigInt(wholePart) * scale + BigInt(paddedFraction || "0");
}

export function formatAtomic(
  raw: string | bigint,
  decimals: number,
  maxFractionDigits = decimals,
): string {
  const amount = typeof raw === "bigint" ? raw : BigInt(raw);
  const scale = 10n ** BigInt(decimals);

  const whole = amount / scale;
  const fractionalRaw = (amount % scale)
    .toString()
    .padStart(decimals, "0")
    .slice(0, maxFractionDigits)
    .replace(/0+$/, "");

  return fractionalRaw.length > 0
    ? `${whole.toString()}.${fractionalRaw}`
    : whole.toString();
}

export function aptToOctas(value: string): bigint {
  return parseDecimalToAtomic(value, APT_DECIMALS);
}

export function outcomeToRaw(value: string): bigint {
  return parseDecimalToAtomic(value, OUTCOME_DECIMALS);
}

export function formatApt(raw: string | bigint): string {
  return formatAtomic(raw, APT_DECIMALS);
}

export function formatOutcome(raw: string | bigint): string {
  return formatAtomic(raw, OUTCOME_DECIMALS);
}

export function formatLp(raw: string | bigint): string {
  return formatAtomic(raw, LP_DECIMALS);
}