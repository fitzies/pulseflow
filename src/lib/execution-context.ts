import { Contract, parseUnits } from 'ethers';
import { erc20ABI, pairABI, pulsexRouterABI, PulseXRouter, WPLS } from './abis';
import { getProvider } from './blockchain-functions';
import { prisma } from './prisma';
import { getWalletFromEncryptedKey } from './wallet-generation';
import {
  resolveLpRatioTokens,
  type LpRatioAmountConfig,
} from './lp-ratio-config';

/**
 * Variable reference types for amount fields
 */
export type AmountValue =
  | { type: 'static'; value: string } // User-entered value
  | { type: 'previousOutput'; field: string; percentage: number } // Use output from previous node
  | { type: 'currentBalance'; token: string; percentage: number } // Use current wallet balance
  | LpRatioAmountConfig
  | { type: 'variable'; variableName: string }; // Reference a named variable from the flow

/**
 * Execution context that tracks outputs from executed nodes
 */
export interface ExecutionContext {
  nodeOutputs: Map<string, Record<string, any>>; // nodeId -> output
  previousNodeId: string | null;
  previousNodeType: string | null;
  variables: Map<string, bigint>; // variableName -> value
  forEachItem: { address: string; index: number; total: number } | null;
}

/**
 * Create a new execution context
 */
export function createExecutionContext(): ExecutionContext {
  return {
    nodeOutputs: new Map(),
    previousNodeId: null,
    previousNodeType: null,
    variables: new Map(),
    forEachItem: null,
  };
}

const FOREACH_ITEM_SENTINEL = '__FOREACH_ITEM__';

/**
 * Resolve forEach item sentinels in node data.
 * Scans all string fields and array-of-string fields, replacing
 * any occurrence of __FOREACH_ITEM__ with the current forEach item address.
 */
export function resolveForEachAddresses(
  nodeData: Record<string, any>,
  context: ExecutionContext
): Record<string, any> {
  if (!context.forEachItem) {
    // Check if any field uses the sentinel
    const hasSentinel = Object.values(nodeData).some((v) => {
      if (v === FOREACH_ITEM_SENTINEL) return true;
      if (Array.isArray(v)) return v.some((item) => item === FOREACH_ITEM_SENTINEL);
      return false;
    });
    if (hasSentinel) {
      throw new Error('Node uses "For-Each Item" but is not inside a For-Each block');
    }
    return nodeData;
  }

  const resolved: Record<string, any> = {};
  for (const [key, value] of Object.entries(nodeData)) {
    if (value === FOREACH_ITEM_SENTINEL) {
      resolved[key] = context.forEachItem.address;
    } else if (Array.isArray(value)) {
      resolved[key] = value.map((item) =>
        item === FOREACH_ITEM_SENTINEL ? context.forEachItem!.address : item
      );
    } else {
      resolved[key] = value;
    }
  }
  return resolved;
}

/**
 * Resolve an amount value to a bigint
 */
export async function resolveAmount(
  amountConfig: AmountValue | string | undefined,
  context: ExecutionContext,
  automationId: string,
  decimals = 18,
): Promise<bigint> {
  // Handle legacy string values (backward compatibility)
  if (typeof amountConfig === 'string') {
    return BigInt(amountConfig || '0');
  }

  // Handle undefined/null
  if (!amountConfig) {
    return BigInt(0);
  }

  // Handle static values
  if (amountConfig.type === 'static') {
    const value = amountConfig.value || '0';
    // Only static amounts are human-readable. Other sources already use raw units.
    const amount = parseUnits(value, decimals);
    if (amount < 0n) throw new Error('Amount cannot be negative');
    return amount;
  }

  // Handle previous output
  if (amountConfig.type === 'previousOutput') {
    if (!context.previousNodeId) {
      throw new Error('No previous node output available');
    }

    const previousOutput = context.nodeOutputs.get(context.previousNodeId);
    if (!previousOutput) {
      throw new Error(`Previous node ${context.previousNodeId} has no output`);
    }

    const fieldValue = previousOutput[amountConfig.field];
    if (fieldValue === undefined || fieldValue === null) {
      throw new Error(
        `Previous node output does not have field: ${amountConfig.field}`
      );
    }

    // Convert to bigint and apply percentage
    const value = typeof fieldValue === 'bigint' ? fieldValue : BigInt(fieldValue.toString());
    const percentage = amountConfig.percentage / 100;
    return (value * BigInt(Math.floor(percentage * 10000))) / 10000n;
  }

  // Handle current balance (legacy - no longer used in UI but kept for backward compatibility)
  if (amountConfig.type === 'currentBalance') {
    throw new Error('Wallet balance option has been removed. Use "Custom Amount" or "Previous Output" instead.');
  }

  // Handle LP ratio calculation - requires nodeData context
  if (amountConfig.type === 'lpRatio') {
    throw new Error('lpRatio type requires nodeData context - use resolveLpRatioAmount instead');
  }

  // Handle variable reference
  if (amountConfig.type === 'variable') {
    const variableValue = context.variables.get(amountConfig.variableName);
    if (variableValue === undefined) {
      throw new Error(`Variable '${amountConfig.variableName}' not found. Make sure a Variable node sets it before use.`);
    }
    return variableValue;
  }

  throw new Error(`Unknown amount config type: ${(amountConfig as any).type}`);
}

