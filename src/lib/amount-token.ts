/** Identify the asset whose human-readable amount a node field contains. */
export function getAmountToken(
  field: string,
  data: Record<string, any>,
  nodeType?: string,
): string | undefined {
  if (field === 'plsAmount' || field === 'plsAmountOut' || field === 'liquidity') {
    // Native PLS and PulseX LP shares both use 18 decimals.
    return 'PLS';
  }
  let token: string | undefined;
  if (field === 'amountADesired') token = data.tokenA;
  else if (field === 'amountBDesired') token = data.tokenB;
  else if (field === 'amountTokenDesired') token = data.token;
  else if (field === 'amountIn') {
    token = data.autoRoute
      ? data.tokenIn || (data.usePLS ? 'PLS' : undefined)
      : data.path?.[0];
  } else if (field === 'amountOut') {
    token = data.autoRoute ? data.tokenOut : data.path?.at(-1);
  } else if (field === 'amount' && nodeType === 'dexQuote') {
    token = data.quoteMode === 'amountsIn' ? data.path?.at(-1) : data.path?.[0];
  } else if (field === 'amount') token = data.token;
  else return undefined;

  if (!token) throw new Error(`Cannot determine token for amount field '${field}'`);
  return token;
}
