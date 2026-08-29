import assert from "node:assert/strict";
import test from "node:test";
import {
  assertLpRatioMatchesAddLiquidityPair,
  hasCurrentLpRatioFieldReferences,
  normalizeLpRatioFieldReferences,
  resolveLpRatioTokens,
  type LpRatioAmountConfig,
} from "./lp-ratio-config";

const TOKEN_A = "0x57fde0a71132198BBeC939B98976993d8D89D225";
const TOKEN_B = "0x35CF3DF735B9293F660FcC5aFcE961D89170899C";
const OLD_TOKEN_B = "0x3a6c545c9E07e6d3041DC802033400F7fBf96c9a";

test("stores token-to-token LP ratios as field references", () => {
  const normalized = normalizeLpRatioFieldReferences(
    {
      type: "lpRatio",
      baseAmountField: "amountADesired",
      pairedToken: OLD_TOKEN_B,
    },
    {
      baseTokenField: "tokenA",
      baseAmountField: "amountADesired",
      pairedTokenField: "tokenB",
    },
  );

  assert.deepEqual(normalized, {
    type: "lpRatio",
    baseTokenField: "tokenA",
    baseAmountField: "amountADesired",
    pairedTokenField: "tokenB",
  });
  assert.equal(
    hasCurrentLpRatioFieldReferences(normalized, {
      baseTokenField: "tokenA",
      baseAmountField: "amountADesired",
      pairedTokenField: "tokenB",
    }),
    true,
  );
});

test("keeps native PLS ratios on the PLS marker", () => {
  const fieldConfig = {
    baseTokenField: "token",
    baseAmountField: "amountTokenDesired",
    pairedTokenField: "token",
    isPLS: true,
  };
  const normalized = normalizeLpRatioFieldReferences(
    {
      type: "lpRatio",
      baseAmountField: "amountTokenDesired",
      pairedToken: "PLS",
    },
    fieldConfig,
  );

  assert.deepEqual(normalized, {
    type: "lpRatio",
    baseTokenField: "token",
    baseAmountField: "amountTokenDesired",
    pairedToken: "PLS",
  });
  assert.equal(hasCurrentLpRatioFieldReferences(normalized, fieldConfig), true);
});

test("resolves the current tokenB after the token selection changes", () => {
  const config: LpRatioAmountConfig = {
    type: "lpRatio",
    baseTokenField: "tokenA",
    baseAmountField: "amountADesired",
    pairedTokenField: "tokenB",
  };

  assert.deepEqual(
    resolveLpRatioTokens(config, {
      tokenA: TOKEN_A,
      tokenB: TOKEN_B,
    }),
    {
      baseToken: TOKEN_A,
      pairedToken: TOKEN_B,
    },
  );
});

test("uses current tokenB for a stale legacy copied address", () => {
  const legacyConfig: LpRatioAmountConfig = {
    type: "lpRatio",
    baseTokenField: "tokenA",
    baseAmountField: "amountADesired",
    pairedToken: OLD_TOKEN_B,
  };

  assert.deepEqual(
    resolveLpRatioTokens(legacyConfig, {
      tokenA: TOKEN_A,
      tokenB: TOKEN_B,
    }),
    {
      baseToken: TOKEN_A,
      pairedToken: TOKEN_B,
    },
  );
});

test("keeps legacy configs for other node shapes backward compatible", () => {
  const legacyConfig: LpRatioAmountConfig = {
    type: "lpRatio",
    baseToken: TOKEN_A,
    baseAmountField: "knownAmount",
    pairedToken: TOKEN_B,
  };

  assert.deepEqual(resolveLpRatioTokens(legacyConfig, {}), {
    baseToken: TOKEN_A,
    pairedToken: TOKEN_B,
  });
});

test("blocks an LP ratio field that points outside the add-liquidity pair", () => {
  const config: LpRatioAmountConfig = {
    type: "lpRatio",
    baseTokenField: "tokenA",
    baseAmountField: "amountADesired",
    pairedTokenField: "wrongToken",
  };

  assert.throws(
    () =>
      assertLpRatioMatchesAddLiquidityPair(config, {
        tokenA: TOKEN_A,
        tokenB: TOKEN_B,
        wrongToken: OLD_TOKEN_B,
      }),
    /does not match the current add-liquidity token pair/,
  );
});

test("accepts both current field references and repaired legacy configs", () => {
  const nodeData = { tokenA: TOKEN_A, tokenB: TOKEN_B };

  assert.doesNotThrow(() =>
    assertLpRatioMatchesAddLiquidityPair(
      {
        type: "lpRatio",
        baseTokenField: "tokenA",
        baseAmountField: "amountADesired",
        pairedTokenField: "tokenB",
      },
      nodeData,
    ),
  );

  assert.doesNotThrow(() =>
    assertLpRatioMatchesAddLiquidityPair(
      {
        type: "lpRatio",
        baseTokenField: "tokenA",
        baseAmountField: "amountADesired",
        pairedToken: OLD_TOKEN_B,
      },
      nodeData,
    ),
  );
});
