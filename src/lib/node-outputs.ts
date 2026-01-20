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
  },
  swapPLS: {
    amountOut: 'bigint',
    tokenOut: 'address',
  },
  transfer: null, // no meaningful output
  transferPLS: null, // no meaningful output
  checkBalance: {
    balance: 'bigint',
    token: 'address',
  },
  checkPrice: null, // read-only, no output used by other nodes
  addLiquidity: {
    liquidity: 'bigint',
    amountA: 'bigint',
    amountB: 'bigint',
  },
  addLiquidityPLS: {
    liquidity: 'bigint',
    amountToken: 'bigint',
    amountPLS: 'bigint',
  },
  removeLiquidity: {
    amountA: 'bigint',
    amountB: 'bigint',
  },
  removeLiquidityPLS: {
    amountToken: 'bigint',
    amountPLS: 'bigint',
  },
  burnToken: null, // no meaningful output
  claimToken: null, // no meaningful output
  checkLPTokenAmounts: {
    lpBalance: 'bigint',
    token0: 'address',
    token1: 'address',
    token0Amount: 'bigint',
    token1Amount: 'bigint',
  },
  checkTokenBalance: {
    balance: 'bigint',
    token: 'address',
  },
  wait: null, // no output
  start: null, // no output
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
