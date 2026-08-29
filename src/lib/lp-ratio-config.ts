export interface LpRatioAmountConfig {
  type: "lpRatio";
  baseAmountField: string;
  baseTokenField?: string;
  baseToken?: string;
  pairedTokenField?: string;
  pairedToken?: string;
}

export interface LpRatioFieldConfig {
  baseTokenField: string;
  baseAmountField: string;
  pairedTokenField: string;
  isPLS?: boolean;
}

function readStringField(
  nodeData: Record<string, unknown>,
  field: string,
): string | undefined {
  const value = nodeData[field];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function sameToken(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

export function normalizeLpRatioFieldReferences(
  amountConfig: LpRatioAmountConfig,
  fieldConfig: LpRatioFieldConfig,
): LpRatioAmountConfig {
  return {
    type: "lpRatio",
    baseTokenField: fieldConfig.baseTokenField,
    baseAmountField: fieldConfig.baseAmountField,
    ...(fieldConfig.isPLS
      ? { pairedToken: "PLS" }
      : { pairedTokenField: fieldConfig.pairedTokenField }),
  };
}

export function hasCurrentLpRatioFieldReferences(
  amountConfig: LpRatioAmountConfig,
  fieldConfig: LpRatioFieldConfig,
): boolean {
  if (
    amountConfig.baseTokenField !== fieldConfig.baseTokenField ||
    amountConfig.baseAmountField !== fieldConfig.baseAmountField
  ) {
    return false;
  }

  return fieldConfig.isPLS
    ? amountConfig.pairedToken === "PLS"
    : amountConfig.pairedTokenField === fieldConfig.pairedTokenField;
}

/**
 * Resolve token references for an LP ratio calculation.
 *
 * Saved token-to-token configurations used to contain a copied paired-token
 * address. For the addLiquidity shape, tokenB is authoritative. This keeps
 * valid legacy records working and repairs stale records after tokenB changes.
 */
export function resolveLpRatioTokens(
  amountConfig: LpRatioAmountConfig,
  nodeData: Record<string, unknown>,
): { baseToken: string; pairedToken: string } {
  const baseToken = amountConfig.baseTokenField
    ? readStringField(nodeData, amountConfig.baseTokenField)
    : readStringField(nodeData, "token") ||
      readStringField(nodeData, "tokenA") ||
      amountConfig.baseToken;

  if (!baseToken) {
    const field = amountConfig.baseTokenField || "baseToken";
    throw new Error(`LP ratio base token '${field}' is missing`);
  }

  let pairedToken: string | undefined;
  if (amountConfig.pairedTokenField) {
    pairedToken = readStringField(nodeData, amountConfig.pairedTokenField);
    if (!pairedToken) {
      throw new Error(
        `LP ratio paired token field '${amountConfig.pairedTokenField}' is missing`,
      );
    }
  } else if (amountConfig.pairedToken === "PLS") {
    pairedToken = "PLS";
  } else if (
    amountConfig.baseAmountField === "amountADesired" &&
    readStringField(nodeData, "tokenA") &&
    readStringField(nodeData, "tokenB")
  ) {
    pairedToken = readStringField(nodeData, "tokenB");
  } else {
    pairedToken = amountConfig.pairedToken;
  }

  if (!pairedToken) {
    throw new Error("LP ratio paired token is missing");
  }

  return { baseToken, pairedToken };
}

export function assertLpRatioMatchesAddLiquidityPair(
  amountConfig: unknown,
  nodeData: Record<string, unknown>,
): void {
  if (
    !amountConfig ||
    typeof amountConfig !== "object" ||
    !("type" in amountConfig) ||
    amountConfig.type !== "lpRatio"
  ) {
    return;
  }

  const tokenA = readStringField(nodeData, "tokenA");
  const tokenB = readStringField(nodeData, "tokenB");
  if (!tokenA || !tokenB) {
    throw new Error("Add liquidity requires both tokenA and tokenB");
  }

  const { baseToken, pairedToken } = resolveLpRatioTokens(
    amountConfig as LpRatioAmountConfig,
    nodeData,
  );

  if (!sameToken(baseToken, tokenA) || !sameToken(pairedToken, tokenB)) {
    throw new Error(
      "LP ratio configuration does not match the current add-liquidity token pair. Re-select Auto from LP Ratio.",
    );
  }
}