export interface AmountResolutionOptions {
  token?: string;
  readDecimals?: (token: string) => Promise<number>;
}

async function readTokenDecimals(token: string): Promise<number> {
  const contract = new Contract(token, ['function decimals() view returns (uint8)'], getProvider());
  try {
    return Number(await contract.decimals());
  } catch {
    throw new Error(`Cannot read decimals for token ${token}. Please retry.`);
  }
}

/** Resolve static token amounts and LP ratios without rescaling raw outputs. */
export async function resolveAmountWithNodeData(
  amountConfig: AmountValue | string | undefined,
  nodeData: Record<string, any>,
  context: ExecutionContext,
  automationId: string,
  options: AmountResolutionOptions = {},
): Promise<bigint> {
  // Handle non-lpRatio types with standard resolver
  if (!amountConfig || typeof amountConfig === 'string') {
    return resolveAmount(amountConfig, context, automationId);
  }

  if (amountConfig.type !== 'lpRatio' && amountConfig.type !== 'variable') {
    const decimals = amountConfig.type === 'static' && options.token && options.token !== 'PLS'
      ? await (options.readDecimals ?? readTokenDecimals)(options.token)
      : 18;
    return resolveAmount(amountConfig, context, automationId, decimals);
  }

  // Handle variable type
  if (amountConfig.type === 'variable') {
    return resolveAmount(amountConfig, context, automationId);
  }

  // Handle LP ratio calculation with nodeData context
  const provider = getProvider();

  // Resolve the base amount from the referenced field in nodeData
  const baseAmountConfig = nodeData[amountConfig.baseAmountField];
  if (!baseAmountConfig) {
    throw new Error(`LP ratio base amount field '${amountConfig.baseAmountField}' not found in nodeData`);
  }

  if (baseAmountConfig.type === 'lpRatio') {
    throw new Error('LP ratio base amount cannot reference another LP ratio');
  }
  const resolvedTokens = resolveLpRatioTokens(amountConfig, nodeData);
  const baseToken = resolvedTokens.baseToken === 'PLS' ? WPLS : resolvedTokens.baseToken;
  const pairedToken = resolvedTokens.pairedToken === 'PLS' ? WPLS : resolvedTokens.pairedToken;
  const isBackwardsConfig = pairedToken.toLowerCase() === WPLS.toLowerCase()
    && amountConfig.baseAmountField.toLowerCase().includes('pls');
  const baseAmount = await resolveAmountWithNodeData(baseAmountConfig, nodeData, context, automationId, {
    ...options,
    token: isBackwardsConfig ? 'PLS' : baseToken,
  });
  if (baseAmount === 0n) {
    return 0n;
  }

  try {
    // Get pair address from factory
    const routerContract = new Contract(PulseXRouter, pulsexRouterABI, provider);
    const factoryAddress = await routerContract.factory();
    const factoryContract = new Contract(factoryAddress, [
      "function getPair(address tokenA, address tokenB) external view returns (address pair)",
    ], provider);

    const pairAddress = await factoryContract.getPair(baseToken, pairedToken);
    if (!pairAddress || pairAddress === "0x0000000000000000000000000000000000000000") {
      throw new Error('No LP exists between the specified tokens');
    }

    // Get reserves from pair
    const pairContract = new Contract(pairAddress, pairABI, provider);
    const reserves = await pairContract.getReserves();
    const token0 = await pairContract.token0();

    // Determine which reserve is which
    const isBaseToken0 = token0.toLowerCase() === baseToken.toLowerCase();
    const reserveBase = isBaseToken0 ? reserves[0] : reserves[1];
    const reservePaired = isBaseToken0 ? reserves[1] : reserves[0];

    // Use quote to calculate the paired amount
    // quote(inputAmount, inputReserve, outputReserve) = outputAmount
    // 
    // Detect "backwards" configuration common in addLiquidityPLS:
    // When pairedToken is PLS/WPLS and baseAmountField references a PLS amount field,
    // the user actually wants to calculate token amount FROM PLS amount.
    // In this case baseToken points to the token but baseAmount is in PLS units.
    
    // For backwards config: user knows PLS amount, wants token amount
    // Formula: tokenAmount = plsAmount * reserveToken / reservePLS
    // Since baseToken = token and pairedToken = PLS:
    //   reserveBase = reserveToken, reservePaired = reservePLS
    //   So we need: quote(baseAmount, reservePaired, reserveBase)
    //
    // For normal config: user knows baseToken amount, wants pairedToken amount
    // Formula: pairedAmount = baseAmount * reservePaired / reserveBase
    //   So we need: quote(baseAmount, reserveBase, reservePaired)
    const pairedAmount = isBackwardsConfig
      ? await routerContract.quote(baseAmount, reservePaired, reserveBase)
      : await routerContract.quote(baseAmount, reserveBase, reservePaired);

    return pairedAmount;
  } catch (error) {
    console.error('Error calculating LP ratio amount:', error);
    throw new Error(`Failed to calculate amount from LP ratio: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract output from a node execution result
 */
export function extractNodeOutput(
  nodeType: string,
  nodeId: string,
  result: any
): Record<string, any> | null {
  // Handle transaction receipts - extract from logs/events
  if (result && typeof result === 'object' && 'logs' in result) {
    // For swaps, we need to parse the amounts array from events
    // This is a simplified version - actual implementation may need to parse events
    return null; // Will be handled by parsing transaction logs
  }

  // Handle direct return values (like checkBalance, checkLPTokenAmounts)
  if (result && typeof result === 'object') {
    return result;
  }

  return null;
}

/**
 * Update context with node output
 */
export function updateContextWithOutput(
  context: ExecutionContext,
  nodeId: string,
  nodeType: string,
  output: Record<string, any> | null
): ExecutionContext {
  const newContext = {
    ...context,
    previousNodeId: nodeId,
    previousNodeType: nodeType,
    variables: new Map(context.variables), // Clone the map
  };

  if (output) {
    newContext.nodeOutputs.set(nodeId, output);
  }

  return newContext;
}

/**
 * Set a variable in the execution context
 */
export function setVariable(
  context: ExecutionContext,
  variableName: string,
  value: bigint
): ExecutionContext {
  const newContext = {
    ...context,
    variables: new Map(context.variables),
  };
  newContext.variables.set(variableName, value);
  return newContext;
}

/**
 * Get a variable from the execution context
 */
export function getVariable(
  context: ExecutionContext,
  variableName: string
): bigint | undefined {
  return context.variables.get(variableName);
}

/**
 * Evaluate a math expression with variable substitution
 * Supports: +, -, *, /, **, %, parentheses, and {{variableName}} syntax
 */
export function evaluateExpression(
  expression: string,
  context: ExecutionContext
): bigint {
  if (!expression || expression.trim() === '') {
    return 0n;
  }

  // Replace {{variableName}} with actual values
  let processedExpr = expression.replace(/\{\{(\w+)\}\}/g, (_, varName) => {
    const value = context.variables.get(varName);
    if (value === undefined) {
      throw new Error(`Variable '${varName}' not found in expression`);
    }
    return value.toString();
  });

  // Clean up whitespace
  processedExpr = processedExpr.trim();

  try {
    // Use Function constructor to evaluate the expression safely
    // Only allow numbers and basic math operators
    if (!/^[\d\s+\-*/%().]+$/.test(processedExpr)) {
      throw new Error('Expression contains invalid characters');
    }

    // Evaluate the expression as a number
    const result = Function(`"use strict"; return (${processedExpr})`)();
    
    if (typeof result !== 'number' || !isFinite(result)) {
      throw new Error('Expression did not evaluate to a valid number');
    }

    // Convert to bigint (wei) - assumes the result is in ether units
    // Multiply by 1e18 and floor to get wei
    return BigInt(Math.floor(result * 1e18));
  } catch (error) {
    throw new Error(`Failed to evaluate expression: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Parse swap transaction receipt to extract amountOut
 */
export async function parseSwapOutput(
  receipt: any,
  path: string[]
): Promise<{ amountOut: bigint; tokenOut: string } | null> {
  if (!receipt || !receipt.logs || !path || path.length === 0) {
    return null;
  }

  try {
    // The last token in the path is the output token
    const tokenOut = path[path.length - 1];

    // Parse Swap event from PulseX router
    // Event: Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)
    // We need to find the Swap event and extract amountOut
    // This is a simplified version - actual implementation should parse the event properly

    // For now, we'll need to query the balance change or parse events
    // This is a placeholder - you may need to implement proper event parsing
    return null;
  } catch (error) {
    console.error('Error parsing swap output:', error);
    return null;
  }
}
