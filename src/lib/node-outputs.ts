/**
 * Defines what outputs each node type produces
 * Used for variable passing between nodes in linear automation flows
 */

export type NodeOutputSchema = {
  [field: string]: 'bigint' | 'address' | 'string' | 'number' | 'boolean';
} | null;

export const NODE_OUTPUTS: Record<string, NodeOutputSchema> = {
  swap: {
    amountOut: 'bigint',
    tokenOut: 'address',
    gasPrice: 'bigint',
    gasUsed: 'bigint',
  },
  swapPLS: {
    amountOut: 'bigint',
    tokenOut: 'address',
    gasPrice: 'bigint',
    gasUsed: 'bigint',
  },
  swapFromPLS: {
    amountOut: 'bigint',
    tokenOut: 'address',
    gasPrice: 'bigint',
    gasUsed: 'bigint',
  },
  swapToPLS: {
    amountOut: 'bigint',
    tokenOut: 'address',
    gasPrice: 'bigint',
    gasUsed: 'bigint',
  },
  transfer: {
    gasPrice: 'bigint',
    gasUsed: 'bigint',
  },
  transferPLS: {
    gasPrice: 'bigint',
    gasUsed: 'bigint',
  },
  checkBalance: {
    balance: 'bigint',
    token: 'address',
  },
  addLiquidity: {
    liquidity: 'bigint',
    amountA: 'bigint',
    amountB: 'bigint',
    gasPrice: 'bigint',
    gasUsed: 'bigint',
  },
  addLiquidityPLS: {
    liquidity: 'bigint',
    amountToken: 'bigint',
    amountPLS: 'bigint',
    gasPrice: 'bigint',
    gasUsed: 'bigint',
  },
  removeLiquidity: {
    amountA: 'bigint',
    amountB: 'bigint',
    gasPrice: 'bigint',
    gasUsed: 'bigint',
  },
  removeLiquidityPLS: {
    amountToken: 'bigint',
    amountPLS: 'bigint',
    gasPrice: 'bigint',
    gasUsed: 'bigint',
  },
  burnToken: {
    amount: 'bigint',
    token: 'address',
    gasPrice: 'bigint',
    gasUsed: 'bigint',
  },
  claimToken: {
    amount: 'bigint',
    token: 'address',
    gasPrice: 'bigint',
    gasUsed: 'bigint',
  },
  getParent: {
    parentAddress: 'address',
  },
  checkLPTokenAmounts: {
    lpBalance: 'bigint',
    token0: 'address',
    token1: 'address',
    token0Amount: 'bigint',
    token1Amount: 'bigint',
    ratio: 'number',
  },
  checkTokenBalance: {
    balance: 'bigint',
    token: 'address',
  },
  wait: null, // no output
  start: null, // no output
  loop: {
    loopCount: 'number',
    currentIteration: 'number',
  },
  gasGuard: {
    passed: 'boolean',
    currentGasBeats: 'number',
    threshold: 'number',
    skipped: 'boolean',
  },
  variable: {
    value: 'bigint',
  },
  calculator: {
    result: 'bigint',
  },
  telegram: null, // no numeric output
  condition: null, // handled separately (branching)
};

/**
 * Get available output fields for a node type
 */
export function getNodeOutputFields(nodeType: string): string[] {
  const outputs = NODE_OUTPUTS[nodeType];
  if (!outputs) return [];
  return Object.keys(outputs);
}

/**
 * Get only numeric (bigint) output fields for a node type
 * Used for amount fields - excludes addresses and other non-numeric types
 */
export function getNumericOutputFields(nodeType: string): string[] {
  const outputs = NODE_OUTPUTS[nodeType];
  if (!outputs) return [];
  return Object.entries(outputs)
    .filter(([_, type]) => type === 'bigint')
    .map(([field, _]) => field);
}

/**
 * Check if a node type produces a specific output field
 */
export function hasNodeOutput(nodeType: string, field: string): boolean {
  const outputs = NODE_OUTPUTS[nodeType];
  if (!outputs) return false;
  return field in outputs;
  
}
