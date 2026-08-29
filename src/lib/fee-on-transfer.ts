const FEE_ON_TRANSFER_BPS = new Map([
  ["0xaf1efd88115a90676f8eeef01c88b0c49f3e8e8b", 100n], // DANG
  ["0xe6e5b8ab71e5a747a609796666d0e3a0a5ec8bff", 100n], // KAO
  ["0x74a1942613008aa6fec06c27f796ede6460259c1", 100n], // SIFA
]);

const BPS_DENOMINATOR = 10_000n;

const TRANSFER_FROM_FAILURE =
  /TransferHelper::transferFrom:\s*transferFrom failed/i;

export function isKnownFeeOnTransferToken(tokenAddress: string): boolean {
  return FEE_ON_TRANSFER_BPS.has(tokenAddress.toLowerCase());
}

export function addFeeOnTransferInputBuffer(
  amountIn: bigint,
  tokenAddress: string
): bigint {
  const feeBps = FEE_ON_TRANSFER_BPS.get(tokenAddress.toLowerCase());
  if (!feeBps || amountIn === 0n) return amountIn;

  const amountAfterFeeBps = BPS_DENOMINATOR - feeBps;
  return (
    amountIn * BPS_DENOMINATOR + amountAfterFeeBps - 1n
  ) / amountAfterFeeBps;
}

export function isFeeOnTransferWrapperFailure(error: unknown): boolean {
  const values: unknown[] = [error];
  const seen = new Set<object>();

  while (values.length > 0) {
    const value = values.pop();

    if (typeof value === "string") {
      if (TRANSFER_FROM_FAILURE.test(value)) return true;
      continue;
    }

    if (!value || typeof value !== "object" || seen.has(value)) continue;
    seen.add(value);

    const errorObject = value as Record<string, unknown>;
    for (const key of [
      "message",
      "shortMessage",
      "reason",
      "data",
      "error",
      "info",
      "revert",
    ]) {
      if (key in errorObject) values.push(errorObject[key]);
    }
  }

  return false;
}
